package phala

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetAppAttestationDecodesTypedResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("method = %q, want GET", r.Method)
		}
		if r.URL.Path != "/apps/app-123/attestations" {
			t.Errorf("path = %q, want /apps/app-123/attestations", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"app_id":"app-123",
			"contract_address":"",
			"kms_info":{
				"contract_address":"",
				"chain_id":null,
				"version":"v0.5.8",
				"url":"https://kms.example.com",
				"gateway_app_id":null,
				"gateway_app_url":"https://gateway.example.com",
				"kms_type":"phala"
			},
			"instances":[{
				"vm_uuid":"vm-1",
				"name":"cvm-1",
				"mr_config_id":"0xmrconfigid",
				"tcb_info":{
					"mrtd":"mrtd",
					"rtmr0":"rtmr0",
					"rtmr1":"rtmr1",
					"rtmr2":"rtmr2",
					"rtmr3":"rtmr3",
					"event_log":[],
					"app_compose":"{}"
				}
			}],
			"kms_guest_agent_info":null,
			"gateway_guest_agent_info":null,
			"qemu_version":null
		}`))
	}))
	defer srv.Close()

	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}

	result, err := client.GetAppAttestation(context.Background(), "app-123")
	if err != nil {
		t.Fatalf("GetAppAttestation: %v", err)
	}
	if result.AppID != "app-123" {
		t.Errorf("AppID = %q, want app-123", result.AppID)
	}
	if len(result.Instances) != 1 {
		t.Fatalf("instances len = %d, want 1", len(result.Instances))
	}
	if result.Instances[0].MRConfigID == nil || *result.Instances[0].MRConfigID != "0xmrconfigid" {
		t.Errorf("MRConfigID = %v, want 0xmrconfigid", result.Instances[0].MRConfigID)
	}
	if result.Instances[0].TCBInfo == nil || result.Instances[0].TCBInfo.RTMR3 != "rtmr3" {
		t.Errorf("TCBInfo.RTMR3 = %v, want rtmr3", result.Instances[0].TCBInfo)
	}
}

func TestCreateAppInstance(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("method = %q, want POST", r.Method)
		}
		if r.URL.Path != "/apps/app-123/instances" {
			t.Errorf("path = %q, want /apps/app-123/instances", r.URL.Path)
		}

		var body CreateAppInstanceRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		if body.Name == nil || *body.Name != "redis-0" {
			t.Errorf("name = %v, want redis-0", body.Name)
		}
		if body.NodeID == nil || *body.NodeID != 5 {
			t.Errorf("node_id = %v, want 5", body.NodeID)
		}
		if body.DockerComposeFile == nil || *body.DockerComposeFile != "services:\n  app:\n    image: nginx" {
			t.Errorf("docker_compose_file = %v", body.DockerComposeFile)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":       "cvm-456",
			"name":     "instance-1",
			"resource": map[string]any{"instance_type": "cpu-2"},
			"status":   "running",
		})
	}))
	defer srv.Close()

	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}

	dockerCompose := "services:\n  app:\n    image: nginx"
	nodeID := 5
	name := "redis-0"
	result, err := client.CreateAppInstance(context.Background(), "app-123", &CreateAppInstanceRequest{
		Name:              &name,
		NodeID:            &nodeID,
		DockerComposeFile: &dockerCompose,
	})
	if err != nil {
		t.Fatalf("CreateAppInstance: %v", err)
	}
	if result.ID != "cvm-456" {
		t.Errorf("ID = %q, want cvm-456", result.ID)
	}
	if result.Status != "running" {
		t.Errorf("Status = %q, want running", result.Status)
	}
}

// TestRedeployAppRevision covers the SDK method used by the Terraform
// provider's members-mode update path: redeploy a revision across a set
// of vm_uuids by POSTing /apps/{id}/revisions/{rev}/redeploy.
func TestRedeployAppRevision(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("method = %q, want POST", r.Method)
		}
		if r.URL.Path != "/apps/app-1/revisions/rev_42/redeploy" {
			t.Errorf("path = %q, want /apps/app-1/revisions/rev_42/redeploy", r.URL.Path)
		}
		var body RedeployAppRevisionRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		if len(body.VMUUIDs) != 2 || body.VMUUIDs[0] != "vm-a" || body.VMUUIDs[1] != "vm-b" {
			t.Errorf("vm_uuids = %v, want [vm-a vm-b]", body.VMUUIDs)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"message":"ok"}`))
	}))
	defer srv.Close()

	client, err := NewClient(WithBaseURL(srv.URL), WithAPIKey("test"))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	if err := client.RedeployAppRevision(context.Background(), "app-1", "rev_42",
		&RedeployAppRevisionRequest{VMUUIDs: []string{"vm-a", "vm-b"}}); err != nil {
		t.Fatalf("RedeployAppRevision: %v", err)
	}
}
