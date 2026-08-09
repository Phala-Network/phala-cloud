package phala

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetCVMCreateResources(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("method = %q, want GET", r.Method)
		}
		if r.URL.Path != "/teepods/cvm-create-resources" {
			t.Errorf("path = %q, want /teepods/cvm-create-resources", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{
			"tier": "free",
			"capacity": {},
			"nodes": [
				{
					"teepod_id": 11,
					"name": "public-node",
					"listed": true,
					"resource_score": 1,
					"remaining_vcpu": 8,
					"remaining_memory": 16384,
					"remaining_cvm_slots": 4,
					"images": []
				}
			],
			"kms_nodes": [
				{
					"id": "kms_201",
					"slug": "kms-base",
					"url": "https://kms-base.example.com",
					"version": "0.5.0",
					"kms_type": "BASE",
					"chain_id": 8453,
					"kms_contract_id": "kc_301",
					"kms_contract_address": "0xbase",
					"gateway_app_id": "0xgateway",
					"supported_os_images": ["dstack-0.5.0"]
				}
			],
			"node_kms_relations": [
				{
					"teepod_id": 11,
					"kms_id": "kms_201",
					"kms_type": "BASE",
					"kms_contract_id": "kc_301",
					"kms_contract_address": "0xbase",
					"supported_os_images": ["dstack-0.5.0"]
				}
			],
			"gateway_nodes": [
				{
					"id": "gn_401",
					"teepod_id": 11,
					"kms_contract_id": "kc_301",
					"rpc_url": "https://gateway.example.com/rpc",
					"domain_suffix": "example.app",
					"enabled": true
				}
			],
			"instance_types": [
				{
					"id": "tdx.small",
					"name": "TDX Small",
					"vcpu": 2,
					"memory_mb": 4096,
					"default_disk_size_gb": 40,
					"requires_gpu": false,
					"requires_gpu_count": 0,
					"family": "cpu",
					"display_order": 1
				}
			],
			"gpu_availability": {
				"has_reserved_gpus": false,
				"reserved_gpu_count": 0,
				"has_public_gpus": true,
				"public_gpu_count": 1
			}
		}`)
	}))
	defer srv.Close()

	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}

	result, err := client.GetCVMCreateResources(context.Background())
	if err != nil {
		t.Fatalf("GetCVMCreateResources: %v", err)
	}
	if len(result.KMSNodes) != 1 {
		t.Fatalf("KMSNodes len = %d, want 1", len(result.KMSNodes))
	}
	if result.KMSNodes[0].KMSType != "BASE" {
		t.Errorf("KMSType = %q, want BASE", result.KMSNodes[0].KMSType)
	}
	if result.KMSNodes[0].ID != "kms_201" {
		t.Errorf("KMS ID = %q, want kms_201", result.KMSNodes[0].ID)
	}
	if result.KMSNodes[0].KMSContractID == nil || *result.KMSNodes[0].KMSContractID != "kc_301" {
		t.Errorf("KMSContractID = %v, want kc_301", result.KMSNodes[0].KMSContractID)
	}
	if result.GatewayNodes[0].Enabled != true {
		t.Errorf("Gateway enabled = %v, want true", result.GatewayNodes[0].Enabled)
	}
	if result.InstanceTypes[0].ID != "tdx.small" {
		t.Errorf("Instance type ID = %q, want tdx.small", result.InstanceTypes[0].ID)
	}
}

func TestCVMCreateResourcesV20260121NumericIDs(t *testing.T) {
	var result CVMCreateResourcesV20260121
	if err := json.Unmarshal([]byte(`{
		"tier": "free",
		"capacity": {},
		"nodes": [],
		"kms_nodes": [{"id": 201, "url": "https://kms.example.com", "kms_type": "BASE", "kms_contract_id": 301}],
		"node_kms_relations": [{"teepod_id": 11, "kms_id": 201, "kms_type": "BASE", "kms_contract_id": 301}],
		"gateway_nodes": [{"id": 401, "kms_contract_id": 301, "enabled": true}],
		"instance_types": [],
		"gpu_availability": {}
	}`), &result); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if id, ok := result.KMSNodes[0].ID.IntValue(); !ok || id != 201 {
		t.Errorf("KMS ID = %v/%v, want 201/true", id, ok)
	}
	if id, ok := result.GatewayNodes[0].KMSContractID.IntValue(); !ok || id != 301 {
		t.Errorf("KMSContractID = %v/%v, want 301/true", id, ok)
	}
}

func TestProvisionCVMRequest_MarshalResourceMatchingFields(t *testing.T) {
	req := ProvisionCVMRequest{
		Name:            "test-app",
		InstanceType:    "tdx.small",
		KMSID:           String("kms-base"),
		KMS:             String("BASE"),
		KMSContract:     String("0xbase"),
		KMSContractID:   IntKMSContractID(301),
		KeyProviderMode: String("local"),
		SkipGateway:     Bool(true),
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	var body struct {
		KMSID           string `json:"kms_id"`
		KMS             string `json:"kms"`
		KMSContract     string `json:"kms_contract"`
		KMSContractID   int    `json:"kms_contract_id"`
		KeyProviderMode string `json:"key_provider_mode"`
		SkipGateway     bool   `json:"skip_gateway"`
	}
	if err := json.Unmarshal(data, &body); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}

	if body.KMSID != "kms-base" {
		t.Errorf("kms_id = %q, want kms-base", body.KMSID)
	}
	if body.KMS != "BASE" {
		t.Errorf("kms = %q, want BASE", body.KMS)
	}
	if body.KMSContract != "0xbase" {
		t.Errorf("kms_contract = %q, want 0xbase", body.KMSContract)
	}
	if body.KMSContractID != 301 {
		t.Errorf("kms_contract_id = %d, want 301", body.KMSContractID)
	}
	if body.KeyProviderMode != "local" {
		t.Errorf("key_provider_mode = %q, want local", body.KeyProviderMode)
	}
	if !body.SkipGateway {
		t.Error("skip_gateway = false, want true")
	}
}

// TestDeviceIDEntryShape pins the current device_ids wire contract: an entry is
// keyed by (device_id, algorithm_version) alone. The os_image_ids list was
// dropped from the API and must not reappear in the struct.
func TestDeviceIDEntryShape(t *testing.T) {
	var entry DeviceIDEntry
	if err := json.Unmarshal([]byte(`{"device_id":"0xdev","algorithm_version":"v1","enabled":true}`), &entry); err != nil {
		t.Fatalf("unmarshal device ID entry: %v", err)
	}
	if entry.DeviceID != "0xdev" || entry.AlgorithmVersion != "v1" || !entry.Enabled {
		t.Fatalf("entry = %+v, want 0xdev / v1 / enabled", entry)
	}

	encoded, err := json.Marshal(entry)
	if err != nil {
		t.Fatalf("marshal device ID entry: %v", err)
	}
	var roundTripped map[string]any
	if err := json.Unmarshal(encoded, &roundTripped); err != nil {
		t.Fatalf("unmarshal round-tripped entry: %v", err)
	}
	if _, ok := roundTripped["os_image_ids"]; ok {
		t.Fatal("os_image_ids present in the encoded entry, want it gone")
	}
}
