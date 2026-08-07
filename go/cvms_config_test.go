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

// TestReplicateCVMForwardsOSImage covers replica OS image selection: the
// replica can be pinned to a specific image instead of inheriting the source
// CVM's one.
func TestReplicateCVMForwardsOSImage(t *testing.T) {
	var body map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cvms/cvm-123/replicas" {
			t.Errorf("path = %q, want /cvms/cvm-123/replicas", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"cvm_ykL5lbAn","name":"cvm-1","status":"starting"}`))
	}))
	defer srv.Close()

	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}

	nodeID := 42
	if _, err := client.ReplicateCVM(context.Background(), "cvm-123", &ReplicateCVMOptions{
		NodeID:  &nodeID,
		OSImage: "dstack-0.5.4",
	}); err != nil {
		t.Fatalf("ReplicateCVM: %v", err)
	}
	if got := body["os_image"]; got != "dstack-0.5.4" {
		t.Fatalf("os_image = %v, want dstack-0.5.4", got)
	}

	body = nil
	if _, err := client.ReplicateCVM(context.Background(), "cvm-123", &ReplicateCVMOptions{
		NodeID: &nodeID,
	}); err != nil {
		t.Fatalf("ReplicateCVM without OS image: %v", err)
	}
	if _, ok := body["os_image"]; ok {
		t.Fatal("os_image present in the body when unset, want it omitted")
	}
}

// TestProvisionComposeUpdateComposeUnchanged covers the no-op signal returned
// when the submitted compose matches the deployed one.
func TestProvisionComposeUpdateComposeUnchanged(t *testing.T) {
	var resp ProvisionCVMResponse
	if err := json.Unmarshal([]byte(`{"app_id":"app-1","compose_hash":"abc"}`), &resp); err != nil {
		t.Fatalf("unmarshal provision response: %v", err)
	}
	if resp.ComposeUnchanged {
		t.Fatal("ComposeUnchanged = true when absent from the payload, want false")
	}

	if err := json.Unmarshal([]byte(`{"app_id":"app-1","compose_hash":"abc","compose_unchanged":true}`), &resp); err != nil {
		t.Fatalf("unmarshal provision response with compose_unchanged: %v", err)
	}
	if !resp.ComposeUnchanged {
		t.Fatal("ComposeUnchanged = false, want true")
	}
}
