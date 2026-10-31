package phala

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewActionsWire(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		switch r.Method + " " + r.URL.Path {
		case "POST /cvms/cvm/commit-update":
			if string(body) != `{"token":"token","compose_hash":"hash","transaction_hash":"tx"}` {
				t.Errorf("commit body %s", body)
			}
			io.WriteString(w, `{"correlation_id":"corr","status":"started"}`)
		case "GET /cvms/cvm/ssh-keys":
			io.WriteString(w, `{"keys":[{"id":"key","owner_username":"user"}],"restart_required":true}`)
		case "PUT /cvms/cvm/ssh-keys":
			if string(body) != `{"ssh_key_ids":[],"usernames":["alice"],"apply_now":true}` {
				t.Errorf("keys body %s", body)
			}
			io.WriteString(w, `{"keys":[],"restart_required":false}`)
		case "DELETE /tokens/self":
			w.WriteHeader(http.StatusNoContent)
		default:
			t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
			w.WriteHeader(404)
		}
	}))
	defer server.Close()
	c, _ := NewClient(WithAPIKey("key"), WithBaseURL(server.URL))
	ctx := context.Background()
	result, err := c.CommitCVMUpdate(ctx, "cvm", &CommitCVMUpdateRequest{Token: "token", ComposeHash: "hash", TransactionHash: "tx"})
	if err != nil || result.CorrelationID != "corr" {
		t.Fatalf("result %+v, err %v", result, err)
	}
	keys, err := c.GetCVMSSHKeys(ctx, "cvm")
	if err != nil || !keys.RestartRequired || keys.Keys[0].ID != "key" {
		t.Fatalf("keys %+v, err %v", keys, err)
	}
	_, err = c.UpdateCVMSSHKeys(ctx, "cvm", &UpdateCVMSSHKeysRequest{SSHKeyIDs: []string{}, Usernames: []string{"alice"}, ApplyNow: true})
	if err != nil {
		t.Fatal(err)
	}
	if err = c.RevokeSelfToken(ctx); err != nil {
		t.Fatal(err)
	}
}
