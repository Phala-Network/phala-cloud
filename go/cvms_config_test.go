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

// TestUpdateResultNoChangeStatus covers the no-op variant of the compose and
// pre-launch script update responses. Without a Status field the whole payload
// decoded to a zero UpdateResult, indistinguishable from an accepted update.
func TestUpdateResultNoChangeStatus(t *testing.T) {
	var noChange UpdateResult
	if err := json.Unmarshal([]byte(`{"status":"no_change","message":"compose unchanged"}`), &noChange); err != nil {
		t.Fatalf("unmarshal no_change result: %v", err)
	}
	if noChange.Status != UpdateStatusNoChange {
		t.Fatalf("Status = %q, want %q", noChange.Status, UpdateStatusNoChange)
	}
	if noChange.Message != "compose unchanged" {
		t.Fatalf("Message = %q, want %q", noChange.Message, "compose unchanged")
	}

	var inProgress UpdateResult
	if err := json.Unmarshal([]byte(`{"status":"in_progress","message":"queued","correlation_id":"corr-1"}`), &inProgress); err != nil {
		t.Fatalf("unmarshal in_progress result: %v", err)
	}
	if inProgress.Status != UpdateStatusInProgress {
		t.Fatalf("Status = %q, want %q", inProgress.Status, UpdateStatusInProgress)
	}
	if inProgress.CorrelationID != "corr-1" {
		t.Fatalf("CorrelationID = %q, want corr-1", inProgress.CorrelationID)
	}
}

func TestGetPreLaunchScriptUpgradeStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("method = %q, want GET", r.Method)
		}
		if r.URL.Path != "/cvms/cvm-123/pre-launch-script/upgrade-status" {
			t.Errorf("path = %q, want /cvms/cvm-123/pre-launch-script/upgrade-status", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"current_hash":"aaa","latest_official_hash":"bbb","is_official":true,"is_latest":false,"can_upgrade":true}`))
	}))
	defer srv.Close()

	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}

	status, err := client.GetPreLaunchScriptUpgradeStatus(context.Background(), "cvm-123")
	if err != nil {
		t.Fatalf("GetPreLaunchScriptUpgradeStatus: %v", err)
	}
	if !status.CanUpgrade {
		t.Fatal("CanUpgrade = false, want true")
	}
	if status.IsLatest {
		t.Fatal("IsLatest = true, want false")
	}
	if status.CurrentHash == nil || *status.CurrentHash != "aaa" {
		t.Fatalf("CurrentHash = %v, want aaa", status.CurrentHash)
	}
	if status.LatestOfficialHash != "bbb" {
		t.Fatalf("LatestOfficialHash = %q, want bbb", status.LatestOfficialHash)
	}
}

func TestUpgradePreLaunchScriptPhases(t *testing.T) {
	var gotComposeHash, gotTxHash, gotMethod, gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotComposeHash = r.Header.Get("X-Compose-Hash")
		gotTxHash = r.Header.Get("X-Transaction-Hash")
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"status":"in_progress","message":"queued","correlation_id":"corr-1"}`))
	}))
	defer srv.Close()

	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}

	// Phase 1: no verification headers.
	result, err := client.UpgradePreLaunchScript(context.Background(), "cvm-123", nil)
	if err != nil {
		t.Fatalf("UpgradePreLaunchScript phase 1: %v", err)
	}
	if gotMethod != "POST" {
		t.Errorf("method = %q, want POST", gotMethod)
	}
	if gotPath != "/cvms/cvm-123/pre-launch-script/upgrade-to-latest-official" {
		t.Errorf("path = %q, want the upgrade-to-latest-official path", gotPath)
	}
	if gotComposeHash != "" || gotTxHash != "" {
		t.Errorf("verification headers sent in phase 1: %q / %q", gotComposeHash, gotTxHash)
	}
	if result.Status != UpdateStatusInProgress {
		t.Errorf("Status = %q, want %q", result.Status, UpdateStatusInProgress)
	}
	if result.CorrelationID != "corr-1" {
		t.Errorf("CorrelationID = %q, want corr-1", result.CorrelationID)
	}

	// Phase 2: retry with the on-chain registration proof.
	if _, err := client.UpgradePreLaunchScript(context.Background(), "cvm-123", &ComposeUpdateOptions{
		ComposeHash:     "hash-1",
		TransactionHash: "0xtx",
	}); err != nil {
		t.Fatalf("UpgradePreLaunchScript phase 2: %v", err)
	}
	if gotComposeHash != "hash-1" {
		t.Errorf("X-Compose-Hash = %q, want hash-1", gotComposeHash)
	}
	if gotTxHash != "0xtx" {
		t.Errorf("X-Transaction-Hash = %q, want 0xtx", gotTxHash)
	}
}

func TestUpgradePreLaunchScriptSurfaces465(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(465)
		_, _ = w.Write([]byte(`{"message":"Compose hash verification required","details":[{"field":"compose_hash","value":"hash-1"},{"field":"app_id","value":"app-1"}]}`))
	}))
	defer srv.Close()

	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}

	_, err = client.UpgradePreLaunchScript(context.Background(), "cvm-123", nil)
	if err == nil {
		t.Fatal("UpgradePreLaunchScript returned no error on 465")
	}
	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("error type = %T, want *APIError", err)
	}
	if !apiErr.IsComposePrecondition() {
		t.Fatal("IsComposePrecondition() = false, want true")
	}
	precondition, ok := apiErr.ComposePrecondition()
	if !ok {
		t.Fatal("ComposePrecondition() reported no structured payload")
	}
	if precondition.ComposeHash != "hash-1" || precondition.AppID != "app-1" {
		t.Fatalf("ComposePrecondition() = %+v, want compose_hash hash-1 / app_id app-1", precondition)
	}
}
