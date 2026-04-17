package phala

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreateAppInstance(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("method = %q, want POST", r.Method)
		}
		if r.URL.Path != "/apps/app-123/instances" {
			t.Errorf("path = %q, want /apps/app-123/instances", r.URL.Path)
		}

		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		if body["node_id"] != float64(5) {
			t.Errorf("node_id = %v, want 5", body["node_id"])
		}
		if body["docker_compose_file"] != "services:\n  app:\n    image: nginx" {
			t.Errorf("docker_compose_file = %v", body["docker_compose_file"])
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
	result, err := client.CreateAppInstance(context.Background(), "app-123", &CreateAppInstanceRequest{
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
