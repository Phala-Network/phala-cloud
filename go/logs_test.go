package phala

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestFetchCVMLogsStructuredError(t *testing.T) {
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
		_, _ = io.WriteString(w, `{"error_code":"ERR-17-004","message":"CVM unavailable","suggestions":["Check the CVM ID"]}`)
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"logs": map[string]string{"serial": logs.URL + "/logs/123/node/serial"},
		})
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.FetchCVMLogs(context.Background(), "app_test", LogSource{Type: "node", Channel: CVMLogSerial}, nil)
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("got %T", err)
	}
	if apiErr.ErrorCode != "ERR-17-004" || apiErr.StatusCode != 404 {
		t.Fatalf("error = %+v", apiErr)
	}
}

func TestFollowNodeDropsHeartbeatAndReconnectsTail0(t *testing.T) {
	var calls []string
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls = append(calls, r.URL.RawQuery)
		flusher, _ := w.(http.Flusher)
		if len(calls) == 1 {
			_, _ = io.WriteString(w, "[vmm heartbeat]\n[teepod heartbeat]\n\ncontains [vmm heartbeat]\n")
			flusher.Flush()
			return
		}
		_, _ = io.WriteString(w, "reconnected\n")
		flusher.Flush()
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"logs": map[string]string{"serial": logs.URL + "/logs/123/node/serial"},
		})
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	lines, errs := client.FollowCVMLogs(ctx, "app_test", LogSource{Type: "node", Channel: CVMLogSerial}, &LogsOptions{Tail: 7})
	var got []string
	timeout := time.After(2 * time.Second)
	for len(got) < 3 {
		select {
		case line := <-lines:
			got = append(got, line)
			if line == "reconnected\n" {
				cancel()
			}
		case err := <-errs:
			if err != nil {
				t.Fatal(err)
			}
		case <-timeout:
			t.Fatalf("timeout, got %q", got)
		}
	}
	if strings.Join(got, "") == "" {
		t.Fatalf("got %q", got)
	}
	if len(calls) < 2 {
		t.Fatalf("calls = %v", calls)
	}
	if !strings.Contains(calls[0], "tail=7") {
		t.Fatalf("first query %q", calls[0])
	}
	if !strings.Contains(calls[1], "tail=0") {
		t.Fatalf("second query %q", calls[1])
	}
}

func TestFetchContainerKeepsHeartbeatLikeContent(t *testing.T) {
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "{\"channel\":\"stdout\",\"message\":\"\"}\n{\"channel\":\"stderr\",\"message\":\"[vmm heartbeat]\"}\n")
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"containers": []map[string]any{{
					"id": "container-id", "names": []string{"/app"},
					"log_endpoint": logs.URL + "/logs/123/container/app",
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"logs": map[string]any{}})
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	entries, err := client.FetchCVMLogEntries(context.Background(), "app_test", LogSource{Type: "container"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 || entries[0].Message != "" || entries[1].Message != "[vmm heartbeat]" {
		t.Fatalf("entries = %+v", entries)
	}
}

func TestLegacyAPIVersionStillResolvesLogURLs(t *testing.T) {
	var infoVersion string
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "ok")
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		infoVersion = r.Header.Get("X-Phala-Version")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"logs": map[string]string{"serial": logs.URL + "/logs/123/node/serial"},
		})
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL), WithAPIVersion("2025-10-28"))
	if err != nil {
		t.Fatal(err)
	}
	body, err := client.FetchCVMLogs(context.Background(), "app_test", LogSource{Type: "node", Channel: CVMLogSerial}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if body != "ok" {
		t.Fatalf("body = %q", body)
	}
	if infoVersion != cvmLogsInfoAPIVersion {
		t.Fatalf("X-Phala-Version = %q, want %q", infoVersion, cvmLogsInfoAPIVersion)
	}
}

func TestNodeLogsRejectSinceUntilTimestamps(t *testing.T) {
	client, err := NewClient(WithAPIKey("k"), WithBaseURL("https://example.test"))
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.FetchCVMLogs(context.Background(), "app_test", LogSource{Type: "node", Channel: CVMLogSerial}, &LogsOptions{Since: int64(1)})
	if err == nil || !strings.Contains(err.Error(), "since") {
		t.Fatalf("got %v", err)
	}
}

func TestFetchCVMLogEntriesHonorsFormat(t *testing.T) {
	client, err := NewClient(WithAPIKey("k"), WithBaseURL("https://example.test"))
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.FetchCVMLogEntries(context.Background(), "app_test", LogSource{Type: "container"}, &LogsOptions{Format: "text"})
	if err == nil || !strings.Contains(err.Error(), "format=ndjson") {
		t.Fatalf("got %v", err)
	}
}

func TestPublicLogsOffReturnsERR17006(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"public_logs": false, "logs": map[string]any{}})
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.FetchCVMLogEntries(context.Background(), "app_test", LogSource{Type: "container"}, nil)
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*APIError)
	if !ok || apiErr.ErrorCode != "ERR-17-006" || apiErr.StatusCode != 409 {
		t.Fatalf("got %v", err)
	}
}

func TestGuestAgentNdjsonErrorIsERR17009(t *testing.T) {
	const guest = "Docker responded with status code 501: configured logging driver does not support reading"
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `{"error":"`+guest+`"}`+"\n")
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"containers": []map[string]any{{
					"id": "container-id", "names": []string{"/app"},
					"log_endpoint": logs.URL + "/logs/123/container/app",
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"public_logs": true, "logs": map[string]any{}})
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.FetchCVMLogEntries(context.Background(), "app_test", LogSource{Type: "container"}, nil)
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*APIError)
	if !ok || apiErr.ErrorCode != "ERR-17-009" || !strings.Contains(apiErr.Message, guest) {
		t.Fatalf("got %v", err)
	}
}

func TestFollowHTTP502ERR17009Reconnects(t *testing.T) {
	var calls int
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(502)
		_, _ = io.WriteString(w, `{"error_code":"ERR-17-009","message":"Guest agent or gateway unreachable"}`)
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"containers": []map[string]any{{
					"id": "c1", "names": []string{"/app"},
					"log_endpoint": logs.URL + "/logs/123/container/app",
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"public_logs": true})
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	_, errs := client.FollowCVMLogs(context.Background(), "app_test", LogSource{Type: "container"}, nil)
	err = <-errs
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*APIError)
	if !ok || apiErr.ErrorCode != "ERR-17-009" {
		t.Fatalf("got %v", err)
	}
	if calls != 5 {
		t.Fatalf("calls = %d, want 5", calls)
	}
}

func TestFollowGuestStreamErrorStops(t *testing.T) {
	const guest = "Docker responded with status code 501: configured logging driver does not support reading"
	var calls int
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		_, _ = io.WriteString(w, `{"error":"`+guest+`"}`+"\n")
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"containers": []map[string]any{{
					"id": "c1", "names": []string{"/app"},
					"log_endpoint": logs.URL + "/logs/123/container/app",
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"public_logs": true})
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	_, errs := client.FollowCVMLogs(context.Background(), "app_test", LogSource{Type: "container"}, nil)
	err = <-errs
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*APIError)
	if !ok || apiErr.ErrorCode != "ERR-17-009" || !strings.Contains(apiErr.Message, guest) {
		t.Fatalf("got %v", err)
	}
	if calls != 1 {
		t.Fatalf("calls = %d, want 1", calls)
	}
}
