package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

type recordedRequest struct {
	Method string
	Path   string
	Header http.Header
	Body   []byte
}

type requestCapture struct {
	mu      sync.Mutex
	entries []recordedRequest
}

func (c *requestCapture) add(r *http.Request, body []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()

	copiedBody := make([]byte, len(body))
	copy(copiedBody, body)

	c.entries = append(c.entries, recordedRequest{
		Method: r.Method,
		Path:   r.URL.Path,
		Header: r.Header.Clone(),
		Body:   copiedBody,
	})
}

func (c *requestCapture) mustFind(t *testing.T, method, path string) recordedRequest {
	t.Helper()

	c.mu.Lock()
	defer c.mu.Unlock()

	for i := len(c.entries) - 1; i >= 0; i-- {
		entry := c.entries[i]
		if entry.Method == method && entry.Path == path {
			return entry
		}
	}

	seen := make([]string, 0, len(c.entries))
	for _, entry := range c.entries {
		seen = append(seen, fmt.Sprintf("%s %s", entry.Method, entry.Path))
	}
	t.Fatalf("request not found: %s %s (seen: %v)", method, path, seen)
	return recordedRequest{}
}

func (c *requestCapture) count(method, path string) int {
	c.mu.Lock()
	defer c.mu.Unlock()

	count := 0
	for _, entry := range c.entries {
		if entry.Method == method && entry.Path == path {
			count++
		}
	}
	return count
}

func writeJSON(t *testing.T, w http.ResponseWriter, status int, body string) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, err := io.WriteString(w, body)
	if err != nil {
		t.Fatalf("write response: %v", err)
	}
}

