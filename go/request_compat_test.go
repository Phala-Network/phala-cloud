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

func TestDo_PreservesStructuredErrorDetailValues(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(465)
		_, _ = io.WriteString(w, `{
			"message":"compose hash precondition failed",
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
	if !strings.Contains(formatted, `"kms_info":{"chain_id":1}`) {
		t.Fatalf("FormatError() missing object value: %s", formatted)
	}
	if !strings.Contains(formatted, "value: 512") {
		t.Fatalf("FormatError() missing numeric value: %s", formatted)
	}
}
