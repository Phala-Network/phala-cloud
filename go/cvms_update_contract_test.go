package phala

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
)

type recordedRequest struct {
	method  string
	path    string
	header  http.Header
	body    map[string]any
	rawBody string
}

// recordingServer answers every request with status and payload and records
// what reached the wire.
func recordingServer(t *testing.T, status int, payload string) (*Client, *[]recordedRequest) {
	t.Helper()
	var seen []recordedRequest
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		rec := recordedRequest{method: r.Method, path: r.URL.Path, header: r.Header.Clone(), rawBody: string(raw)}
		if len(raw) > 0 {
			if err := json.Unmarshal(raw, &rec.body); err != nil {
				t.Errorf("decode body %q: %v", raw, err)
			}
		}
		seen = append(seen, rec)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(payload))
	}))
	t.Cleanup(srv.Close)
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL), WithMaxRetries(0))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	return client, &seen
}

func assertBody(t *testing.T, got map[string]any, wantJSON string) {
	t.Helper()
	var want map[string]any
	if err := json.Unmarshal([]byte(wantJSON), &want); err != nil {
		t.Fatalf("bad want JSON: %v", err)
	}
	if !reflect.DeepEqual(got, want) {
		gotJSON, _ := json.Marshal(got)
		t.Fatalf("body = %s, want %s", gotJSON, wantJSON)
	}
}

const acceptedUpdate = `{"message":"CVM update initiated","correlation_id":"corr-1","status":"in_progress"}`

func TestPatchCVMSendsOnlyFieldsTheAPIAccepts(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, acceptedUpdate)
	userConfig := `{"hostname":"x"}`
	image := "dstack-0.5.5"
	resp, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{
		UserConfig: &userConfig,
		GPUs: &GPUConfig{
			GPUs:       []GPUSpec{{Slot: "0000:18:00.0", ProductID: String("10de:2335")}, {Slot: "0000:2a:00.0"}},
			AttachMode: String("listed"),
		},
		InstanceType:    String("h200.small"),
		Image:           &image,
		ShutdownTimeout: Int(60),
		AllowForceStop:  Bool(true),
	})
	if err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	if len(*seen) != 1 {
		t.Fatalf("requests = %d, want 1", len(*seen))
	}
	got := (*seen)[0]
	if got.method != "PATCH" || got.path != "/cvms/cvm-1" {
		t.Fatalf("request = %s %s, want PATCH /cvms/cvm-1", got.method, got.path)
	}
	assertBody(t, got.body, `{
		"user_config": "{\"hostname\":\"x\"}",
		"gpus": {"gpus": [{"slot": "0000:18:00.0", "product_id": "10de:2335"}, {"slot": "0000:2a:00.0"}], "attach_mode": "listed"},
		"instance_type": "h200.small",
		"image": "dstack-0.5.5",
		"shutdown_timeout": 60,
		"allow_force_stop": true
	}`)
	if got.header.Get("X-Prepare-Only") != "" {
		t.Fatalf("X-Prepare-Only = %q, want unset", got.header.Get("X-Prepare-Only"))
	}
	if resp.RequiresOnChainHash || resp.CorrelationID != "corr-1" {
		t.Fatalf("resp = %+v", resp)
	}
}

func TestPatchCVMMapsOSImageNameToImage(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, acceptedUpdate)
	if _, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{OSImageName: String("dstack-0.5.5")}); err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	assertBody(t, (*seen)[0].body, `{"image": "dstack-0.5.5"}`)
}

func TestPatchCVMRejectsConflictingImageNames(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, acceptedUpdate)
	_, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{
		Image:       String("dstack-0.5.5"),
		OSImageName: String("dstack-0.5.4"),
	})
	if err == nil {
		t.Fatal("PatchCVM: want error for conflicting Image and OSImageName")
	}
	if len(*seen) != 0 {
		t.Fatalf("requests = %d, want 0", len(*seen))
	}
}

func TestPatchCVMSendsListedThroughTheListedEndpointAfterThePatch(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, acceptedUpdate)
	if _, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{
		Listed: Bool(true),
		VCPU:   Int(4),
	}); err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	if len(*seen) != 2 {
		t.Fatalf("requests = %d, want 2", len(*seen))
	}
	patch, listed := (*seen)[0], (*seen)[1]
	if patch.path != "/cvms/cvm-1" {
		t.Fatalf("first request path = %s, want /cvms/cvm-1", patch.path)
	}
	assertBody(t, patch.body, `{"vcpu": 4}`)
	if listed.method != "PATCH" || listed.path != "/cvms/cvm-1/listed" {
		t.Fatalf("second request = %s %s, want PATCH /cvms/cvm-1/listed", listed.method, listed.path)
	}
	assertBody(t, listed.body, `{"listed": true}`)
}

