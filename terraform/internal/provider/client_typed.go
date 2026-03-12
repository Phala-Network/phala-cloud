package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/Phala-Network/phala-cloud/terraform/internal/phalaapi"
)

func newTypedClient(baseURL, apiKey, apiVersion string, httpClient *http.Client) *phalaapi.ClientWithResponses {
	server := typedServerURL(baseURL)
	client, err := phalaapi.NewClientWithResponses(
		server,
		phalaapi.WithHTTPClient(httpClient),
		phalaapi.WithRequestEditorFn(func(_ context.Context, req *http.Request) error {
			req.Header.Set("X-API-Key", apiKey)
			if apiVersion != "" {
				req.Header.Set("X-Phala-Version", apiVersion)
			}
			if req.Header.Get("Accept") == "" {
				req.Header.Set("Accept", "*/*")
			}
			return nil
		}),
	)
	if err != nil {
		log.Printf("[WARN] phala: failed to initialize typed API client, falling back to raw HTTP: %v", err)
		return nil
	}

	return client
}

func typedServerURL(baseURL string) string {
	trimmed := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if trimmed == "" {
		return baseURL
	}

	lower := strings.ToLower(trimmed)
	if strings.HasSuffix(lower, "/api/v1") {
		return trimmed[:len(trimmed)-len("/api/v1")]
	}
	return trimmed
}

