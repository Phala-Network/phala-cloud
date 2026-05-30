package phala

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestUpdateCVMListed covers the dedicated PATCH /cvms/{id}/listed endpoint
// used by the Terraform provider to toggle marketplace visibility in place
// (no redeploy, no attestation change).
func TestUpdateCVMListed(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "PATCH" {
			t.Errorf("method = %q, want PATCH", r.Method)
		}
		if r.URL.Path != "/cvms/cvm-123/listed" {
			t.Errorf("path = %q, want /cvms/cvm-123/listed", r.URL.Path)
		}

		var body UpdateListedRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		if !body.Listed {
			t.Errorf("listed = %v, want true", body.Listed)
		}

		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}

	if err := client.UpdateCVMListed(context.Background(), "cvm-123", true); err != nil {
		t.Fatalf("UpdateCVMListed: %v", err)
	}
}