func TestAPIClientContract_TypedAndFallback(t *testing.T) {
	capture := &requestCapture{}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		capture.add(r, body)

		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/auth/me":
			writeJSON(t, w, http.StatusOK, `{"user":{"username":"alice","email":"alice@example.com"},"workspace":{"id":"wks_1","slug":"alice"},"credits":{"balance":"42"}}`)
			return

		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/apps/filter-options":
			writeJSON(t, w, http.StatusOK, `{"statuses":[],"image_versions":[],"instance_types":["tdx.small"],"kms_slugs":[],"kms_types":[],"regions":["us-east"],"nodes":[]}`)
			return

		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/teepods/available":
			writeJSON(t, w, http.StatusOK, `{"tier":"PRO","capacity":{},"nodes":[],"kms_list":[]}`)
			return

		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/cvms/provision":
			writeJSON(t, w, http.StatusOK, `{"app_id":"app_test","compose_hash":"compose_hash_test"}`)
			return

		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/cvms":
			writeJSON(t, w, http.StatusOK, `{"id":123,"name":"example-app","status":"pending","app_id":"app_test"}`)
			return

		case r.Method == http.MethodPatch && r.URL.Path == "/api/v1/cvms/cvm123/resources":
			writeJSON(t, w, http.StatusAccepted, `{}`)
			return

		case r.Method == http.MethodPatch && r.URL.Path == "/api/v1/cvms/cvm123/docker-compose":
			writeJSON(t, w, http.StatusAccepted, `{}`)
			return

		case r.Method == http.MethodPatch && r.URL.Path == "/api/v1/cvms/cvm123/pre-launch-script":
			writeJSON(t, w, http.StatusAccepted, `{}`)
			return

		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/cvms/cvm123/start":
			writeJSON(t, w, http.StatusAccepted, `{}`)
			return

		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/cvms/cvm123/stop":
			writeJSON(t, w, http.StatusAccepted, `{}`)
			return

		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/cvms/cvm123/docker-compose.yml":
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusOK)
			_, _ = io.WriteString(w, "services:\n  app:\n")
			return

		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/cvms/cvm123/pre-launch-script":
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusOK)
			_, _ = io.WriteString(w, "#!/bin/sh\necho ready\n")
			return

		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/instance-types":
			writeJSON(t, w, http.StatusOK, `{"result":[{"name":"cpu","items":[{"id":"tdx.small","name":"tdx.small"}]}]}`)
			return

		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/user/ssh-keys":
			writeJSON(t, w, http.StatusOK, `{"id":"sshkey_1","name":"laptop","public_key":"ssh-ed25519 AAA","fingerprint":"fp"}`)
			return

		default:
			w.WriteHeader(http.StatusNotFound)
			_, _ = io.WriteString(w, "not found")
		}
	}))
	defer srv.Close()

	client := NewAPIClient(srv.URL+"/api/v1", "phat_test_key", "2026-01-21", 5*time.Second)
	ctx := context.Background()

	var me struct {
		User struct {
			Username string `json:"username"`
			Email    string `json:"email"`
		} `json:"user"`
		Workspace struct {
			ID string `json:"id"`
		} `json:"workspace"`
	}
	if err := client.GetJSON(ctx, "/auth/me", &me); err != nil {
		t.Fatalf("typed auth me request failed: %v", err)
	}
	if me.User.Username != "alice" || me.Workspace.ID != "wks_1" {
		t.Fatalf("unexpected /auth/me response: %#v", me)
	}

	var filters struct {
		Regions []string `json:"regions"`
	}
	if err := client.GetJSON(ctx, "/apps/filter-options", &filters); err != nil {
		t.Fatalf("typed filter-options request failed: %v", err)
	}
	if len(filters.Regions) != 1 || filters.Regions[0] != "us-east" {
		t.Fatalf("unexpected filter-options response: %#v", filters)
	}

	var available map[string]any
	if err := client.GetJSON(ctx, "/teepods/available", &available); err != nil {
		t.Fatalf("typed teepods available request failed: %v", err)
	}

	provisionReq := map[string]any{
		"name":          "example-app",
		"instance_type": "tdx.small",
		"compose_file": map[string]any{
			"name":                "example-app",
			"docker_compose_file": "services:\n  app:\n",
		},
	}
	var provisionResp struct {
		AppID       string `json:"app_id"`
		ComposeHash string `json:"compose_hash"`
	}
	if err := client.PostJSON(ctx, "/cvms/provision", provisionReq, &provisionResp); err != nil {
		t.Fatalf("typed /cvms/provision failed: %v", err)
	}
	if provisionResp.AppID == "" || provisionResp.ComposeHash == "" {
		t.Fatalf("unexpected provision response: %#v", provisionResp)
	}

	var created map[string]any
	if err := client.PostJSON(ctx, "/cvms", map[string]any{"app_id": "app_test", "compose_hash": "compose_hash_test"}, &created); err != nil {
		t.Fatalf("typed /cvms create failed: %v", err)
	}

	if err := client.PatchJSON(ctx, "/cvms/cvm123/resources", map[string]any{
		"allow_restart": true,
		"disk_size":     40,
	}, nil); err != nil {
		t.Fatalf("typed /cvms/{id}/resources failed: %v", err)
	}

	if err := client.PatchText(
		ctx,
		"/cvms/cvm123/docker-compose",
		"services:\n  app:\n",
		map[string]string{"X-Compose-Hash": "0xabc", "X-Transaction-Hash": "0xdef", "Content-Type": "text/yaml"},
		nil,
	); err != nil {
		t.Fatalf("typed /cvms/{id}/docker-compose patch failed: %v", err)
	}

	if err := client.PatchText(
		ctx,
		"/cvms/cvm123/pre-launch-script",
		"#!/bin/sh\necho update\n",
		map[string]string{"X-Compose-Hash": "0xaaa"},
		nil,
	); err != nil {
		t.Fatalf("typed /cvms/{id}/pre-launch-script patch failed: %v", err)
	}

	if err := client.PostJSON(ctx, "/cvms/cvm123/start", map[string]any{"polling": "v1"}, nil); err != nil {
		t.Fatalf("typed /cvms/{id}/start failed: %v", err)
	}

	if err := client.PostJSON(ctx, "/cvms/cvm123/stop", map[string]any{"polling": "v1"}, nil); err != nil {
		t.Fatalf("typed /cvms/{id}/stop failed: %v", err)
	}

	compose, err := client.GetText(ctx, "/cvms/cvm123/docker-compose.yml")
	if err != nil {
		t.Fatalf("typed compose GET failed: %v", err)
	}
	if !strings.Contains(compose, "services:") {
		t.Fatalf("unexpected compose text: %q", compose)
	}

	script, err := client.GetText(ctx, "/cvms/cvm123/pre-launch-script")
	if err != nil {
		t.Fatalf("typed pre-launch GET failed: %v", err)
	}
	if !strings.Contains(script, "echo ready") {
		t.Fatalf("unexpected pre-launch script: %q", script)
	}

	var sizes map[string]any
	if err := client.GetJSON(ctx, "/instance-types", &sizes); err != nil {
		t.Fatalf("fallback /instance-types failed: %v", err)
	}
	if _, ok := sizes["result"]; !ok {
		t.Fatalf("unexpected /instance-types response: %#v", sizes)
	}

	var sshResp struct {
		ID string `json:"id"`
	}
	if err := client.PostJSON(ctx, "/user/ssh-keys", map[string]any{
		"name":       "laptop",
		"public_key": "ssh-ed25519 AAA",
	}, &sshResp); err != nil {
		t.Fatalf("fallback /user/ssh-keys failed: %v", err)
	}
	if sshResp.ID != "sshkey_1" {
		t.Fatalf("unexpected ssh response: %#v", sshResp)
	}

	handled, err := client.tryTypedRequest(ctx, http.MethodGet, "/instance-types", "", nil, nil, &map[string]any{})
	if err != nil {
		t.Fatalf("tryTypedRequest fallback probe errored: %v", err)
	}
	if handled {
		t.Fatalf("expected /instance-types to remain fallback, but typed handler claimed it")
	}

	typedReq := capture.mustFind(t, http.MethodGet, "/api/v1/apps/filter-options")
	if typedReq.Header.Get("X-API-Key") != "phat_test_key" {
		t.Fatalf("typed request missing api key header: %#v", typedReq.Header)
	}
	if typedReq.Header.Get("X-Phala-Version") != "2026-01-21" {
		t.Fatalf("typed request missing api version header: %#v", typedReq.Header)
	}

	resourcesReq := capture.mustFind(t, http.MethodPatch, "/api/v1/cvms/cvm123/resources")
	var resourcesPayload map[string]any
	if err := json.Unmarshal(resourcesReq.Body, &resourcesPayload); err != nil {
		t.Fatalf("decode resources payload: %v", err)
	}
	allowRestart, ok := resourcesPayload["allow_restart"].(float64)
	if !ok || allowRestart != 1 {
		t.Fatalf("expected allow_restart to be serialized as numeric 1 in typed flow, got: %#v", resourcesPayload["allow_restart"])
	}

	composePatchReq := capture.mustFind(t, http.MethodPatch, "/api/v1/cvms/cvm123/docker-compose")
	if composePatchReq.Header.Get("X-Compose-Hash") != "0xabc" {
		t.Fatalf("missing X-Compose-Hash on docker-compose patch: %#v", composePatchReq.Header)
	}
	if composePatchReq.Header.Get("X-Transaction-Hash") != "0xdef" {
		t.Fatalf("missing X-Transaction-Hash on docker-compose patch: %#v", composePatchReq.Header)
	}
	if gotCT := composePatchReq.Header.Get("Content-Type"); gotCT != "text/yaml" {
		t.Fatalf("unexpected Content-Type for docker-compose patch: %q", gotCT)
	}

	startReq := capture.mustFind(t, http.MethodPost, "/api/v1/cvms/cvm123/start")
	var startPayload map[string]any
	if err := json.Unmarshal(startReq.Body, &startPayload); err != nil {
		t.Fatalf("decode start payload: %v", err)
	}
	if startPayload["polling"] != "v1" {
		t.Fatalf("unexpected start payload: %#v", startPayload)
	}

	stopReq := capture.mustFind(t, http.MethodPost, "/api/v1/cvms/cvm123/stop")
	var stopPayload map[string]any
	if err := json.Unmarshal(stopReq.Body, &stopPayload); err != nil {
		t.Fatalf("decode stop payload: %v", err)
	}
	if stopPayload["polling"] != "v1" {
		t.Fatalf("unexpected stop payload: %#v", stopPayload)
	}

	fallbackReq := capture.mustFind(t, http.MethodPost, "/api/v1/user/ssh-keys")
	if fallbackReq.Header.Get("X-API-Key") != "phat_test_key" {
		t.Fatalf("fallback request missing api key header: %#v", fallbackReq.Header)
	}
	if fallbackReq.Header.Get("X-Phala-Version") != "2026-01-21" {
		t.Fatalf("fallback request missing api version header: %#v", fallbackReq.Header)
	}
}

