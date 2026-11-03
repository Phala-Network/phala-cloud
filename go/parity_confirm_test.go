package phala

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestConfirmCVMPatchWire(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		if r.Method != "PATCH" || r.URL.Path != "/cvms/cvm" || string(b) != "{}" || r.Header.Get("X-Compose-Hash") != "compose" || r.Header.Get("X-Transaction-Hash") != "transaction" {
			t.Errorf("unexpected request: %s %s %s %v", r.Method, r.URL.Path, b, r.Header)
		}
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"correlation_id":"corr"}`)
	}))
	defer server.Close()
	c, _ := NewClient(WithAPIKey("key"), WithBaseURL(server.URL))
	result, err := c.ConfirmCVMPatch(context.Background(), "cvm", &ConfirmCVMPatchRequest{ComposeHash: "compose", TransactionHash: "transaction"})
	if err != nil {
		t.Fatal(err)
	}
	if result.CorrelationID != "corr" {
		t.Fatalf("correlation: %s", result.CorrelationID)
	}
	b, _ := json.Marshal(result)
	if string(b) != `{"correlation_id":"corr"}` {
		t.Fatalf("response: %s", b)
	}
	legacy, err := c.ConfirmCVMPatchV20260121(context.Background(), "cvm", &ConfirmCVMPatchRequest{ComposeHash: "compose", TransactionHash: "transaction"})
	if err != nil || legacy.CorrelationID != "corr" {
		t.Fatalf("legacy result: %+v, error %v", legacy, err)
	}
}
