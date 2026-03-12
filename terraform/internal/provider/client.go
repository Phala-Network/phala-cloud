package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Phala-Network/phala-cloud/terraform/internal/phalaapi"
)

// Async CVM operations can keep resources locked for several minutes.
// Keep retrying retryable write errors (409/429/503) long enough to cover
// typical backend convergence windows.
const maxWriteRetries = 30

type APIClient struct {
	baseURL    string
	apiKey     string
	apiVersion string
	httpClient *http.Client
	typed      *phalaapi.ClientWithResponses
}

type APIError struct {
	StatusCode int
	Status     string
	Message    string
	Detail     any
	Body       string
	Headers    http.Header
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("%s: %s", e.Status, e.Message)
	}
	return e.Status
}

func (e *APIError) retryAfter() time.Duration {
	if e == nil || e.Headers == nil {
		return 0
	}

	v := e.Headers.Get("Retry-After")
	if v == "" {
		return 0
	}

	secs, err := strconv.Atoi(v)
	if err == nil && secs > 0 {
		return time.Duration(secs) * time.Second
	}

	t, err := http.ParseTime(v)
	if err == nil {
		d := time.Until(t)
		if d > 0 {
			return d
		}
	}

	return 0
}

func NewAPIClient(baseURL, apiKey, apiVersion string, timeout time.Duration) *APIClient {
	httpClient := &http.Client{
		Timeout: timeout,
	}

	return &APIClient{
		baseURL:    strings.TrimSuffix(baseURL, "/"),
		apiKey:     apiKey,
		apiVersion: apiVersion,
		httpClient: httpClient,
		typed:      newTypedClient(strings.TrimSuffix(baseURL, "/"), apiKey, apiVersion, httpClient),
	}
}

func (c *APIClient) GetJSON(ctx context.Context, path string, out any) error {
	return c.requestJSON(ctx, http.MethodGet, path, "", nil, nil, out)
}

func (c *APIClient) GetText(ctx context.Context, path string) (string, error) {
	var out string
	if err := c.requestJSON(ctx, http.MethodGet, path, "", nil, nil, &out); err != nil {
		return "", err
	}
	return out, nil
}

func (c *APIClient) PostJSON(ctx context.Context, path string, payload any, out any) error {
	return c.requestWithRetry(ctx, http.MethodPost, path, "application/json", payload, nil, out)
}

func (c *APIClient) PatchJSON(ctx context.Context, path string, payload any, out any) error {
	return c.requestWithRetry(ctx, http.MethodPatch, path, "application/json", payload, nil, out)
}

func (c *APIClient) PatchText(
	ctx context.Context,
	path string,
	body string,
	headers map[string]string,
	out any,
) error {
	return c.requestWithRetry(ctx, http.MethodPatch, path, "text/plain", body, headers, out)
}

func (c *APIClient) Delete(ctx context.Context, path string) error {
	return c.requestWithRetry(ctx, http.MethodDelete, path, "", nil, nil, nil)
}

func (c *APIClient) requestWithRetry(
	ctx context.Context,
	method, path, contentType string,
	payload any,
	headers map[string]string,
	out any,
) error {
	for attempt := 0; attempt <= maxWriteRetries; attempt++ {
		err := c.requestJSON(ctx, method, path, contentType, payload, headers, out)
		if err == nil {
			return nil
		}

		apiErr, ok := err.(*APIError)
		if !ok || !isRetryableStatus(apiErr.StatusCode) || attempt == maxWriteRetries {
			return err
		}

		delay := retryDelayForAttempt(attempt)
		if fromHeader := apiErr.retryAfter(); fromHeader > 0 {
			delay = fromHeader
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
	}

	return fmt.Errorf("request failed after retries")
}

func isRetryableStatus(status int) bool {
	switch status {
	case http.StatusConflict, http.StatusTooManyRequests, http.StatusServiceUnavailable:
		return true
	default:
		return false
	}
}

func retryDelayForAttempt(attempt int) time.Duration {
	// 1s, 2s, 4s, 8s ... capped at 20s
	delay := time.Second * time.Duration(1<<attempt)
	if delay > 20*time.Second {
		return 20 * time.Second
	}
	return delay
}

func (c *APIClient) requestJSON(
	ctx context.Context,
	method, path, contentType string,
	payload any,
	headers map[string]string,
	out any,
) error {
	if handled, err := c.tryTypedRequest(ctx, method, path, contentType, payload, headers, out); handled {
		return err
	}

	var bodyBytes []byte
	var err error

	if payload != nil {
		switch p := payload.(type) {
		case string:
			bodyBytes = []byte(p)
		case []byte:
			bodyBytes = p
		default:
			bodyBytes, err = json.Marshal(payload)
			if err != nil {
				return fmt.Errorf("marshal request payload: %w", err)
			}
		}
	}

	_, respBody, err := c.doRaw(ctx, method, path, contentType, bodyBytes, headers)
	if err != nil {
		return err
	}

	if out == nil || len(respBody) == 0 {
		return nil
	}

	switch target := out.(type) {
	case *string:
		*target = string(respBody)
		return nil
	default:
		if err := json.Unmarshal(respBody, out); err != nil {
			return fmt.Errorf("decode response payload: %w", err)
		}
		return nil
	}
}

func (c *APIClient) doRaw(
	ctx context.Context,
	method, path, contentType string,
	body []byte,
	headers map[string]string,
) (int, []byte, error) {
	fullURL := c.baseURL + "/" + strings.TrimPrefix(path, "/")

	var reader io.Reader
	if len(body) > 0 {
		reader = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, fullURL, reader)
	if err != nil {
		return 0, nil, err
	}

	req.Header.Set("Accept", "*/*")
	req.Header.Set("X-API-Key", c.apiKey)
	if c.apiVersion != "" {
		req.Header.Set("X-Phala-Version", c.apiVersion)
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, err
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return resp.StatusCode, respBody, nil
	}

	safeHeaders := resp.Header.Clone()
	safeHeaders.Del("X-API-Key")
	safeHeaders.Del("Authorization")
	return resp.StatusCode, respBody, c.parseAPIError(resp.StatusCode, resp.Status, respBody, safeHeaders)
}

func (c *APIClient) parseAPIError(
	statusCode int,
	statusText string,
	body []byte,
	headers http.Header,
) error {
	errObj := &APIError{
		StatusCode: statusCode,
		Status:     statusText,
		Body:       string(body),
		Headers:    headers,
	}

	if len(body) == 0 {
		errObj.Message = statusText
		return errObj
	}

	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		errObj.Message = string(body)
		return errObj
	}

	if v, ok := payload["message"].(string); ok && v != "" {
		errObj.Message = v
	}
	if errObj.Message == "" {
		if v, ok := payload["detail"].(string); ok && v != "" {
			errObj.Message = v
		}
	}
	if errObj.Message == "" {
		errObj.Message = statusText
	}
	if detail, ok := payload["detail"]; ok {
		errObj.Detail = detail
	}

	return errObj
}