func TestAPIClientContract_TypedErrorReturnsAPIError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Path == "/api/v1/cvms/missing" {
			writeJSON(t, w, http.StatusNotFound, `{"message":"cvm not found"}`)
			return
		}
		w.WriteHeader(http.StatusNotFound)
		_, _ = io.WriteString(w, "not found")
	}))
	defer srv.Close()

	client := NewAPIClient(srv.URL+"/api/v1", "phat_test_key", "2026-01-21", 5*time.Second)

	var out map[string]any
	err := client.GetJSON(context.Background(), "/cvms/missing", &out)
	if err == nil {
		t.Fatal("expected typed GET /cvms/missing to fail")
	}

	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("expected *APIError, got %T: %v", err, err)
	}
	if apiErr.StatusCode != http.StatusNotFound {
		t.Fatalf("unexpected status code: %d", apiErr.StatusCode)
	}
	if !strings.Contains(apiErr.Message, "not found") {
		t.Fatalf("unexpected API error message: %q", apiErr.Message)
	}
}

func TestAPIClientContract_RetriesOnlyReplaySafeWrites(t *testing.T) {
	capture := &requestCapture{}
	attempts := map[string]int{}
	var attemptsMu sync.Mutex

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		capture.add(r, body)

		key := r.Method + " " + r.URL.Path
		attemptsMu.Lock()
		attempts[key]++
		attempt := attempts[key]
		attemptsMu.Unlock()

		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/user/ssh-keys":
			if attempt == 1 {
				writeJSON(t, w, http.StatusServiceUnavailable, `{"message":"backend busy"}`)
				return
			}
			writeJSON(t, w, http.StatusOK, `{"id":"sshkey_1"}`)
			return

		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/cvms/cvm123/start":
			if attempt == 1 {
				writeJSON(t, w, http.StatusServiceUnavailable, `{"message":"try again"}`)
				return
			}
			writeJSON(t, w, http.StatusAccepted, `{}`)
			return

		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/cvms/provision":
			if attempt == 1 {
				writeJSON(t, w, http.StatusServiceUnavailable, `{"message":"try again"}`)
				return
			}
			writeJSON(t, w, http.StatusOK, `{"app_id":"app_test","compose_hash":"compose_hash_test"}`)
			return

		case r.Method == http.MethodPatch && r.URL.Path == "/api/v1/cvms/cvm123/resources":
			if attempt == 1 {
				writeJSON(t, w, http.StatusServiceUnavailable, `{"message":"try again"}`)
				return
			}
			writeJSON(t, w, http.StatusAccepted, `{}`)
			return

		default:
			w.WriteHeader(http.StatusNotFound)
			_, _ = io.WriteString(w, "not found")
		}
	}))
	defer srv.Close()

	client := NewAPIClient(srv.URL+"/api/v1", "phat_test_key", "2026-01-21", 5*time.Second)
	ctx := context.Background()

	var sshResp map[string]any
	err := client.PostJSON(ctx, "/user/ssh-keys", map[string]any{
		"name":       "laptop",
		"public_key": "ssh-ed25519 AAA",
	}, &sshResp)
	if err == nil {
		t.Fatal("expected create POST not to be retried after 503")
	}
	apiErr, ok := err.(*APIError)
	if !ok || apiErr.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 APIError, got %T: %v", err, err)
	}
	if got := capture.count(http.MethodPost, "/api/v1/user/ssh-keys"); got != 1 {
		t.Fatalf("unexpected retry count for create POST: got %d want 1", got)
	}

	if err := client.PostJSON(ctx, "/cvms/cvm123/start", map[string]any{"polling": "v1"}, nil); err != nil {
		t.Fatalf("expected start POST to be retried safely: %v", err)
	}
	if got := capture.count(http.MethodPost, "/api/v1/cvms/cvm123/start"); got != 2 {
		t.Fatalf("unexpected retry count for start POST: got %d want 2", got)
	}

	var provisionResp map[string]any
	if err := client.PostJSON(ctx, "/cvms/provision", map[string]any{"name": "demo"}, &provisionResp); err != nil {
		t.Fatalf("expected /cvms/provision POST to be retried safely: %v", err)
	}
	if got := capture.count(http.MethodPost, "/api/v1/cvms/provision"); got != 2 {
		t.Fatalf("unexpected retry count for /cvms/provision POST: got %d want 2", got)
	}

	if err := client.PatchJSON(ctx, "/cvms/cvm123/resources", map[string]any{"allow_restart": true}, nil); err != nil {
		t.Fatalf("expected PATCH to be retried safely: %v", err)
	}
	if got := capture.count(http.MethodPatch, "/api/v1/cvms/cvm123/resources"); got != 2 {
		t.Fatalf("unexpected retry count for PATCH: got %d want 2", got)
	}
}
