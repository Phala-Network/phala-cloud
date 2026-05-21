package phala

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCVMInfo_UnmarshalPreservesEndpointInstance(t *testing.T) {
	var info CVMInfo
	err := json.Unmarshal([]byte(`{
		"id":"1",
		"name":"test",
		"resource":{},
		"status":"running",
		"listed":false,
		"endpoints":[{"app":"https://app.example","instance":"https://instance.example"}],
		"public_urls":[{"app":"https://public-app.example","instance":"https://public-instance.example"}]
	}`), &info)
	if err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}

	if len(info.Endpoints) != 1 || info.Endpoints[0].Instance != "https://instance.example" {
		t.Fatalf("endpoints = %#v", info.Endpoints)
	}
	if len(info.PublicURLs) != 1 || info.PublicURLs[0].Instance != "https://public-instance.example" {
		t.Fatalf("public_urls = %#v", info.PublicURLs)
	}
}

func TestProvisionCVMResponse_UnmarshalComposeHashRegistered(t *testing.T) {
	var resp ProvisionCVMResponse
	err := json.Unmarshal([]byte(`{
		"app_id":"app_1",
		"compose_hash":"hash123",
		"compose_hash_registered":true
	}`), &resp)
	if err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if !resp.ComposeHashRegistered {
		t.Fatalf("ComposeHashRegistered = %v, want true", resp.ComposeHashRegistered)
	}
	if resp.ComposeHash != "hash123" {
		t.Fatalf("ComposeHash = %q, want hash123", resp.ComposeHash)
	}

	var respFalse ProvisionCVMResponse
	err = json.Unmarshal([]byte(`{
		"app_id":"app_1",
		"compose_hash":"hash456"
	}`), &respFalse)
	if err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if respFalse.ComposeHashRegistered {
		t.Fatalf("ComposeHashRegistered = %v, want false", respFalse.ComposeHashRegistered)
	}
}

func TestDo_UsesRequestIDHeaderWhenBodyOmitsRequestID(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Request-ID", "rid-header-456")
		w.WriteHeader(400)
		_, _ = io.WriteString(w, `{
			"message":"structured failure",
			"error_code":"ERR-01-005"
		}`)
	}))
	defer srv.Close()

	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}

	req, err := client.newRequest(context.Background(), "GET", "/test", nil)
	if err != nil {
		t.Fatalf("newRequest: %v", err)
	}

	_, err = client.do(context.Background(), req)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("expected *APIError, got %T", err)
	}
	if apiErr.RequestID != "rid-header-456" {
		t.Fatalf("RequestID = %q, want rid-header-456", apiErr.RequestID)
	}
}

func TestDo_PreservesStructuredErrorDetailValues(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Request-ID", "rid-header-456")
		w.WriteHeader(465)
		_, _ = io.WriteString(w, `{
			"message":"compose hash precondition failed",
			"request_id":"rid-body-123",
			"error_code":"ERR-03-006",
			"details":[
				{
					"field":"compose_hash",
					"value":{"app_id":"app_123","kms_info":{"chain_id":1}},
					"message":"use returned metadata"
				},
				{
					"field":"memory",
					"value":512,
					"message":"too small"
				}
			]
		}`)
	}))
	defer srv.Close()

	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}

	req, err := client.newRequest(context.Background(), "GET", "/test", nil)
	if err != nil {
		t.Fatalf("newRequest: %v", err)
	}

	_, err = client.do(context.Background(), req)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("expected *APIError, got %T", err)
	}
	if apiErr.RequestID != "rid-body-123" {
		t.Fatalf("RequestID = %q, want rid-body-123", apiErr.RequestID)
	}
	if len(apiErr.Details) != 2 {
		t.Fatalf("details = %#v", apiErr.Details)
	}

	value0, ok := apiErr.Details[0].Value.(map[string]any)
	if !ok {
		t.Fatalf("detail value type = %T, want map[string]any", apiErr.Details[0].Value)
	}
	if value0["app_id"] != "app_123" {
		t.Fatalf("detail value = %#v", value0)
	}

	value1, ok := apiErr.Details[1].Value.(float64)
	if !ok || value1 != 512 {
		t.Fatalf("numeric detail value = %#v", apiErr.Details[1].Value)
	}

	formatted := apiErr.FormatError()
	if !strings.Contains(formatted, "Request ID: rid-body-123") {
		t.Fatalf("FormatError() missing request id: %s", formatted)
	}
	if !strings.Contains(formatted, `"kms_info":{"chain_id":1}`) {
		t.Fatalf("FormatError() missing object value: %s", formatted)
	}
	if !strings.Contains(formatted, "value: 512") {
		t.Fatalf("FormatError() missing numeric value: %s", formatted)
	}
}
