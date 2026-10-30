package phala

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreateWithPhysicalNodeAndToken(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/cvms" {
			t.Errorf("request = %s %s, want POST /cvms", r.Method, r.URL.Path)
		}
		var body map[string]json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		w.Header().Set("Content-Type", "application/json")
		switch calls {
		case 0:
			if string(body["node"]) != `"physical-node"` {
				t.Errorf("node = %s", body["node"])
			}
			for _, key := range []string{"node_id", "teepod_id"} {
				if _, ok := body[key]; ok {
					t.Errorf("unexpected legacy placement key %s", key)
				}
			}
			_, _ = w.Write([]byte(`{"token":"create-token"}`))
		case 1:
			if string(body["token"]) != `"create-token"` {
				t.Errorf("token = %s", body["token"])
			}
			_, _ = w.Write([]byte(`{"id":"cvm_test"}`))
		default:
			t.Error("unexpected request")
		}
		calls++
	}))
	defer server.Close()
	client, err := NewClient(WithAPIKey("test"), WithBaseURL(server.URL))
	if err != nil {
		t.Fatal(err)
	}
	node := "physical-node"
	prepared, err := client.ProvisionCVM(context.Background(), &ProvisionCVMRequest{Name: "app", InstanceType: "tdx.small", Node: &node})
	if err != nil {
		t.Fatal(err)
	}
	if prepared.Token != "create-token" {
		t.Fatalf("token = %q", prepared.Token)
	}
	if _, err := client.CommitCVMProvision(context.Background(), &CommitCVMProvisionRequest{Token: &prepared.Token}); err != nil {
		t.Fatal(err)
	}
	if calls != 2 {
		t.Fatalf("calls = %d, want 2", calls)
	}
}