func (c *APIClient) tryTypedRequest(
	ctx context.Context,
	method, path, contentType string,
	payload any,
	headers map[string]string,
	out any,
) (bool, error) {
	if c.typed == nil {
		return false, nil
	}

	normalizedPath := normalizePath(path)

	switch {
	case method == http.MethodGet && normalizedPath == "/auth/me":
		resp, err := c.typed.ReadUsersMeApiV1AuthMeGetWithResponse(ctx)
		if resp == nil {
			return true, err
		}
		return true, c.finishTyped(resp.HTTPResponse, resp.Body, err, out)

	case method == http.MethodGet && normalizedPath == "/apps/filter-options":
		resp, err := c.typed.GetFilterOptionsApiV1AppsFilterOptionsGetWithResponse(ctx)
		if resp == nil {
			return true, err
		}
		return true, c.finishTyped(resp.HTTPResponse, resp.Body, err, out)

	case method == http.MethodGet && normalizedPath == "/teepods/available":
		resp, err := c.typed.HandleGetAvailableTeepodsApiV1TeepodsAvailableGetWithResponse(ctx, nil)
		if resp == nil {
			return true, err
		}
		return true, c.finishTyped(resp.HTTPResponse, resp.Body, err, out)

	case method == http.MethodPost && normalizedPath == "/cvms/provision":
		var req phalaapi.HandleProvisionCvmApiV1CvmsProvisionPostJSONRequestBody
		if err := convertPayload(payload, &req); err != nil {
			return true, fmt.Errorf("convert /cvms/provision payload: %w", err)
		}
		resp, err := c.typed.HandleProvisionCvmApiV1CvmsProvisionPostWithResponse(ctx, req)
		if resp == nil {
			return true, err
		}
		return true, c.finishTyped(resp.HTTPResponse, resp.Body, err, out)

	case method == http.MethodPost && normalizedPath == "/cvms":
		var req phalaapi.HandleCreateCvmFromPovisionApiV1CvmsPostJSONRequestBody
		if err := convertPayload(payload, &req); err != nil {
			return true, fmt.Errorf("convert /cvms payload: %w", err)
		}
		resp, err := c.typed.HandleCreateCvmFromPovisionApiV1CvmsPostWithResponse(ctx, req)
		if resp == nil {
			return true, err
		}
		return true, c.finishTyped(resp.HTTPResponse, resp.Body, err, out)

	case method == http.MethodPost:
		if cvmID, ok := extractCVMID(normalizedPath, "/start"); ok {
			var req phalaapi.HandleStartCvmApiV1CvmsCvmIdStartPostJSONRequestBody
			if payload != nil {
				if err := convertPayload(payload, &req); err != nil {
					return true, fmt.Errorf("convert /cvms/{id}/start payload: %w", err)
				}
			}
			resp, err := c.typed.HandleStartCvmApiV1CvmsCvmIdStartPostWithResponse(ctx, cvmID, req)
			if resp == nil {
				return true, err
			}
			return true, c.finishTyped(resp.HTTPResponse, resp.Body, err, out)
		}

		if cvmID, ok := extractCVMID(normalizedPath, "/stop"); ok {
			var req phalaapi.HandleStopCvmApiV1CvmsCvmIdStopPostJSONRequestBody
			if payload != nil {
				if err := convertPayload(payload, &req); err != nil {
					return true, fmt.Errorf("convert /cvms/{id}/stop payload: %w", err)
				}
			}
			resp, err := c.typed.HandleStopCvmApiV1CvmsCvmIdStopPostWithResponse(ctx, cvmID, req)
			if resp == nil {
				return true, err
			}
			return true, c.finishTyped(resp.HTTPResponse, resp.Body, err, out)
		}

	case method == http.MethodDelete:
		if cvmID, ok := extractCVMID(normalizedPath, ""); ok {
			resp, err := c.typed.HandleRemoveCvmApiV1CvmsCvmIdDeleteWithResponse(ctx, cvmID, nil)
			if resp == nil {
				return true, err
			}
			return true, c.finishTyped(resp.HTTPResponse, resp.Body, err, out)
		}

	case method == http.MethodGet:
		if cvmID, ok := extractCVMID(normalizedPath, ""); ok {
			resp, err := c.typed.HandleGetCvmApiV1CvmsCvmIdGetWithResponse(ctx, cvmID)
			if resp == nil {
				return true, err
			}
			return true, c.finishTyped(resp.HTTPResponse, resp.Body, err, out)
		}
		if cvmID, ok := extractCVMID(normalizedPath, "/docker-compose.yml"); ok {
			resp, err := c.typed.HandleGetCvmDockerComposeApiV1CvmsCvmIdDockerComposeYmlGetWithResponse(ctx, cvmID)
			if resp == nil {
				return true, err
			}
			return true, c.finishTyped(resp.HTTPResponse, resp.Body, err, out)
		}
		if cvmID, ok := extractCVMID(normalizedPath, "/pre-launch-script"); ok {
			resp, err := c.typed.HandleGetCvmPrelaunchScriptApiV1CvmsCvmIdPreLaunchScriptGetWithResponse(ctx, cvmID)
			if resp == nil {
				return true, err
			}
			return true, c.finishTyped(resp.HTTPResponse, resp.Body, err, out)
		}

	case method == http.MethodPatch:
		if cvmID, ok := extractCVMID(normalizedPath, "/resources"); ok {
			req, err := toResizePayload(payload)
			if err != nil {
				return true, fmt.Errorf("convert /cvms/{id}/resources payload: %w", err)
			}
			resp, err := c.typed.HandleResizeCvmApiV1CvmsCvmIdResourcesPatchWithResponse(ctx, cvmID, nil, req)
			if resp == nil {
				return true, err
			}
			return true, c.finishTyped(resp.HTTPResponse, resp.Body, err, out)
		}

		if cvmID, ok := extractCVMID(normalizedPath, "/docker-compose"); ok {
			bodyText, err := payloadToString(payload)
			if err != nil {
				return true, fmt.Errorf("convert /cvms/{id}/docker-compose payload: %w", err)
			}
			contentTypeToSend := firstHeader(headers, "Content-Type")
			if contentTypeToSend == "" {
				contentTypeToSend = nonEmpty(contentType, "text/yaml")
			}
			params := &phalaapi.UpdateCvmDockerComposeApiV1CvmsCvmIdDockerComposePatchParams{}
			if v := firstHeader(headers, "X-Compose-Hash"); v != "" {
				params.XComposeHash = &v
			}
			if v := firstHeader(headers, "X-Transaction-Hash"); v != "" {
				params.XTransactionHash = &v
			}
			resp, err := c.typed.UpdateCvmDockerComposeApiV1CvmsCvmIdDockerComposePatchWithBodyWithResponse(
				ctx,
				cvmID,
				params,
				contentTypeToSend,
				strings.NewReader(bodyText),
			)
			if resp == nil {
				return true, err
			}
			return true, c.finishTyped(resp.HTTPResponse, resp.Body, err, out)
		}

		if cvmID, ok := extractCVMID(normalizedPath, "/pre-launch-script"); ok {
			bodyText, err := payloadToString(payload)
			if err != nil {
				return true, fmt.Errorf("convert /cvms/{id}/pre-launch-script payload: %w", err)
			}
			contentTypeToSend := firstHeader(headers, "Content-Type")
			if contentTypeToSend == "" {
				contentTypeToSend = nonEmpty(contentType, "text/plain")
			}
			params := &phalaapi.UpdateCvmPreLaunchScriptApiV1CvmsCvmIdPreLaunchScriptPatchParams{}
			if v := firstHeader(headers, "X-Compose-Hash"); v != "" {
				params.XComposeHash = &v
			}
			if v := firstHeader(headers, "X-Transaction-Hash"); v != "" {
				params.XTransactionHash = &v
			}
			resp, err := c.typed.UpdateCvmPreLaunchScriptApiV1CvmsCvmIdPreLaunchScriptPatchWithBodyWithResponse(
				ctx,
				cvmID,
				params,
				contentTypeToSend,
				strings.NewReader(bodyText),
			)
			if resp == nil {
				return true, err
			}
			return true, c.finishTyped(resp.HTTPResponse, resp.Body, err, out)
		}
	}

	return false, nil
}

