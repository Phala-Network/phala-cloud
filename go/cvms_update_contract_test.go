package phala

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
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
		ShutdownTimeout: PatchValue(60),
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

func TestPatchCVMSendsAnEmptyPatchAndSurfacesTheBackendError(t *testing.T) {
	client, seen := recordingServer(t, http.StatusBadRequest, `{"detail":"No update fields provided"}`)
	_, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{})
	var apiErr *APIError
	if !errors.As(err, &apiErr) || apiErr.StatusCode != http.StatusBadRequest {
		t.Fatalf("err = %v, want *APIError 400", err)
	}
	if len(*seen) != 1 || (*seen)[0].method != "PATCH" || (*seen)[0].path != "/cvms/cvm-1" {
		t.Fatalf("requests = %+v, want one PATCH /cvms/cvm-1", *seen)
	}
	assertBody(t, (*seen)[0].body, `{}`)
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

func TestPatchCVMResponseDecodesFinalityWait(t *testing.T) {
	client, _ := recordingServer(t, http.StatusAccepted, `{"status":"in_progress","message":"accepted","correlation_id":"corr-3","finality_wait":{"operation":"update","correlation_id":"corr-3","phase":"awaiting_finality","stage":"submitted","transaction":null,"finality":{"block_tag":"latest","policy_block_number":9,"blocks_remaining":1,"eta_seconds":5}}}`)
	got, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{PublicLogs: Bool(true)})
	if err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	if got.FinalityWait == nil || got.FinalityWait.CorrelationID != "corr-3" {
		t.Fatalf("finality_wait = %+v", got.FinalityWait)
	}
}

func TestPatchCVMSendsGuestAgentGatewayAccess(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, acceptedUpdate)
	closed := "closed"
	if _, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{
		GuestAgentGatewayAccess: &closed,
	}); err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	assertBody(t, (*seen)[0].body, `{"guest_agent_gateway_access": "closed"}`)
}

func TestPatchCVMSendsNullShutdownTimeout(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, acceptedUpdate)
	if _, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{
		ShutdownTimeout: PatchNull[int](),
	}); err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	assertBody(t, (*seen)[0].body, `{"shutdown_timeout": null}`)
}

func TestPatchCVMSendsTheComposeMergePatch(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, acceptedUpdate)
	_, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{
		Compose: &ComposePatch{
			SecureTime:     PatchValue(true),
			SwapSize:       PatchNull[string](),
			GatewayEnabled: PatchValue(false),
			PortPolicy: PatchValue(ComposePortPolicy{
				Ports:        []ComposePortAttr{{Port: 443, PP: true}},
				RestrictMode: Bool(true),
			}),
			EventLogVersion: PatchValue(2),
			Requirements: PatchValue(ComposeRequirementsPatch{
				EphemeralDataDisk: PatchValue(true),
				HealthCheck:       PatchValue(false),
				Platforms:         PatchNull[[]string](),
			}),
		},
		InitScripts:     []InitScriptSlug{InitScriptDockerCleanup},
		ConfirmDataWipe: true,
	})
	if err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	// Null removes a key, unset keys stay absent, explicit defaults are sent.
	assertBody(t, (*seen)[0].body, `{
		"compose": {
			"secure_time": true,
			"swap_size": null,
			"gateway_enabled": false,
			"port_policy": {"ports": [{"port": 443, "pp": true}], "restrict_mode": true},
			"event_log_version": 2,
			"requirements": {"ephemeral_data_disk": true, "health_check": false, "platforms": null}
		},
		"init_scripts": ["docker_cleanup"],
		"confirm_data_wipe": true
	}`)
}

func TestPatchCVMSendsTheBashScript(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, acceptedUpdate)
	if _, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{
		Compose: &ComposePatch{BashScript: PatchValue("echo hi")},
	}); err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	assertBody(t, (*seen)[0].body, `{"compose": {"bash_script": "echo hi"}}`)
}

func TestPatchCVMSendsAnInitScriptNameItDoesNotKnow(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, acceptedUpdate)
	if _, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{
		InitScripts: []InitScriptSlug{"future_script"},
	}); err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	assertBody(t, (*seen)[0].body, `{"init_scripts": ["future_script"]}`)
}

