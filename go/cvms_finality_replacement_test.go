package phala

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

const finalityHeader = "X-Confirm-Finality-Replacement"

const finalityReplacementRequired = `{
	"error_code": "ERR-03-067",
	"message": "Confirm that you want to replace the pending CVM update.",
	"details": [
		{"field": "correlation_id", "value": "corr-waiting"},
		{"field": "stage", "value": "submitted"}
	]
}`

// finalityCalls lists every client method that sends the confirmation header.
// Each call receives the value to set and returns the request's error.
var finalityCalls = []struct {
	name   string
	method string
	path   string
	call   func(c *Client, value string) error
}{
	{"PatchCVM", "PATCH", "/cvms/cvm-1", func(c *Client, v string) error {
		_, err := c.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{PublicLogs: Bool(true), ConfirmFinalityReplacement: v})
		return err
	}},
	{"ConfirmCVMPatch", "PATCH", "/cvms/cvm-1", func(c *Client, v string) error {
		_, err := c.ConfirmCVMPatch(context.Background(), "cvm-1", &ConfirmCVMPatchRequest{ComposeHash: "h", TransactionHash: "t", ConfirmFinalityReplacement: v})
		return err
	}},
	{"UpdateDockerCompose", "PATCH", "/cvms/cvm-1/docker-compose", func(c *Client, v string) error {
		_, err := c.UpdateDockerCompose(context.Background(), "cvm-1", "services: {}", &ComposeUpdateOptions{ConfirmFinalityReplacement: v})
		return err
	}},
	{"UpdatePreLaunchScript", "PATCH", "/cvms/cvm-1/pre-launch-script", func(c *Client, v string) error {
		_, err := c.UpdatePreLaunchScript(context.Background(), "cvm-1", "echo hi", &ComposeUpdateOptions{ConfirmFinalityReplacement: v})
		return err
	}},
	{"UpgradePreLaunchScript", "POST", "/cvms/cvm-1/pre-launch-script/upgrade-to-latest-official", func(c *Client, v string) error {
		_, err := c.UpgradePreLaunchScript(context.Background(), "cvm-1", &ComposeUpdateOptions{ConfirmFinalityReplacement: v})
		return err
	}},
	{"CommitCVMComposeFileUpdate", "PATCH", "/cvms/cvm-1/compose_file", func(c *Client, v string) error {
		return c.CommitCVMComposeFileUpdate(context.Background(), "cvm-1", &CommitComposeUpdateRequest{ComposeHash: "h", ConfirmFinalityReplacement: v})
	}},
	{"UpdateCVMEnvs", "PATCH", "/cvms/cvm-1/envs", func(c *Client, v string) error {
		_, err := c.UpdateCVMEnvs(context.Background(), "cvm-1", &UpdateEnvsRequest{EncryptedEnv: "e", ConfirmFinalityReplacement: v})
		return err
	}},
	{"RedeployCVMRevision", "POST", "/cvms/cvm-1/revisions/rev-1/redeploy", func(c *Client, v string) error {
		_, err := c.RedeployCVMRevision(context.Background(), "cvm-1", "rev-1", &RedeployCVMRevisionRequest{ConfirmFinalityReplacement: v})
		return err
	}},
	{"RedeployAppRevision", "POST", "/apps/app-1/revisions/rev-1/redeploy", func(c *Client, v string) error {
		return c.RedeployAppRevision(context.Background(), "app-1", "rev-1", &RedeployAppRevisionRequest{VMUUIDs: []string{"u"}, ConfirmFinalityReplacement: v})
	}},
	{"CommitCVMUpdate", "POST", "/cvms/cvm-1/commit-update", func(c *Client, v string) error {
		_, err := c.CommitCVMUpdate(context.Background(), "cvm-1", &CommitCVMUpdateRequest{Token: "tok", ComposeHash: "h", TransactionHash: "t", ConfirmFinalityReplacement: v})
		return err
	}},
}

type finalityRequest struct {
	method, path string
	header       http.Header
	body         string
}

// finalityServer answers every request with status and payload and records it.
// Unlike recordingServer it accepts non-JSON bodies (YAML, shell scripts).
func finalityServer(t *testing.T, status int, payload string) (*Client, *[]finalityRequest) {
	t.Helper()
	var seen []finalityRequest
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		seen = append(seen, finalityRequest{r.Method, r.URL.Path, r.Header.Clone(), string(raw)})
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(payload))
	}))
	t.Cleanup(srv.Close)
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL), WithMaxRetries(0))
	if err != nil {
		t.Fatal(err)
	}
	return client, &seen
}