func (c *APIClient) finishTyped(resp *http.Response, body []byte, callErr error, out any) error {
	if callErr != nil {
		return callErr
	}
	if resp == nil {
		return fmt.Errorf("typed API client returned nil response")
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return c.parseAPIError(resp.StatusCode, resp.Status, body, resp.Header)
	}

	if out == nil || len(body) == 0 {
		return nil
	}

	switch target := out.(type) {
	case *string:
		*target = string(body)
		return nil
	default:
		if err := json.Unmarshal(body, out); err != nil {
			return fmt.Errorf("decode typed response payload: %w", err)
		}
		return nil
	}
}

func toResizePayload(payload any) (phalaapi.HandleResizeCvmApiV1CvmsCvmIdResourcesPatchJSONRequestBody, error) {
	var raw map[string]any
	if err := convertPayload(payload, &raw); err != nil {
		return phalaapi.CvmResizePayload{}, err
	}

	req := phalaapi.CvmResizePayload{}

	if v, ok := raw["instance_type"].(string); ok && strings.TrimSpace(v) != "" {
		req.InstanceType = &v
	}
	if v, ok := intFromAny(raw["disk_size"]); ok {
		req.DiskSize = &v
	}
	if v, ok := intFromAny(raw["memory"]); ok {
		req.Memory = &v
	}
	if v, ok := intFromAny(raw["vcpu"]); ok {
		req.Vcpu = &v
	}

	if allowRaw, ok := raw["allow_restart"]; ok {
		if allowBool, ok := allowRaw.(bool); ok {
			allow := 0
			if allowBool {
				allow = 1
			}
			req.AllowRestart = &allow
		} else if allowInt, ok := intFromAny(allowRaw); ok {
			req.AllowRestart = &allowInt
		}
	}

	return req, nil
}

func intFromAny(v any) (int, bool) {
	switch x := v.(type) {
	case int:
		return x, true
	case int8:
		return int(x), true
	case int16:
		return int(x), true
	case int32:
		return int(x), true
	case int64:
		return int(x), true
	case float32:
		return int(x), true
	case float64:
		return int(x), true
	case json.Number:
		iv, err := x.Int64()
		if err != nil {
			return 0, false
		}
		return int(iv), true
	case string:
		iv, err := strconv.Atoi(strings.TrimSpace(x))
		if err != nil {
			return 0, false
		}
		return iv, true
	default:
		return 0, false
	}
}

func payloadToString(payload any) (string, error) {
	switch p := payload.(type) {
	case string:
		return p, nil
	case []byte:
		return string(p), nil
	default:
		return "", fmt.Errorf("unsupported payload type %T", payload)
	}
}

func convertPayload(in any, out any) error {
	b, err := json.Marshal(in)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, out)
}

func normalizePath(path string) string {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return "/"
	}

	normalized := "/" + strings.TrimPrefix(trimmed, "/")
	if normalized != "/" {
		normalized = strings.TrimSuffix(normalized, "/")
	}
	return normalized
}

func extractCVMID(path, suffix string) (string, bool) {
	const prefix = "/cvms/"

	if !strings.HasPrefix(path, prefix) {
		return "", false
	}

	tail := strings.TrimPrefix(path, prefix)
	if suffix != "" {
		if !strings.HasSuffix(tail, suffix) {
			return "", false
		}
		tail = strings.TrimSuffix(tail, suffix)
	}

	if tail == "" || strings.Contains(tail, "/") {
		return "", false
	}

	id, err := url.PathUnescape(tail)
	if err != nil {
		return "", false
	}
	return id, true
}

func firstHeader(headers map[string]string, key string) string {
	if len(headers) == 0 {
		return ""
	}
	if v := strings.TrimSpace(headers[key]); v != "" {
		return v
	}

	lowerKey := strings.ToLower(key)
	for k, v := range headers {
		if strings.ToLower(k) == lowerKey && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func nonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