func TestPatchCVMSendsAnEmptyInitScriptSet(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, acceptedUpdate)
	if _, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{
		InitScripts: []InitScriptSlug{},
		Compose:     &ComposePatch{Requirements: PatchNull[ComposeRequirementsPatch]()},
	}); err != nil {
		t.Fatalf("PatchCVM: %v", err)
	}
	assertBody(t, (*seen)[0].body, `{"init_scripts": [], "compose": {"requirements": null}}`)
}

const commitFinalityBody = `{"status":"in_progress","message":"accepted","correlation_id":"corr-7","finality_wait":{"operation":"update","correlation_id":"corr-7","phase":"awaiting_finality","stage":"submitted","transaction":null,"finality":{"block_tag":"latest","policy_block_number":9,"blocks_remaining":1,"eta_seconds":5}}}`

func TestCommitCVMComposeFileUpdateReturnsAcceptedUpdate(t *testing.T) {
	client, _ := recordingServer(t, http.StatusAccepted, commitFinalityBody)
	got, err := client.CommitCVMComposeFileUpdate(context.Background(), "cvm-1", &CommitComposeUpdateRequest{ComposeHash: "h"})
	if err != nil {
		t.Fatalf("CommitCVMComposeFileUpdate: %v", err)
	}
	if got == nil || got.CorrelationID != "corr-7" || got.Status != "in_progress" {
		t.Fatalf("response = %+v", got)
	}
	if got.FinalityWait == nil || got.FinalityCorrelationID() != "corr-7" {
		t.Fatalf("finality_wait = %+v", got.FinalityWait)
	}
}

func TestUpdateCallsReturnNilForAnEmptyOrNullBody(t *testing.T) {
	calls := map[string]func(*Client) (*PatchCVMResponse, error){
		"CommitCVMComposeFileUpdate": func(c *Client) (*PatchCVMResponse, error) {
			return c.CommitCVMComposeFileUpdate(context.Background(), "cvm-1", &CommitComposeUpdateRequest{ComposeHash: "h"})
		},
		"UpdateOSImage": func(c *Client) (*PatchCVMResponse, error) {
			return c.UpdateOSImage(context.Background(), "cvm-1", &UpdateOSImageRequest{OSImageName: "img"})
		},
	}
	for name, call := range calls {
		for _, body := range []string{"", "null"} {
			client, _ := recordingServer(t, http.StatusAccepted, body)
			got, err := call(client)
			if err != nil {
				t.Fatalf("%s with body %q: %v", name, body, err)
			}
			if got != nil {
				t.Fatalf("%s with body %q = %+v, want nil", name, body, got)
			}
		}
	}
}

func TestCommitCVMComposeFileUpdateTransactionHash(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, commitFinalityBody)
	if _, err := client.CommitCVMComposeFileUpdate(context.Background(), "cvm-1", &CommitComposeUpdateRequest{ComposeHash: "h", TransactionHash: "0xabc"}); err != nil {
		t.Fatal(err)
	}
	assertBody(t, (*seen)[0].body, `{"compose_hash":"h","transaction_hash":"0xabc"}`)

	client, seen = recordingServer(t, http.StatusAccepted, commitFinalityBody)
	if _, err := client.CommitCVMComposeFileUpdate(context.Background(), "cvm-1", &CommitComposeUpdateRequest{ComposeHash: "h"}); err != nil {
		t.Fatal(err)
	}
	if _, ok := (*seen)[0].body["transaction_hash"]; ok {
		t.Fatalf("transaction_hash present in %s", (*seen)[0].rawBody)
	}
}

func TestUpdateOSImageReturnsAcceptedUpdate(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, `{"message":"accepted","correlation_id":"corr-8","status":"in_progress"}`)
	got, err := client.UpdateOSImage(context.Background(), "cvm-1", &UpdateOSImageRequest{OSImageName: "img"})
	if err != nil {
		t.Fatalf("UpdateOSImage: %v", err)
	}
	if got == nil || got.CorrelationID != "corr-8" || got.Status != "in_progress" || got.Message != "accepted" {
		t.Fatalf("response = %+v", got)
	}
	if (*seen)[0].path != "/cvms/cvm-1/os-image" {
		t.Fatalf("path = %s", (*seen)[0].path)
	}
}
