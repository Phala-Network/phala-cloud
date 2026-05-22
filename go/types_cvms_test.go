package phala

import (
	"encoding/json"
	"testing"
)

func TestCvmKmsInfo_ChainName(t *testing.T) {
	tests := []struct {
		name    string
		chainID *int
		want    string
	}{
		{"base", intPtr(8453), "Base"},
		{"mainnet", intPtr(1), "Ethereum"},
		{"anvil", intPtr(31337), "Anvil"},
		{"unknown", intPtr(99999), ""},
		{"nil", nil, ""},
		{"nil receiver", nil, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var k *CvmKmsInfo
			if tt.name != "nil receiver" {
				k = &CvmKmsInfo{ChainID: tt.chainID}
			}
			if got := k.ChainName(); got != tt.want {
				t.Errorf("ChainName() = %q, want %q", got, tt.want)
			}
		})
	}
}

func intPtr(v int) *int {
	return &v
}

func TestCVMHashIDVersionContracts(t *testing.T) {
	t.Run("CVM info", func(t *testing.T) {
		var oldInfo CVMInfoV20260121
		if err := json.Unmarshal([]byte(`{"id":123,"name":"cvm-1","resource":{},"status":"running"}`), &oldInfo); err != nil {
			t.Fatalf("unmarshal old CVM info: %v", err)
		}
		if oldInfo.ID != 123 {
			t.Fatalf("old CVM ID = %d, want 123", oldInfo.ID)
		}

		var latestInfo CVMInfo
		if err := json.Unmarshal([]byte(`{"id":"cvm_ykL5lbAn","name":"cvm-1","resource":{},"status":"running"}`), &latestInfo); err != nil {
			t.Fatalf("unmarshal latest CVM info: %v", err)
		}
		if latestInfo.ID != "cvm_ykL5lbAn" {
			t.Fatalf("latest CVM ID = %q, want cvm_ykL5lbAn", latestInfo.ID)
		}
		if err := json.Unmarshal([]byte(`{"id":123,"name":"cvm-1","resource":{},"status":"running"}`), &latestInfo); err == nil {
			t.Fatal("latest CVM info accepted numeric ID")
		}
	})

	t.Run("action responses", func(t *testing.T) {
		var oldProvision CommitCVMProvisionResponseV20260121
		if err := json.Unmarshal([]byte(`{"id":123,"name":"cvm-1","status":"running"}`), &oldProvision); err != nil {
			t.Fatalf("unmarshal old provision response: %v", err)
		}
		var latestProvision CommitCVMProvisionResponse
		if err := json.Unmarshal([]byte(`{"id":"cvm_ykL5lbAn","name":"cvm-1","status":"running"}`), &latestProvision); err != nil {
			t.Fatalf("unmarshal latest provision response: %v", err)
		}
		if err := json.Unmarshal([]byte(`{"id":123,"name":"cvm-1","status":"running"}`), &latestProvision); err == nil {
			t.Fatal("latest provision response accepted numeric ID")
		}

		var oldAction CVMActionResponseV20260121
		if err := json.Unmarshal([]byte(`{"id":123,"status":"running"}`), &oldAction); err != nil {
			t.Fatalf("unmarshal old action response: %v", err)
		}
		var latestAction CVMActionResponse
		if err := json.Unmarshal([]byte(`{"id":"cvm_ykL5lbAn","status":"running"}`), &latestAction); err != nil {
			t.Fatalf("unmarshal latest action response: %v", err)
		}
		if err := json.Unmarshal([]byte(`{"id":123,"status":"running"}`), &latestAction); err == nil {
			t.Fatal("latest action response accepted numeric ID")
		}
	})

	t.Run("allowance responses", func(t *testing.T) {
		oldPayload := []byte(`{
			"cvm_id":123,
			"app_contract_address":"0x123",
			"compose_hash":"compose-hash",
			"device_id":"dev-1",
			"compose_hash_allowed":true,
			"allow_any_device":false,
			"device_id_allowed":true,
			"is_allowed":true
		}`)
		latestPayload := []byte(`{
			"cvm_id":"cvm_ykL5lbAn",
			"app_contract_address":"0x123",
			"compose_hash":"compose-hash",
			"device_id":"dev-1",
			"compose_hash_allowed":true,
			"allow_any_device":false,
			"device_id_allowed":true,
			"is_allowed":true
		}`)

		var oldResult IsAllowedResultV20260121
		if err := json.Unmarshal(oldPayload, &oldResult); err != nil {
			t.Fatalf("unmarshal old allowance result: %v", err)
		}
		var latestResult IsAllowedResult
		if err := json.Unmarshal(latestPayload, &latestResult); err != nil {
			t.Fatalf("unmarshal latest allowance result: %v", err)
		}
		if err := json.Unmarshal(oldPayload, &latestResult); err == nil {
			t.Fatal("latest allowance result accepted numeric CVM ID")
		}
	})

	t.Run("batch and device responses", func(t *testing.T) {
		var oldBatch AppCvmsBatchIsAllowedResponseV20260121
		if err := json.Unmarshal([]byte(`{"is_onchain":true,"results":[],"skipped_cvm_ids":[123]}`), &oldBatch); err != nil {
			t.Fatalf("unmarshal old batch allowance: %v", err)
		}
		var latestBatch AppCvmsBatchIsAllowedResponse
		if err := json.Unmarshal([]byte(`{"is_onchain":true,"results":[],"skipped_cvm_ids":["cvm_ykL5lbAn"]}`), &latestBatch); err != nil {
			t.Fatalf("unmarshal latest batch allowance: %v", err)
		}
		if err := json.Unmarshal([]byte(`{"is_onchain":true,"results":[],"skipped_cvm_ids":[123]}`), &latestBatch); err == nil {
			t.Fatal("latest batch allowance accepted numeric skipped CVM ID")
		}

		var oldAllowlist DeviceAllowlistResponseV20260121
		if err := json.Unmarshal([]byte(`{"is_onchain_kms":true,"devices":[{"device_id":"dev-1","allowed_onchain":true,"status":"allowed","cvm_ids":[123]}]}`), &oldAllowlist); err != nil {
			t.Fatalf("unmarshal old device allowlist: %v", err)
		}
		var latestAllowlist DeviceAllowlistResponse
		if err := json.Unmarshal([]byte(`{"is_onchain_kms":true,"devices":[{"device_id":"dev-1","allowed_onchain":true,"status":"allowed","cvm_ids":["cvm_ykL5lbAn"]}]}`), &latestAllowlist); err != nil {
			t.Fatalf("unmarshal latest device allowlist: %v", err)
		}
		if err := json.Unmarshal([]byte(`{"is_onchain_kms":true,"devices":[{"device_id":"dev-1","allowed_onchain":true,"status":"allowed","cvm_ids":[123]}]}`), &latestAllowlist); err == nil {
			t.Fatal("latest device allowlist accepted numeric CVM ID")
		}
	})

	t.Run("refresh instance ID responses", func(t *testing.T) {
		oldPayload := []byte(`{"cvm_id":123,"identifier":"123","status":"updated","source":"teepod_state","verified_with_gateway":false}`)
		latestPayload := []byte(`{"cvm_id":"cvm_ykL5lbAn","identifier":"cvm_ykL5lbAn","status":"updated","source":"teepod_state","verified_with_gateway":false}`)

		var oldRefresh RefreshInstanceIDResponseV20260121
		if err := json.Unmarshal(oldPayload, &oldRefresh); err != nil {
			t.Fatalf("unmarshal old refresh response: %v", err)
		}
		var latestRefresh RefreshInstanceIDResponse
		if err := json.Unmarshal(latestPayload, &latestRefresh); err != nil {
			t.Fatalf("unmarshal latest refresh response: %v", err)
		}
		if err := json.Unmarshal(oldPayload, &latestRefresh); err == nil {
			t.Fatal("latest refresh response accepted numeric CVM ID")
		}

		var oldBatch RefreshInstanceIDsResponseV20260121
		if err := json.Unmarshal([]byte(`{"total":1,"scanned":1,"updated":1,"unchanged":0,"skipped":0,"conflicts":0,"errors":0,"items":[{"cvm_id":123,"identifier":"123","status":"updated","source":"teepod_state","verified_with_gateway":false}]}`), &oldBatch); err != nil {
			t.Fatalf("unmarshal old refresh batch: %v", err)
		}
		var latestBatch RefreshInstanceIDsResponse
		if err := json.Unmarshal([]byte(`{"total":1,"scanned":1,"updated":1,"unchanged":0,"skipped":0,"conflicts":0,"errors":0,"items":[{"cvm_id":"cvm_ykL5lbAn","identifier":"cvm_ykL5lbAn","status":"updated","source":"teepod_state","verified_with_gateway":false}]}`), &latestBatch); err != nil {
			t.Fatalf("unmarshal latest refresh batch: %v", err)
		}
		if err := json.Unmarshal([]byte(`{"total":1,"scanned":1,"updated":1,"unchanged":0,"skipped":0,"conflicts":0,"errors":0,"items":[{"cvm_id":123,"identifier":"123","status":"updated","source":"teepod_state","verified_with_gateway":false}]}`), &latestBatch); err == nil {
			t.Fatal("latest refresh batch accepted numeric CVM ID")
		}
	})
}