func TestConfirmFinalityReplacementHeaderPerValue(t *testing.T) {
	values := []struct{ name, value string }{
		{"omitted", ""},
		{"none", ConfirmFinalityReplacementNone},
		{"correlation id", "corr-waiting"},
	}
	for _, tc := range finalityCalls {
		for _, v := range values {
			t.Run(tc.name+"/"+v.name, func(t *testing.T) {
				client, seen := finalityServer(t, http.StatusAccepted, acceptedUpdate)
				if err := tc.call(client, v.value); err != nil {
					t.Fatal(err)
				}
				got := (*seen)[0]
				if got.method != tc.method || got.path != tc.path {
					t.Fatalf("request = %s %s, want %s %s", got.method, got.path, tc.method, tc.path)
				}
				values, present := got.header[finalityHeader]
				if v.value == "" {
					if present {
						t.Fatalf("%s = %q, want no header", finalityHeader, values)
					}
					return
				}
				if got.header.Get(finalityHeader) != v.value {
					t.Fatalf("%s = %q, want %q", finalityHeader, got.header.Get(finalityHeader), v.value)
				}
				if strings.Contains(got.body, "ConfirmFinalityReplacement") {
					t.Fatalf("confirmation value leaked into the body: %s", got.body)
				}
			})
		}
	}
}

func TestPatchCVMKeepsPrepareOnlyWithConfirmation(t *testing.T) {
	client, seen := recordingServer(t, http.StatusAccepted, acceptedUpdate)
	_, err := client.PatchCVM(context.Background(), "cvm-1", &PatchCVMRequest{
		PublicLogs: Bool(true), PrepareOnly: true, ConfirmFinalityReplacement: "none",
	})
	if err != nil {
		t.Fatal(err)
	}
	h := (*seen)[0].header
	if h.Get("X-Prepare-Only") != "true" || h.Get(finalityHeader) != "none" {
		t.Fatalf("headers = %v", h)
	}
}

func TestFinalityReplacementRequiredParsedFrom412(t *testing.T) {
	client, _ := recordingServer(t, http.StatusPreconditionFailed, finalityReplacementRequired)
	err := finalityCalls[0].call(client, ConfirmFinalityReplacementNone)

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("err = %v, want *APIError", err)
	}
	if !apiErr.IsFinalityReplacementRequired() || !apiErr.HasErrorCode(ErrFinalityReplacementRequired) {
		t.Fatalf("apiErr = %+v", apiErr)
	}
	waiting, ok := apiErr.FinalityReplacementRequired()
	if !ok || waiting.CorrelationID != "corr-waiting" || waiting.Stage != "submitted" {
		t.Fatalf("waiting = %+v, ok = %v", waiting, ok)
	}
}

func TestFinalityReplacementRequiredIgnoresOtherErrors(t *testing.T) {
	for name, apiErr := range map[string]*APIError{
		"412 with another code":    {StatusCode: 412, ErrorCode: "ERR-03-001"},
		"right code, wrong status": {StatusCode: 409, ErrorCode: ErrFinalityReplacementRequired},
		"no correlation id":        {StatusCode: 412, ErrorCode: ErrFinalityReplacementRequired},
	} {
		if _, ok := apiErr.FinalityReplacementRequired(); ok {
			t.Errorf("%s: parsed as finality replacement", name)
		}
	}
}

// A caller sends "none", gets the 412, then repeats the request with the
// waiting update's correlation ID to confirm the replacement.
func TestConfirmFinalityReplacementByRetryingWithCorrelationID(t *testing.T) {
	var mu sync.Mutex
	var sent []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		mu.Lock()
		sent = append(sent, r.Header.Get(finalityHeader))
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		if r.Header.Get(finalityHeader) == "corr-waiting" {
			w.WriteHeader(http.StatusAccepted)
			_, _ = w.Write([]byte(acceptedUpdate))
			return
		}
		w.WriteHeader(http.StatusPreconditionFailed)
		_, _ = w.Write([]byte(finalityReplacementRequired))
	}))
	t.Cleanup(srv.Close)
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL), WithMaxRetries(0))
	if err != nil {
		t.Fatal(err)
	}

	req := &PatchCVMRequest{PublicLogs: Bool(true), ConfirmFinalityReplacement: ConfirmFinalityReplacementNone}
	_, err = client.PatchCVM(context.Background(), "cvm-1", req)
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("first call err = %v", err)
	}
	waiting, ok := apiErr.FinalityReplacementRequired()
	if !ok {
		t.Fatal("no waiting update in the 412")
	}

	req.ConfirmFinalityReplacement = waiting.CorrelationID
	resp, err := client.PatchCVM(context.Background(), "cvm-1", req)
	if err != nil {
		t.Fatalf("confirmed call: %v", err)
	}
	if resp.CorrelationID != "corr-1" {
		t.Fatalf("resp = %+v", resp)
	}
	if len(sent) != 2 || sent[0] != "none" || sent[1] != "corr-waiting" {
		t.Fatalf("header values sent = %q", sent)
	}
}
