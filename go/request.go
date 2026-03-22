package phala

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// newRequest creates a new HTTP request with standard headers.
func (c *Client) newRequest(ctx context.Context, method, path string, body io.Reader) (*http.Request, error) {
	url := c.baseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("X-API-Key", c.apiKey)
	req.Header.Set("X-Phala-Version", c.apiVersion)
	req.Header.Set("User-Agent", c.userAgent)

	for k, v := range c.headers {
		req.Header.Set(k, v)
	}

	return req, nil
}

// do executes an HTTP request and returns the response. Non-2xx responses return *APIError.
func (c *Client) do(ctx context.Context, req *http.Request) (*http.Response, error) {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return resp, nil
	}

	defer resp.Body.Close()
	bodyBytes, _ := io.ReadAll(resp.Body)

	apiErr := &APIError{
		StatusCode: resp.StatusCode,
		Body:       string(bodyBytes),
		Headers:    resp.Header,
	}

	// Try to parse error message from JSON response.
	var parsed map[string]any
	if json.Unmarshal(bodyBytes, &parsed) == nil {
		if msg, ok := parsed["message"].(string); ok {
			apiErr.Message = msg
		} else if detail, ok := parsed["detail"]; ok {
			switch v := detail.(type) {
			case string:
				apiErr.Message = v
			default:
				apiErr.Detail = detail
				b, _ := json.Marshal(detail)
				apiErr.Message = string(b)
			}
		}
		if code, ok := parsed["error_code"].(string); ok {
			apiErr.ErrorCode = code
		}
		// Parse structured error fields.
		if details, ok := parsed["details"].([]any); ok {
			for _, d := range details {
				if dm, ok := d.(map[string]any); ok {
					ed := ErrorDetail{}
					if f, ok := dm["field"].(string); ok {
						ed.Field = f
					}
					if v, ok := dm["value"]; ok {
						ed.Value = v
					}
					if m, ok := dm["message"].(string); ok {
						ed.Message = m
					}
					apiErr.Details = append(apiErr.Details, ed)
				}
			}
		}
		if suggestions, ok := parsed["suggestions"].([]any); ok {
			for _, s := range suggestions {
				if str, ok := s.(string); ok {
					apiErr.Suggestions = append(apiErr.Suggestions, str)
				}
			}
		}
		if links, ok := parsed["links"].([]any); ok {
			for _, l := range links {
				if lm, ok := l.(map[string]any); ok {
					el := ErrorLink{}
					if u, ok := lm["url"].(string); ok {
						el.URL = u
					}
					if lb, ok := lm["label"].(string); ok {
						el.Label = lb
					}
					apiErr.Links = append(apiErr.Links, el)
				}
			}
		}
	}

	if apiErr.Message == "" {
		apiErr.Message = http.StatusText(resp.StatusCode)
	}

	// Strip sensitive headers from error.
	if apiErr.Headers != nil {
		sanitized := apiErr.Headers.Clone()
		sanitized.Del("X-API-Key")
		sanitized.Del("Authorization")
		apiErr.Headers = sanitized
	}

	return nil, apiErr
}

// doJSON sends a JSON request and decodes the JSON response into result.
func (c *Client) doJSON(ctx context.Context, method, path string, reqBody, result any) error {
	var body io.Reader
	if reqBody != nil {
		b, err := json.Marshal(reqBody)
		if err != nil {
			return fmt.Errorf("phala: marshal request: %w", err)
		}
		body = bytes.NewReader(b)
	}

	req, err := c.newRequest(ctx, method, path, body)
	if err != nil {
		return err
	}
	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.do(ctx, req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if result == nil {
		return nil
	}

	return json.NewDecoder(resp.Body).Decode(result)
}

// doText sends a request with a text body (YAML, plain text, etc.) and optional extra headers.
func (c *Client) doText(ctx context.Context, method, path, contentType, body string, extraHeaders map[string]string, result any) error {
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}

	req, err := c.newRequest(ctx, method, path, reader)
	if err != nil {
		return err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}

	resp, err := c.do(ctx, req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if result == nil {
		return nil
	}

	// If result is *string, read as text.
	if s, ok := result.(*string); ok {
		b, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		*s = string(b)
		return nil
	}

	return json.NewDecoder(resp.Body).Decode(result)
}

// doEmpty sends a request expecting no response body.
func (c *Client) doEmpty(ctx context.Context, method, path string) error {
	req, err := c.newRequest(ctx, method, path, nil)
	if err != nil {
		return err
	}

	resp, err := c.do(ctx, req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}