func TestPatchCVMDoesNotTouchListedWhenThePatchFails(t *testing.T) {
	client, seen := recordingServer(t, http.StatusBadRequest, `{"detail":"bad request"}`)
	if _, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{
		Listed: Bool(true),
		VCPU:   Int(4),
	}); err == nil {
		t.Fatal("PatchCVM: want error for 400")
	}
	if len(*seen) != 1 || (*seen)[0].path != "/cvms/cvm-1" {
		t.Fatalf("requests = %+v, want only PATCH /cvms/cvm-1", *seen)
	}
}

func TestPatchCVMAppliesListedAfterA465Result(t *testing.T) {
	var paths []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/cvms/cvm-1" {
			w.WriteHeader(465)
			_, _ = w.Write([]byte(hashRequired))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	t.Cleanup(srv.Close)
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL), WithMaxRetries(0))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	resp, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{Listed: Bool(true), PublicLogs: Bool(true)})
	if err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	if !resp.RequiresOnChainHash {
		t.Fatal("RequiresOnChainHash = false, want true")
	}
	if !reflect.DeepEqual(paths, []string{"/cvms/cvm-1", "/cvms/cvm-1/listed"}) {
		t.Fatalf("paths = %v", paths)
	}
}

func TestPatchCVMWrapsAListedFailureAfterTheAcceptedPatch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/cvms/cvm-1/listed" {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"detail":"boom"}`))
			return
		}
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(acceptedUpdate))
	}))
	t.Cleanup(srv.Close)
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL), WithMaxRetries(0))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	_, err = client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{Listed: Bool(true), VCPU: Int(4)})
	if err == nil {
		t.Fatal("PatchCVM: want error when listed fails")
	}
	if !strings.Contains(err.Error(), "already accepted") {
		t.Fatalf("err = %v, want it to state the patch was already accepted", err)
	}
	var apiErr *APIError
	if !errors.As(err, &apiErr) || apiErr.StatusCode != http.StatusInternalServerError {
		t.Fatalf("err = %v, want wrapped *APIError 500", err)
	}
}

func TestPatchCVMListedWithBehaviorFieldsOnlySkipsTheUnifiedPatch(t *testing.T) {
	client, seen := recordingServer(t, http.StatusOK, `{}`)
	if _, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{
		Listed:          Bool(true),
		ShutdownTimeout: Int(60),
		AllowForceStop:  Bool(true),
	}); err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	if len(*seen) != 1 || (*seen)[0].path != "/cvms/cvm-1/listed" {
		t.Fatalf("requests = %+v, want only PATCH /cvms/cvm-1/listed", *seen)
	}
}

func TestPatchCVMWithOnlyListedSkipsTheUnifiedPatch(t *testing.T) {
	client, seen := recordingServer(t, http.StatusOK, `{}`)
	resp, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{Listed: Bool(false)})
	if err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	if len(*seen) != 1 || (*seen)[0].path != "/cvms/cvm-1/listed" {
		t.Fatalf("requests = %+v, want only PATCH /cvms/cvm-1/listed", *seen)
	}
	assertBody(t, (*seen)[0].body, `{"listed": false}`)
	if resp.RequiresOnChainHash || resp.CorrelationID != "" {
		t.Fatalf("resp = %+v", resp)
	}
}

const hashRequired = `{
	"error_code": "ERR-01-005",
	"message": "Compose hash registration required",
	"details": [
		{"field": "compose_hash", "value": "abc123"},
		{"field": "app_id", "value": "app-1"},
		{"field": "device_id", "value": "dev-1"},
		{"field": "kms_info", "value": {"chain_id": 8453}},
		{"field": "commit_token", "value": "token-1"},
		{"field": "commit_url", "value": "https://cloud.phala.com/commit/token-1"},
		{"field": "api_commit_url", "value": "https://cloud-api.phala.com/api/v1/commit/token-1"},
		{"field": "onchain_status", "value": {"compose_hash_allowed": false, "device_id_allowed": true, "is_allowed": false}}
	]
}`

func TestPatchCVMPrepareOnlyMaps465ToHashRequired(t *testing.T) {
	client, seen := recordingServer(t, 465, hashRequired)
	resp, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{
		PublicLogs:  Bool(true),
		PrepareOnly: true,
	})
	if err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	got := (*seen)[0]
	if got.header.Get("X-Prepare-Only") != "true" {
		t.Fatalf("X-Prepare-Only = %q, want true", got.header.Get("X-Prepare-Only"))
	}
	assertBody(t, got.body, `{"public_logs": true}`)

	if !resp.RequiresOnChainHash {
		t.Fatal("RequiresOnChainHash = false, want true")
	}
	if resp.ComposeHash != "abc123" || resp.AppID != "app-1" || resp.DeviceID != "dev-1" {
		t.Fatalf("resp = %+v", resp)
	}
	if resp.KMSInfo == nil || resp.KMSInfo.ChainID == nil || *resp.KMSInfo.ChainID != 8453 {
		t.Fatalf("KMSInfo = %+v", resp.KMSInfo)
	}
	if resp.CommitToken != "token-1" ||
		resp.CommitURL != "https://cloud.phala.com/commit/token-1" ||
		resp.APICommitURL != "https://cloud-api.phala.com/api/v1/commit/token-1" {
		t.Fatalf("commit fields = %+v", resp)
	}
	want := &OnchainStatus{ComposeHashAllowed: false, DeviceIDAllowed: true, IsAllowed: false}
	if !reflect.DeepEqual(resp.OnchainStatus, want) {
		t.Fatalf("OnchainStatus = %+v, want %+v", resp.OnchainStatus, want)
	}
}

