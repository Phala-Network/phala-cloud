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
		if err := json.Unmarshal([]byte(`{"id":"cvm_ykL5lbAn","name":"cvm-1","resource":{},"status":"running"}`), &oldInfo); err != nil {
			t.Fatalf("unmarshal old CVM info: %v", err)
		}
		if oldInfo.ID != "cvm_ykL5lbAn" {
			t.Fatalf("old CVM ID = %q, want cvm_ykL5lbAn", oldInfo.ID)
		}
		if err := json.Unmarshal([]byte(`{"id":123,"name":"cvm-1","resource":{},"status":"running"}`), &oldInfo); err == nil {
			t.Fatal("old CVM info accepted numeric ID")
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

	t.Run("app info", func(t *testing.T) {
		var oldApp AppInfoV20260121
		if err := json.Unmarshal([]byte(`{
			"id":"04b927aa4ea8c9554ee9858538f181517714dbd2",
			"name":"app-1",
			"app_id":"app-1",
			"created_at":"2026-05-22T00:00:00Z",
			"kms_type":"phala",
			"current_cvm":{"id":"cvm_ykL5lbAn","name":"cvm-1","resource":{},"status":"running"},
			"cvms":[{"id":"cvm_ykL5lbAn","name":"cvm-1","resource":{},"status":"running"}],
			"cvm_count":1
		}`), &oldApp); err != nil {
			t.Fatalf("unmarshal old app info: %v", err)
		}
		if oldApp.CurrentCVM == nil || oldApp.CurrentCVM.ID != "cvm_ykL5lbAn" {
			t.Fatalf("old app current CVM ID = %#v, want cvm_ykL5lbAn", oldApp.CurrentCVM)
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

func TestCVMStatusBatchDeserialization(t *testing.T) {
	t.Run("full response with resource_usage and events", func(t *testing.T) {
		payload := []byte(`{
			"uuid-1": {
				"vm_uuid": "uuid-1",
				"status": "running",
				"in_progress": false,
				"uptime": "2h30m",
				"events": [{"event": "boot", "body": "kernel loaded", "timestamp": 1690000000}],
				"resource_usage": {
					"cpu_percent": 45.2,
					"memory_used_bytes": 2147483648,
					"memory_total_bytes": 4294967296,
					"egress_bytes": 1048576
				}
			},
			"uuid-2": {
				"vm_uuid": "uuid-2",
				"status": "maintenance",
				"in_progress": false,
				"events": [],
				"resource_usage": null
			}
		}`)

		var result map[string]CVMStatusEntry
		if err := json.Unmarshal(payload, &result); err != nil {
			t.Fatalf("unmarshal batch status: %v", err)
		}
		if len(result) != 2 {
			t.Fatalf("expected 2 entries, got %d", len(result))
		}

		entry1 := result["uuid-1"]
		if entry1.Status != "running" {
			t.Errorf("uuid-1 status = %q, want running", entry1.Status)
		}
		if len(entry1.Events) != 1 || entry1.Events[0].Event != "boot" {
			t.Errorf("uuid-1 events unexpected: %+v", entry1.Events)
		}
		if entry1.ResourceUsage == nil {
			t.Fatal("uuid-1 resource_usage should not be nil")
		}
		if *entry1.ResourceUsage.CPUPercent != 45.2 {
			t.Errorf("uuid-1 cpu_percent = %v, want 45.2", *entry1.ResourceUsage.CPUPercent)
		}
		if *entry1.ResourceUsage.MemoryUsedBytes != 2147483648 {
			t.Errorf("uuid-1 memory_used_bytes = %v, want 2147483648", *entry1.ResourceUsage.MemoryUsedBytes)
		}

		entry2 := result["uuid-2"]
		if entry2.Status != "maintenance" {
			t.Errorf("uuid-2 status = %q, want maintenance", entry2.Status)
		}
		if entry2.ResourceUsage != nil {
			t.Errorf("uuid-2 resource_usage should be nil, got %+v", entry2.ResourceUsage)
		}
	})

	t.Run("forward-compatible with unknown fields", func(t *testing.T) {
		payload := []byte(`{
			"uuid-1": {
				"vm_uuid": "uuid-1",
				"status": "running",
				"in_progress": false,
				"events": [],
				"future_field": "ignored",
				"resource_usage": {
					"cpu_percent": 10.0,
					"gpu_percent": 99.0
				}
			}
		}`)

		var result map[string]CVMStatusEntry
		if err := json.Unmarshal(payload, &result); err != nil {
			t.Fatalf("unmarshal should succeed with unknown fields: %v", err)
		}
		if result["uuid-1"].ResourceUsage == nil || *result["uuid-1"].ResourceUsage.CPUPercent != 10.0 {
			t.Errorf("expected cpu_percent=10.0, got %+v", result["uuid-1"].ResourceUsage)
		}
	})
}

func TestCVMInfoManagedEnv(t *testing.T) {
	var info CVMInfo
	if err := json.Unmarshal([]byte(`{"id":"cvm_ykL5lbAn","name":"cvm-1","resource":{},"status":"running"}`), &info); err != nil {
		t.Fatalf("unmarshal CVM info: %v", err)
	}
	if info.ManagedEnv {
		t.Fatal("ManagedEnv = true when absent from the payload, want false")
	}

	if err := json.Unmarshal([]byte(`{"id":"cvm_ykL5lbAn","name":"cvm-1","resource":{},"status":"running","managed_env":true}`), &info); err != nil {
		t.Fatalf("unmarshal CVM info with managed_env: %v", err)
	}
	if !info.ManagedEnv {
		t.Fatal("ManagedEnv = false, want true")
	}
}

func TestCVMResourceUsageDiskFields(t *testing.T) {
	var usage CVMResourceUsage
	if err := json.Unmarshal([]byte(`{"disk_used_bytes":1024,"disk_total_bytes":8192}`), &usage); err != nil {
		t.Fatalf("unmarshal resource usage: %v", err)
	}
	if usage.DiskUsedBytes == nil || *usage.DiskUsedBytes != 1024 {
		t.Fatalf("DiskUsedBytes = %v, want 1024", usage.DiskUsedBytes)
	}
	if usage.DiskTotalBytes == nil || *usage.DiskTotalBytes != 8192 {
		t.Fatalf("DiskTotalBytes = %v, want 8192", usage.DiskTotalBytes)
	}

	var absent CVMResourceUsage
	if err := json.Unmarshal([]byte(`{"cpu_percent":1.5}`), &absent); err != nil {
		t.Fatalf("unmarshal resource usage without disk fields: %v", err)
	}
	if absent.DiskUsedBytes != nil || absent.DiskTotalBytes != nil {
		t.Fatal("disk fields set when absent from the payload, want nil")
	}
}