func TestPatchCVMReturnsOtherErrors(t *testing.T) {
	client, _ := recordingServer(t, http.StatusConflict, `{"detail":"Another operation is already in progress for this CVM"}`)
	_, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{VCPU: Int(2)})
	if err == nil {
		t.Fatal("PatchCVM: want error for 409")
	}
}

func TestUpdateCVMResourcesDoesNotSendAllowRestart(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, acceptedUpdate)
	if _, err := client.UpdateCVMResources(context.Background(), "cvm-1", &UpdateResourcesRequest{
		VCPU:         Int(4),
		AllowRestart: Bool(true),
	}); err != nil {
		t.Fatalf("UpdateCVMResources: %v", err)
	}
	assertBody(t, (*seen)[0].body, `{"vcpu": 4}`)
}

func TestUpdateCVMVisibilityUsesTheUnifiedPatchEndpoint(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, acceptedUpdate)
	resp, err := client.UpdateCVMVisibility(context.Background(), "cvm-1", &UpdateVisibilityRequest{
		PublicSysinfo: Bool(true),
		PublicLogs:    Bool(false),
	})
	if err != nil {
		t.Fatalf("UpdateCVMVisibility: %v", err)
	}
	got := (*seen)[0]
	if got.method != "PATCH" || got.path != "/cvms/cvm-1" {
		t.Fatalf("request = %s %s, want PATCH /cvms/cvm-1", got.method, got.path)
	}
	assertBody(t, got.body, `{"public_sysinfo": true, "public_logs": false}`)
	if resp.CorrelationID != "corr-1" || resp.Status != "in_progress" {
		t.Fatalf("resp = %+v", resp)
	}
}

func TestPatchCVMAttachAllSendsAnEmptyGPUsArray(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, acceptedUpdate)
	if _, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{
		GPUs: &GPUConfig{AttachMode: String("all")},
	}); err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	assertBody(t, (*seen)[0].body, `{"gpus": {"gpus": [], "attach_mode": "all"}}`)
}

func TestPatchCVM465DecodesKMSContractAddress(t *testing.T) {
	client, _ := recordingServer(t, 465, `{
		"error_code": "ERR-01-005",
		"message": "Compose hash registration required",
		"details": [
			{"field": "compose_hash", "value": "abc123"},
			{"field": "kms_info", "value": {"id": "kms-1", "url": "https://kms", "version": "0.5.5", "chain_id": 8453, "kms_contract_address": "0xabc"}}
		]
	}`)
	resp, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{VCPU: Int(2)})
	if err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	if resp.KMSInfo == nil || resp.KMSInfo.KMSContractAddress == nil || *resp.KMSInfo.KMSContractAddress != "0xabc" {
		t.Fatalf("KMSInfo = %+v, want kms_contract_address 0xabc", resp.KMSInfo)
	}
}

func TestPatchCVM465WithoutComposeHashStaysAnAPIError(t *testing.T) {
	client, _ := recordingServer(t, 465, `{
		"error_code": "ERR-01-005",
		"message": "Compose hash registration required",
		"details": [{"field": "app_id", "value": "app-1"}]
	}`)
	resp, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{VCPU: Int(2)})
	if err == nil {
		t.Fatalf("PatchCVM: want error, got %+v", resp)
	}
	var apiErr *APIError
	if !errors.As(err, &apiErr) || apiErr.StatusCode != 465 {
		t.Fatalf("err = %v, want *APIError with status 465", err)
	}
}

func TestPatchCVM465FormatsAppID(t *testing.T) {
	tests := []struct {
		name  string
		value string
		want  string
	}{
		{"string as is", `"0xabc"`, "0xabc"},
		{"large number without exponent", `100000000000000000000`, "100000000000000000000"},
		{"integer number", `42`, "42"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, _ := recordingServer(t, 465, `{
				"error_code": "ERR-01-005",
				"message": "Compose hash registration required",
				"details": [{"field": "compose_hash", "value": "abc123"}, {"field": "app_id", "value": `+tt.value+`}]
			}`)
			resp, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{VCPU: Int(2)})
			if err != nil {
				t.Fatalf("PatchCVM: %v", err)
			}
			if resp.AppID != tt.want {
				t.Fatalf("AppID = %q, want %q", resp.AppID, tt.want)
			}
		})
	}
}
