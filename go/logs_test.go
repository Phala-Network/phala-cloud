package phala

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestWaitBackoffCancelReturnsPromptly(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(20 * time.Millisecond)
		cancel()
	}()
	start := time.Now()
	err := waitBackoff(ctx, 5)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("got %v", err)
	}
	if time.Since(start) > 500*time.Millisecond {
		t.Fatalf("took %v", time.Since(start))
	}
}

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
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(containerInfo(logs.URL))
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

func TestFollowPublicLogsOffReturnsERR17006(t *testing.T) {
	var infoCalls, logCalls int
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logCalls++
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			t.Fatal("composition should not be called")
		}
		infoCalls++
		_ = json.NewEncoder(w).Encode(map[string]any{"public_logs": false, "logs": map[string]any{}})
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	_, errs := client.FollowCVMLogs(context.Background(), "app_test", LogSource{Type: "container", Name: "anything"}, nil)
	err = <-errs
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*APIError)
	if !ok || apiErr.ErrorCode != "ERR-17-006" || apiErr.StatusCode != 409 {
		t.Fatalf("got %v", err)
	}
	if infoCalls != 1 {
		t.Fatalf("infoCalls = %d, want 1", infoCalls)
	}
	if logCalls != 0 {
		t.Fatalf("logCalls = %d, want 0", logCalls)
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
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(containerInfo(logs.URL))
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
	if !ok || apiErr.ErrorCode != "ERR-17-009" || apiErr.Message != guest {
		t.Fatalf("got %v", err)
	}
	if strings.Contains(err.Error(), "phala api error") {
		t.Fatalf("in-stream error should omit HTTP status: %v", err)
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
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(containerInfo(logs.URL))
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
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(containerInfo(logs.URL))
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
	if !ok || apiErr.ErrorCode != "ERR-17-009" || apiErr.Message != guest {
		t.Fatalf("got %v", err)
	}
	if calls != 1 {
		t.Fatalf("calls = %d, want 1", calls)
	}
}

func TestContainerTextGuestErrorWithoutNewline(t *testing.T) {
	const guest = "Docker responded with status code 501: configured logging driver does not support reading"
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `{"error":"`+guest+`"}`)
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"containers": []map[string]any{{
					"id": "c1", "names": []string{"/app"},
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(containerInfo(logs.URL))
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.FetchCVMLogs(context.Background(), "app_test", LogSource{Type: "container"}, &LogsOptions{Format: "text"})
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*APIError)
	if !ok || apiErr.ErrorCode != "ERR-17-009" || apiErr.Message != guest {
		t.Fatalf("got %v", err)
	}
}

func TestContainerFollowReconnectDedupesThenEmptyEndStops(t *testing.T) {
	body := strings.Join([]string{
		`{"channel":"stdout","message":"2026-11-09T12:00:00.000000001Z exiter one\n"}`,
		`{"channel":"stdout","message":"2026-11-09T12:00:01.000000001Z exiter two\n"}`,
		`{"channel":"stdout","message":"2026-11-09T12:00:02.000000001Z exiter three\n"}`,
	}, "\n") + "\n"
	var calls []string
	last := `{"channel":"stdout","message":"2026-11-09T12:00:02.000000001Z exiter three\n"}` + "\n"
	var n int
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls = append(calls, r.URL.RawQuery)
		n++
		switch n {
		case 1:
			_, _ = io.WriteString(w, body)
		case 2:
			_, _ = io.WriteString(w, last)
		}
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"containers": []map[string]any{{
					"id": "c1", "names": []string{"/app"},
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(containerInfo(logs.URL))
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	lines, errs := client.FollowCVMLogs(context.Background(), "app_test", LogSource{Type: "container"}, &LogsOptions{Tail: "all"})
	var got []string
loop:
	for {
		select {
		case line, ok := <-lines:
			if !ok {
				break loop
			}
			got = append(got, strings.TrimSuffix(line, "\n"))
		case err := <-errs:
			if err == nil || !strings.Contains(err.Error(), "keeps ending without new output") {
				t.Fatalf("got %v want empty-end, items=%q", err, got)
			}
			break loop
		case <-time.After(15 * time.Second):
			t.Fatalf("timeout items=%q", got)
		}
	}
	if strings.Join(got, ",") != "exiter one,exiter two,exiter three" {
		t.Fatalf("got %q", got)
	}
	if len(calls) < 2 {
		t.Fatalf("calls = %v", calls)
	}
	if !strings.Contains(calls[0], "tail=all") {
		t.Fatalf("first query %q", calls[0])
	}
	if !strings.Contains(calls[1], "since=") {
		t.Fatalf("second query missing since: %q", calls[1])
	}
	if !strings.Contains(calls[1], "tail=all") {
		t.Fatalf("second query missing tail=all: %q", calls[1])
	}
}

func TestContainerFollowStopsAfterFiveEmptyEnds(t *testing.T) {
	var calls int
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"containers": []map[string]any{{
					"id": "c1", "names": []string{"/app"},
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(containerInfo(logs.URL))
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	_, errs := client.FollowCVMLogs(context.Background(), "app_test", LogSource{Type: "container"}, nil)
	err = <-errs
	if err == nil || !strings.Contains(err.Error(), "keeps ending without new output") {
		t.Fatalf("got %v", err)
	}
	if strings.Contains(err.Error(), "phala api error") {
		t.Fatalf("non-HTTP error should omit status: %v", err)
	}
	if calls != 5 {
		t.Fatalf("calls = %d, want 5", calls)
	}
}

func TestContainerFollowWithDataKeepsReconnecting(t *testing.T) {
	var calls int
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		_, _ = io.WriteString(w, fmt.Sprintf(`{"channel":"stdout","message":"2026-11-09T12:00:%02d.0Z line%d\n"}`+"\n", calls, calls))
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"containers": []map[string]any{{
					"id": "c1", "names": []string{"/app"},
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(containerInfo(logs.URL))
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	lines, errs := client.FollowCVMLogs(ctx, "app_test", LogSource{Type: "container"}, nil)
	got := 0
	for got < 6 {
		select {
		case <-lines:
			got++
			if got >= 6 {
				cancel()
			}
		case err := <-errs:
			if err != nil {
				t.Fatal(err)
			}
		case <-time.After(2 * time.Second):
			t.Fatalf("timeout, got %d", got)
		}
	}
	if calls < 6 {
		t.Fatalf("calls = %d, want >= 6", calls)
	}
}

func TestContainerTextFollowReconnectDedupesThenEmptyEndStops(t *testing.T) {
	body := strings.Join([]string{
		"2026-11-09T12:00:00.000000001Z exiter one",
		"2026-11-09T12:00:01.000000001Z exiter two",
		"2026-11-09T12:00:02.000000001Z exiter three",
	}, "\n") + "\n"
	last := "2026-11-09T12:00:02.000000001Z exiter three\n"
	var calls []string
	var n int
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls = append(calls, r.URL.RawQuery)
		n++
		switch n {
		case 1:
			_, _ = io.WriteString(w, body)
		case 2:
			_, _ = io.WriteString(w, last)
		}
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"containers": []map[string]any{{
					"id": "c1", "names": []string{"/app"},
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(containerInfo(logs.URL))
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	lines, errs := client.FollowCVMLogs(context.Background(), "app_test", LogSource{Type: "container"}, &LogsOptions{Tail: "all", Format: "text"})
	var got []string
loop:
	for {
		select {
		case line, ok := <-lines:
			if !ok {
				break loop
			}
			got = append(got, strings.TrimSuffix(line, "\n"))
		case err := <-errs:
			if err == nil || !strings.Contains(err.Error(), "keeps ending without new output") {
				t.Fatalf("got %v want empty-end, items=%q", err, got)
			}
			break loop
		case <-time.After(15 * time.Second):
			t.Fatalf("timeout items=%q", got)
		}
	}
	if strings.Join(got, ",") != "exiter one,exiter two,exiter three" {
		t.Fatalf("got %q", got)
	}
	if len(calls) < 2 {
		t.Fatalf("calls = %v", calls)
	}
	if !strings.Contains(calls[0], "tail=all") || !strings.Contains(calls[0], "timestamps=true") {
		t.Fatalf("first query %q", calls[0])
	}
	if !strings.Contains(calls[1], "since=") {
		t.Fatalf("second query missing since: %q", calls[1])
	}
	if !strings.Contains(calls[1], "tail=all") {
		t.Fatalf("second query missing tail=all: %q", calls[1])
	}
}

func TestInStreamGatewayNDJSONCountsTowardFiveFailures(t *testing.T) {
	var calls int
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		_, _ = io.WriteString(w, `{"error_code":"ERR-17-008","message":"upstream stream failed"}`+"\n")
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"containers": []map[string]any{{
					"id": "c1", "names": []string{"/app"},
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(containerInfo(logs.URL))
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
	if !ok || apiErr.ErrorCode != "ERR-17-008" || apiErr.Message != "upstream stream failed" {
		t.Fatalf("got %v", err)
	}
	if calls != 5 {
		t.Fatalf("calls = %d, want 5", calls)
	}
}

func TestInStreamGatewayTextCountsTowardFiveFailures(t *testing.T) {
	var calls int
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		_, _ = io.WriteString(w, "[error] ERR-17-009 upstream stream failed\n")
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"logs": map[string]any{"serial": logs.URL + "/logs/123/node/serial"},
		})
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	_, errs := client.FollowCVMLogs(context.Background(), "app_test", LogSource{Type: "node", Channel: CVMLogSerial}, nil)
	err = <-errs
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*APIError)
	if !ok || apiErr.ErrorCode != "ERR-17-009" || apiErr.Message != "upstream stream failed" {
		t.Fatalf("got %v", err)
	}
	if calls != 5 {
		t.Fatalf("calls = %d, want 5", calls)
	}
}

func TestFollowContainerPassesANSI(t *testing.T) {
	var query string
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query = r.URL.RawQuery
		_, _ = io.WriteString(w, "2026-11-09T12:00:00.000000001Z hi\n")
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"containers": []map[string]any{{
					"id": "c1", "names": []string{"/app"},
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(containerInfo(logs.URL))
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	lines, errs := client.FollowCVMLogs(ctx, "app_test", LogSource{Type: "container"}, &LogsOptions{ANSI: true, Format: "text"})
	select {
	case <-lines:
		cancel()
	case err := <-errs:
		t.Fatal(err)
	case <-time.After(2 * time.Second):
		t.Fatal("timeout")
	}
	if !strings.Contains(query, "ansi=true") {
		t.Fatalf("query = %q, want ansi=true", query)
	}
}

func TestLogRequestSendsUserAgent(t *testing.T) {
	var ua string
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ua = r.Header.Get("User-Agent")
		_, _ = io.WriteString(w, "ok\n")
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"logs": map[string]any{"serial": logs.URL + "/logs/123/node/serial"},
		})
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL), WithUserAgent("MyApp/9.9 "+DefaultUserAgent()))
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.FetchCVMLogs(context.Background(), "app_test", LogSource{Type: "node", Channel: CVMLogSerial}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(ua, "MyApp/9.9 ") {
		t.Fatalf("User-Agent = %q", ua)
	}
}

func TestFollowIgnoresClientRequestTimeout(t *testing.T) {
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			t.Fatal("no flusher")
		}
		_, _ = io.WriteString(w, `{"channel":"stdout","message":"2026-11-09T12:00:00.000000001Z one\n"}`+"\n")
		flusher.Flush()
		time.Sleep(80 * time.Millisecond)
		_, _ = io.WriteString(w, `{"channel":"stdout","message":"2026-11-09T12:00:01.000000001Z two\n"}`+"\n")
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"containers": []map[string]any{{
					"id": "c1", "names": []string{"/app"},
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(containerInfo(logs.URL))
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL), WithTimeout(30*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	lines, errs := client.FollowCVMLogs(ctx, "app_test", LogSource{Type: "container"}, nil)
	got := 0
	for got < 2 {
		select {
		case <-lines:
			got++
		case err := <-errs:
			t.Fatalf("stream cut by timeout: %v", err)
		case <-time.After(2 * time.Second):
			t.Fatalf("timeout, got %d", got)
		}
	}
	cancel()
}

func TestQuietTail0ReconnectUsesFirst200Since(t *testing.T) {
	followNow = func() time.Time { return time.Unix(1794225600, 0) }
	defer func() { followNow = time.Now }()
	var queries []string
	var n int
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n++
		queries = append(queries, r.URL.RawQuery)
		if n == 1 {
			return
		}
		_, _ = io.WriteString(w, `{"channel":"stdout","message":"later\n"}`+"\n")
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"containers": []map[string]any{{
					"id": "c1", "names": []string{"/app"},
				}},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(containerInfo(logs.URL))
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	lines, errs := client.FollowCVMLogs(ctx, "app_test", LogSource{Type: "container"}, &LogsOptions{Tail: 0})
	select {
	case <-lines:
		cancel()
	case err := <-errs:
		t.Fatal(err)
	case <-time.After(5 * time.Second):
		t.Fatal("timeout")
	}
	if len(queries) < 2 {
		t.Fatalf("queries = %v", queries)
	}
	if !strings.Contains(queries[0], "tail=0") || strings.Contains(queries[0], "since=") {
		t.Fatalf("first query %q", queries[0])
	}
	if !strings.Contains(queries[1], "tail=all") || !strings.Contains(queries[1], "since=1794225600") {
		t.Fatalf("second query %q", queries[1])
	}
}

// ---------------------------------------------------------------------------
// Shared behavior spec tests
// ---------------------------------------------------------------------------

type logRequests struct {
	mu          sync.Mutex
	queries     []string
	uris        []string
	agents      []string
	times       []time.Time
	info        int
	composition int
}

func (r *logRequests) snapshot() (queries []string, times []time.Time) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]string(nil), r.queries...), append([]time.Time(nil), r.times...)
}

func (r *logRequests) count() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.queries)
}

func (r *logRequests) infoCalls() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.info
}

// newLogTestClient serves the CVM info (Public Logs on, a serial node URL) and a
// composition with one container whose log endpoint is handled by logs. The
// handler receives the 1-based connection number.
func newLogTestClient(t *testing.T, logs func(n int, w http.ResponseWriter, r *http.Request)) (*Client, *logRequests) {
	t.Helper()
	rec := &logRequests{}
	logSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec.mu.Lock()
		rec.queries = append(rec.queries, r.URL.RawQuery)
		rec.uris = append(rec.uris, r.RequestURI)
		rec.agents = append(rec.agents, r.Header.Get("User-Agent"))
		rec.times = append(rec.times, time.Now())
		n := len(rec.queries)
		rec.mu.Unlock()
		logs(n, w, r)
	}))
	t.Cleanup(logSrv.Close)
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			rec.mu.Lock()
			rec.composition++
			rec.mu.Unlock()
			_ = json.NewEncoder(w).Encode(map[string]any{
				"containers": []map[string]any{{
					"id": "c1", "names": []string{"/app"},
				}},
			})
			return
		}
		rec.mu.Lock()
		rec.info++
		rec.mu.Unlock()
		info := containerInfo(logSrv.URL)
		info["logs"].(map[string]any)["serial"] = logSrv.URL + "/logs/123/node/serial?sig=abc"
		_ = json.NewEncoder(w).Encode(info)
	}))
	t.Cleanup(api.Close)
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	return client, rec
}

// TestMain drops the 1 s connection floor so counter tests stay fast; it is set
// before any follow goroutine starts, so tests that cancel without draining do
// not race with a reset. TestFollowEnforcesMinimumConnectionInterval restores it.
func TestMain(m *testing.M) {
	followMinConnectionInterval = 0
	os.Exit(m.Run())
}

// setMinConnectionInterval overrides the floor for one test; the test must
// drain its follow before returning so the reset does not race.
func setMinConnectionInterval(t *testing.T, d time.Duration) {
	t.Helper()
	prev := followMinConnectionInterval
	followMinConnectionInterval = d
	t.Cleanup(func() { followMinConnectionInterval = prev })
}

// containerInfo is a CVM info response with Public Logs on and the container
// log base under logsURL.
func containerInfo(logsURL string) map[string]any {
	return map[string]any{
		"public_logs": true,
		"logs": map[string]any{
			"container_log_base": logsURL + "/logs/123/container",
			"auth_query":         "sig=abc",
		},
	}
}

func stubFollowNow(t *testing.T, now func() time.Time) {
	t.Helper()
	followNow = now
	t.Cleanup(func() { followNow = time.Now })
}

// collectFollow drains a follow until both channels are closed.
func collectFollow[T any](t *testing.T, items <-chan T, errs <-chan error, timeout time.Duration) ([]T, error) {
	t.Helper()
	var got []T
	deadline := time.After(timeout)
	for {
		select {
		case item, ok := <-items:
			if !ok {
				return got, <-errs
			}
			got = append(got, item)
		case <-deadline:
			t.Fatalf("follow did not finish within %v; got %v", timeout, got)
		}
	}
}

func ndjsonRecord(channel, message string) string {
	b, _ := json.Marshal(map[string]string{"channel": channel, "message": message})
	return string(b) + "\n"
}

func abortConnection(w http.ResponseWriter) {
	w.(http.Flusher).Flush()
	panic(http.ErrAbortHandler)
}

func asAPIError(t *testing.T, err error) *APIError {
	t.Helper()
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("got %T %v, want *APIError", err, err)
	}
	return apiErr
}

var containerSource = LogSource{Type: "container", Name: "app"}
var serialSource = LogSource{Type: "node", Channel: CVMLogSerial}

func TestInStreamGatewayErrorKeepsEnvelopeWithoutStatus(t *testing.T) {
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `{"error_code":"ERR-17-008","message":"upstream stream failed","details":[{"field":"container","message":"gone"}],"suggestions":["Retry later"],"links":[{"url":"https://docs.phala.com/x","label":"Docs"}],"request_id":"req-1"}`+"\n")
	})
	_, errs := client.FollowCVMLogs(context.Background(), "app_test", containerSource, nil)
	apiErr := asAPIError(t, <-errs)
	if apiErr.StatusCode != 0 || apiErr.ErrorCode != "ERR-17-008" || apiErr.Message != "upstream stream failed" {
		t.Fatalf("error = %+v", apiErr)
	}
	if len(apiErr.Details) != 1 || apiErr.Details[0].Field != "container" ||
		len(apiErr.Suggestions) != 1 || len(apiErr.Links) != 1 || apiErr.RequestID != "req-1" {
		t.Fatalf("envelope fields lost: %+v", apiErr)
	}
	if apiErr.Error() != "upstream stream failed" {
		t.Fatalf("Error() = %q", apiErr.Error())
	}
	if rec.count() != 5 {
		t.Fatalf("connections = %d, want 5", rec.count())
	}
}

func TestHTTPLogErrorKeepsEnvelope(t *testing.T) {
	client, _ := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
		_, _ = io.WriteString(w, `{"error_code":"ERR-17-007","message":"Container not found","details":[{"field":"name","value":"app","message":"unknown"}],"suggestions":["List containers"],"links":[{"url":"https://docs.phala.com/y"}],"request_id":"req-2"}`)
	})
	_, err := client.FetchCVMLogs(context.Background(), "app_test", containerSource, nil)
	apiErr := asAPIError(t, err)
	if apiErr.StatusCode != 404 || apiErr.ErrorCode != "ERR-17-007" || apiErr.Message != "Container not found" {
		t.Fatalf("error = %+v", apiErr)
	}
	if len(apiErr.Details) != 1 || apiErr.Details[0].Field != "name" || len(apiErr.Suggestions) != 1 ||
		len(apiErr.Links) != 1 || apiErr.RequestID != "req-2" {
		t.Fatalf("envelope fields lost: %+v", apiErr)
	}
	if strings.Contains(apiErr.Message, "ERR-17") || strings.Contains(apiErr.Message, "List containers") {
		t.Fatalf("message must be the human text only: %q", apiErr.Message)
	}
}

func TestFollowPartialOutputThenReadErrorRecovers(t *testing.T) {
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, ndjsonRecord("stdout", fmt.Sprintf("2026-11-09T12:00:%02d.5Z line%d\n", n, n)))
		abortConnection(w)
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	lines, errs := client.FollowCVMLogs(ctx, "app_test", containerSource, nil)
	// Seven connections that each deliver a record and then fail: without the
	// recovered rule the fifth failure would stop the follow.
	for i := 1; i <= 7; i++ {
		select {
		case line := <-lines:
			if want := fmt.Sprintf("line%d\n", i); line != want {
				t.Fatalf("line %d = %q, want %q", i, line, want)
			}
		case err := <-errs:
			t.Fatalf("follow stopped after %d lines: %v", i-1, err)
		case <-time.After(5 * time.Second):
			t.Fatalf("timeout after %d lines", i-1)
		}
	}
	cancel()
	_, times := rec.snapshot()
	if gap := times[1].Sub(times[0]); gap < 200*time.Millisecond {
		t.Fatalf("reconnect after a read error did not back off: %v", gap)
	}
}

func TestFollowEmptyEndsInterleavedWithFailures(t *testing.T) {
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		if n%2 == 1 {
			w.WriteHeader(500)
			_, _ = io.WriteString(w, `{"message":"boom"}`)
		}
	})
	_, errs := client.FollowCVMLogs(context.Background(), "app_test", containerSource, nil)
	var err error
	select {
	case err = <-errs:
	case <-time.After(15 * time.Second):
		t.Fatal("timeout")
	}
	apiErr := asAPIError(t, err)
	// Empty ends neither reset the failure counter nor accumulate between failures.
	if apiErr.StatusCode != 500 {
		t.Fatalf("got %v, want the fifth HTTP 500", err)
	}
	if rec.count() != 9 {
		t.Fatalf("connections = %d, want 9 (5 failures, 4 empty ends)", rec.count())
	}
}

func TestFollowFailureResetsEmptyEndCounter(t *testing.T) {
	// empty, empty, failure, empty, empty, empty, record: five empty ends in
	// total, but the failure resets the counter so the follow keeps going.
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		switch n {
		case 3:
			w.WriteHeader(502)
		case 7:
			_, _ = io.WriteString(w, ndjsonRecord("stdout", "2026-11-09T12:00:00Z ok\n"))
		}
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	lines, errs := client.FollowCVMLogs(ctx, "app_test", containerSource, nil)
	select {
	case line := <-lines:
		if line != "ok\n" {
			t.Fatalf("line = %q", line)
		}
	case err := <-errs:
		t.Fatalf("follow stopped: %v", err)
	case <-time.After(10 * time.Second):
		t.Fatal("timeout")
	}
	cancel()
	if rec.count() != 7 {
		t.Fatalf("connections = %d, want 7", rec.count())
	}
}

func TestFollowLongIdleEOFKeepsFollowing(t *testing.T) {
	var mu sync.Mutex
	clock := time.Unix(1794225600, 0)
	stubFollowNow(t, func() time.Time {
		mu.Lock()
		defer mu.Unlock()
		clock = clock.Add(11 * time.Second)
		return clock
	})
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		if n == 8 {
			_, _ = io.WriteString(w, ndjsonRecord("stdout", "2026-11-09T12:00:00Z finally\n"))
		}
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	start := time.Now()
	lines, errs := client.FollowCVMLogs(ctx, "app_test", containerSource, nil)
	select {
	case line := <-lines:
		if line != "finally\n" {
			t.Fatalf("line = %q", line)
		}
	case err := <-errs:
		t.Fatalf("idle EOFs must not stop the follow: %v", err)
	case <-time.After(5 * time.Second):
		t.Fatal("timeout")
	}
	cancel()
	if rec.count() != 8 {
		t.Fatalf("connections = %d, want 8", rec.count())
	}
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Fatalf("idle EOF reconnects should be immediate, took %v", elapsed)
	}
}

func TestQuietTail0TextReconnectUsesFirst200Since(t *testing.T) {
	stubFollowNow(t, func() time.Time { return time.Unix(1794225600, 0) })
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		if n > 1 {
			_, _ = io.WriteString(w, "2026-11-09T12:00:00.1Z later\n")
		}
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	lines, errs := client.FollowCVMLogs(ctx, "app_test", containerSource, &LogsOptions{Tail: 0, Format: "text"})
	select {
	case line := <-lines:
		if line != "later\n" {
			t.Fatalf("line = %q", line)
		}
	case err := <-errs:
		t.Fatal(err)
	case <-time.After(5 * time.Second):
		t.Fatal("timeout")
	}
	cancel()
	queries, _ := rec.snapshot()
	if !strings.Contains(queries[0], "tail=0") || strings.Contains(queries[0], "since=") {
		t.Fatalf("first query %q", queries[0])
	}
	if !strings.Contains(queries[1], "tail=all") || !strings.Contains(queries[1], "since=1794225600") {
		t.Fatalf("second query %q", queries[1])
	}
}

func TestReconnectBeforeTimestampKeepsCallerSince(t *testing.T) {
	stubFollowNow(t, func() time.Time { return time.Unix(1794225600, 0) })
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		if n == 1 {
			abortConnection(w) // 200 accepted, then a read error before any record
			return
		}
		_, _ = io.WriteString(w, ndjsonRecord("stdout", "2026-11-09T12:00:00Z back\n"))
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	lines, errs := client.FollowCVMLogs(ctx, "app_test", containerSource, &LogsOptions{Tail: "all", Since: int64(100)})
	select {
	case line := <-lines:
		if line != "back\n" {
			t.Fatalf("line = %q", line)
		}
	case err := <-errs:
		t.Fatal(err)
	case <-time.After(5 * time.Second):
		t.Fatal("timeout")
	}
	cancel()
	queries, _ := rec.snapshot()
	if !strings.Contains(queries[0], "since=100") || !strings.Contains(queries[1], "since=100&") ||
		!strings.Contains(queries[1], "tail=all") {
		t.Fatalf("queries = %q, want since=100 kept on reconnect", queries)
	}
}

func TestFollowUntilReachedEndsWithoutError(t *testing.T) {
	until := time.Date(2026, 11, 9, 12, 0, 2, 0, time.UTC)
	records := []string{
		"2026-11-09T12:00:00.1Z one\n",
		"2026-11-09T12:00:01.1Z two\n",
		"2026-11-09T12:00:02Z three\n",
	}
	for _, format := range []string{"ndjson", "text"} {
		t.Run(format+"/cursor reaches until", func(t *testing.T) {
			stubFollowNow(t, func() time.Time { return until.Add(-time.Hour) })
			client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
				for _, msg := range records {
					if format == "text" {
						_, _ = io.WriteString(w, msg)
					} else {
						_, _ = io.WriteString(w, ndjsonRecord("stdout", msg))
					}
				}
			})
			lines, errs := client.FollowCVMLogs(context.Background(), "app_test", containerSource,
				&LogsOptions{Tail: "all", Until: until.Format(time.RFC3339), Format: format})
			got, err := collectFollow(t, lines, errs, 5*time.Second)
			if err != nil {
				t.Fatalf("until reached must finish without error: %v", err)
			}
			if strings.Join(got, "") != "one\ntwo\nthree\n" {
				t.Fatalf("got %q", got)
			}
			queries, _ := rec.snapshot()
			if len(queries) != 1 || !strings.Contains(queries[0], fmt.Sprintf("until=%d", until.Unix())) {
				t.Fatalf("queries = %v", queries)
			}
		})
		t.Run(format+"/clean end after until with older records", func(t *testing.T) {
			stubFollowNow(t, func() time.Time { return until.Add(5 * time.Second) })
			client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
				if format == "text" {
					_, _ = io.WriteString(w, records[0])
				} else {
					_, _ = io.WriteString(w, ndjsonRecord("stdout", records[0]))
				}
			})
			lines, errs := client.FollowCVMLogs(context.Background(), "app_test", containerSource,
				&LogsOptions{Until: until.Format(time.RFC3339), Format: format})
			got, err := collectFollow(t, lines, errs, 5*time.Second)
			if err != nil || strings.Join(got, "") != "one\n" {
				t.Fatalf("got %q, %v", got, err)
			}
			if rec.count() != 1 {
				t.Fatalf("connections = %d, want 1", rec.count())
			}
		})
		t.Run(format+"/clean end after until", func(t *testing.T) {
			stubFollowNow(t, func() time.Time { return until.Add(5 * time.Second) })
			client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {})
			lines, errs := client.FollowCVMLogs(context.Background(), "app_test", containerSource,
				&LogsOptions{Until: until.Format(time.RFC3339), Format: format})
			got, err := collectFollow(t, lines, errs, 5*time.Second)
			if err != nil || len(got) != 0 {
				t.Fatalf("got %q, %v", got, err)
			}
			if rec.count() != 1 {
				t.Fatalf("connections = %d, want 1", rec.count())
			}
		})
	}
	t.Run("entries", func(t *testing.T) {
		stubFollowNow(t, func() time.Time { return until.Add(-time.Hour) })
		client, _ := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
			for _, msg := range records {
				_, _ = io.WriteString(w, ndjsonRecord("stderr", msg))
			}
		})
		entries, errs := client.FollowCVMLogEntries(context.Background(), "app_test", containerSource,
			&LogsOptions{Until: until.Format(time.RFC3339)})
		got, err := collectFollow(t, entries, errs, 5*time.Second)
		if err != nil || len(got) != 3 || got[2] != (LogEntry{Channel: "stderr", Message: "three\n"}) {
			t.Fatalf("got %+v, %v", got, err)
		}
	})
}

func TestGluedGuestErrorRecordStops(t *testing.T) {
	cases := []struct {
		name   string
		format string
		body   string
		fetch  bool
	}{
		{"fetch ndjson", "ndjson", `{"error":"x"}{"channel":"stdout","message":"y\n"}` + "\n", true},
		{"follow ndjson", "ndjson", `{"error":"x"}{"channel":"stdout","message":"y\n"}` + "\n", false},
		{"fetch text", "text", `{"error":"x"}y` + "\n", true},
		{"follow text", "text", `{"error":"x"}2026-11-09T12:00:00Z y` + "\n", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
				_, _ = io.WriteString(w, tc.body)
			})
			opts := &LogsOptions{Format: tc.format}
			var err error
			if tc.fetch {
				_, err = client.FetchCVMLogs(context.Background(), "app_test", containerSource, opts)
			} else {
				lines, errs := client.FollowCVMLogs(context.Background(), "app_test", containerSource, opts)
				var got []string
				got, err = collectFollow(t, lines, errs, 5*time.Second)
				if len(got) != 0 {
					t.Fatalf("delivered %q after a guest error", got)
				}
			}
			apiErr := asAPIError(t, err)
			if apiErr.ErrorCode != "ERR-17-009" || apiErr.Message != "x" || apiErr.StatusCode != 0 {
				t.Fatalf("error = %+v", apiErr)
			}
			if apiErr.Error() != "x" {
				t.Fatalf("Error() = %q", apiErr.Error())
			}
			if rec.count() != 1 {
				t.Fatalf("connections = %d, want 1", rec.count())
			}
		})
	}
}

func TestConsoleAndStdinChannels(t *testing.T) {
	body := ndjsonRecord("console", "boot\n") + ndjsonRecord("stdin", "typed\n") + ndjsonRecord("stdout", "out\n")
	client, _ := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, body)
	})
	entries, err := client.FetchCVMLogEntries(context.Background(), "app_test", containerSource, nil)
	if err != nil {
		t.Fatal(err)
	}
	want := []LogEntry{{"console", "boot\n"}, {"stdin", "typed\n"}, {"stdout", "out\n"}}
	if fmt.Sprint(entries) != fmt.Sprint(want) {
		t.Fatalf("entries = %+v", entries)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	stream, errs := client.FollowCVMLogEntries(ctx, "app_test", containerSource, nil)
	for i, w := range want {
		select {
		case e := <-stream:
			if e != w {
				t.Fatalf("entry %d = %+v, want %+v", i, e, w)
			}
		case err := <-errs:
			t.Fatal(err)
		case <-time.After(2 * time.Second):
			t.Fatal("timeout")
		}
	}
}

func TestFollow429IsRetried(t *testing.T) {
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		if n <= 2 {
			w.WriteHeader(429)
			_, _ = io.WriteString(w, `{"error_code":"ERR-17-011","message":"Too many log streams"}`)
			return
		}
		_, _ = io.WriteString(w, ndjsonRecord("stdout", "2026-11-09T12:00:00Z ok\n"))
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	lines, errs := client.FollowCVMLogs(ctx, "app_test", containerSource, nil)
	select {
	case line := <-lines:
		if line != "ok\n" {
			t.Fatalf("line = %q", line)
		}
	case err := <-errs:
		t.Fatalf("429 must be retried: %v", err)
	case <-time.After(5 * time.Second):
		t.Fatal("timeout")
	}
	cancel()
	if rec.count() < 3 {
		t.Fatalf("connections = %d", rec.count())
	}
}

func TestFollowExpiredURLRefetchesThreeTimes(t *testing.T) {
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		_, _ = io.WriteString(w, `{"error_code":"ERR-17-003","message":"Log URL expired"}`)
	})
	start := time.Now()
	_, errs := client.FollowCVMLogs(context.Background(), "app_test", containerSource, nil)
	apiErr := asAPIError(t, <-errs)
	if apiErr.ErrorCode != "ERR-17-003" || apiErr.StatusCode != 401 {
		t.Fatalf("error = %+v", apiErr)
	}
	if rec.count() != 4 {
		t.Fatalf("connections = %d, want 4 (1 + 3 refetches)", rec.count())
	}
	if rec.infoCalls() != 4 {
		t.Fatalf("CVM info lookups = %d, want one per connection", rec.infoCalls())
	}
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("expired-URL refetch must not back off: %v", elapsed)
	}
}

func TestFollowInvalidSignatureCountsAsFailure(t *testing.T) {
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		_, _ = io.WriteString(w, `{"error_code":"ERR-17-002","message":"Invalid log URL signature"}`)
	})
	_, errs := client.FollowCVMLogs(context.Background(), "app_test", serialSource, nil)
	apiErr := asAPIError(t, <-errs)
	if apiErr.ErrorCode != "ERR-17-002" {
		t.Fatalf("error = %+v", apiErr)
	}
	if rec.count() != 5 || rec.infoCalls() != 5 {
		t.Fatalf("connections = %d, lookups = %d, want 5 each", rec.count(), rec.infoCalls())
	}
}

func TestFollowOther4xxStops(t *testing.T) {
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(400)
		_, _ = io.WriteString(w, `{"error_code":"ERR-17-001","message":"bad parameter"}`)
	})
	_, errs := client.FollowCVMLogs(context.Background(), "app_test", containerSource, nil)
	apiErr := asAPIError(t, <-errs)
	if apiErr.StatusCode != 400 || rec.count() != 1 {
		t.Fatalf("error = %+v, connections = %d", apiErr, rec.count())
	}
}

func TestFollowCancelDuringBackoffReturnsPromptly(t *testing.T) {
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(503)
	})
	ctx, cancel := context.WithCancel(context.Background())
	lines, errs := client.FollowCVMLogs(ctx, "app_test", containerSource, nil)
	// Wait for the third connection: the next backoff is 1 s.
	for rec.count() < 3 {
		time.Sleep(10 * time.Millisecond)
	}
	time.Sleep(50 * time.Millisecond)
	cancelled := time.Now()
	cancel()
	got, err := collectFollow(t, lines, errs, 2*time.Second)
	if err != nil || len(got) != 0 {
		t.Fatalf("cancel must end the follow without error: %q, %v", got, err)
	}
	if elapsed := time.Since(cancelled); elapsed > 200*time.Millisecond {
		t.Fatalf("cancel during backoff took %v", elapsed)
	}
}

func TestANSIStrippedUnlessRequested(t *testing.T) {
	const colored = "\x1b[31mred\x1b[0m done\n"
	t.Run("ndjson", func(t *testing.T) {
		client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
			_, _ = io.WriteString(w, ndjsonRecord("stdout", colored))
		})
		got, err := client.FetchCVMLogs(context.Background(), "app_test", containerSource, nil)
		if err != nil || got != "red done\n" {
			t.Fatalf("got %q, %v", got, err)
		}
		kept, err := client.FetchCVMLogs(context.Background(), "app_test", containerSource, &LogsOptions{ANSI: true})
		if err != nil || kept != colored {
			t.Fatalf("ANSI=true with the default format must keep escapes: %q, %v", kept, err)
		}
		for _, opts := range []*LogsOptions{{ANSI: true, Format: "ndjson"}, {ANSI: true}} {
			entries, err := client.FetchCVMLogEntries(context.Background(), "app_test", containerSource, opts)
			if err != nil || entries[0].Message != colored {
				t.Fatalf("ANSI=true with NDJSON must keep escapes: %+v, %v", entries, err)
			}
		}
		for _, q := range func() []string { q, _ := rec.snapshot(); return q }() {
			if strings.Contains(q, "ansi=") {
				t.Fatalf("ansi must not be sent with format=ndjson: %q", q)
			}
		}
	})
	t.Run("follow ndjson", func(t *testing.T) {
		client, _ := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
			_, _ = io.WriteString(w, ndjsonRecord("stdout", "2026-11-09T12:00:00Z "+colored))
		})
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		entries, errs := client.FollowCVMLogEntries(ctx, "app_test", containerSource, nil)
		select {
		case e := <-entries:
			if e.Message != "red done\n" {
				t.Fatalf("entry = %q", e.Message)
			}
		case err := <-errs:
			t.Fatal(err)
		case <-time.After(2 * time.Second):
			t.Fatal("timeout")
		}
	})
	t.Run("follow text", func(t *testing.T) {
		client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
			_, _ = io.WriteString(w, "2026-11-09T12:00:00Z "+colored)
		})
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		lines, errs := client.FollowCVMLogs(ctx, "app_test", containerSource, &LogsOptions{Format: "text"})
		select {
		case line := <-lines:
			if line != "red done\n" {
				t.Fatalf("line = %q", line)
			}
		case err := <-errs:
			t.Fatal(err)
		case <-time.After(2 * time.Second):
			t.Fatal("timeout")
		}
		cancel()
		if q, _ := rec.snapshot(); strings.Contains(q[0], "ansi=") {
			t.Fatalf("ansi sent without ANSI=true: %q", q[0])
		}
	})
	t.Run("node", func(t *testing.T) {
		client, _ := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
			_, _ = io.WriteString(w, colored)
		})
		got, err := client.FetchCVMLogs(context.Background(), "app_test", serialSource, nil)
		if err != nil || got != "red done\n" {
			t.Fatalf("got %q, %v", got, err)
		}
	})
}

func TestStripANSIRemovesAllEscapeSequences(t *testing.T) {
	cases := map[string]string{
		"sgr":                  "\x1b[1;31mred\x1b[0m",
		"csi private mode":     "\x1b[?25lred\x1b[?25h",
		"csi cursor":           "\x1b[2K\x1b[1Ared",
		"osc 8 bel":            "\x1b]8;;https://example.com\x07red\x1b]8;;\x07",
		"osc 8 st":             "\x1b]8;;https://example.com\x1b\\red\x1b]8;;\x1b\\",
		"osc title":            "\x1b]0;title\x07red",
		"two-byte and charset": "\x1bcred\x1b(B\x1b7",
	}
	for name, in := range cases {
		if got := applyANSIPolicy(in, false); got != "red" {
			t.Errorf("%s: got %q", name, got)
		}
		if got := applyANSIPolicy(in, true); got != in {
			t.Errorf("%s: ANSI=true changed output to %q", name, got)
		}
	}
	client, _ := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, ndjsonRecord("stdout", "\x1b[?25l\x1b]8;;https://example.com\x07link\x1b]8;;\x07\n"))
	})
	got, err := client.FetchCVMLogs(context.Background(), "app_test", containerSource, nil)
	if err != nil || got != "link\n" {
		t.Fatalf("got %q, %v", got, err)
	}
}

func TestNodeStreamsTreatOnlyGatewayLinesAsErrors(t *testing.T) {
	const body = `{"error":"x"}` + "\n" + "after\n"
	client, _ := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		if n <= 2 {
			_, _ = io.WriteString(w, body)
		}
	})
	got, err := client.FetchCVMLogs(context.Background(), "app_test", serialSource, nil)
	if err != nil || got != body {
		t.Fatalf("fetch: got %q, %v", got, err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	lines, errs := client.FollowCVMLogs(ctx, "app_test", serialSource, nil)
	for _, want := range []string{`{"error":"x"}` + "\n", "after\n"} {
		select {
		case line := <-lines:
			if line != want {
				t.Fatalf("line = %q, want %q", line, want)
			}
		case err := <-errs:
			t.Fatalf("node output must not be a guest error: %v", err)
		case <-time.After(2 * time.Second):
			t.Fatal("timeout")
		}
	}
}

func TestTextGuestErrorOnlyAtBodyStart(t *testing.T) {
	// Mid-stream text lines that look like a guest record are application output.
	client, _ := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("follow") == "true" {
			_, _ = io.WriteString(w, "2026-11-09T12:00:00Z ok\n"+`{"error":"timeout"}`+"\n")
			return
		}
		_, _ = io.WriteString(w, "ok\n"+`{"error":"timeout"}`+"\n")
	})
	got, err := client.FetchCVMLogs(context.Background(), "app_test", containerSource, &LogsOptions{Format: "text"})
	if err != nil || got != "ok\n"+`{"error":"timeout"}`+"\n" {
		t.Fatalf("fetch: got %q, %v", got, err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	lines, errs := client.FollowCVMLogs(ctx, "app_test", containerSource, &LogsOptions{Format: "text"})
	for _, want := range []string{"ok\n", `{"error":"timeout"}` + "\n"} {
		select {
		case line := <-lines:
			if line != want {
				t.Fatalf("line = %q, want %q", line, want)
			}
		case err := <-errs:
			t.Fatalf("mid-stream JSON line must not stop the follow: %v", err)
		case <-time.After(2 * time.Second):
			t.Fatal("timeout")
		}
	}
}

func TestClientValidationErrorsAreERR17001(t *testing.T) {
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {})
	ctx := context.Background()
	_, e1 := client.FetchCVMLogs(ctx, "app_test", LogSource{Type: "container", Name: ".bad"}, nil)
	_, e2 := client.FetchCVMLogs(ctx, "app_test", serialSource, &LogsOptions{Since: "1h"})
	_, e3 := client.FetchCVMLogEntries(ctx, "app_test", containerSource, &LogsOptions{Since: "yesterday"})
	_, e4 := client.FetchCVMLogEntries(ctx, "app_test", serialSource, nil)
	_, followErrs := client.FollowCVMLogEntries(ctx, "app_test", serialSource, nil)
	e5 := <-followErrs
	_, e6 := client.FetchCVMLogEntries(ctx, "app_test", containerSource, &LogsOptions{Since: "999999999999999999999d"})
	for i, err := range []error{e1, e2, e3, e4, e5, e6} {
		apiErr := asAPIError(t, err)
		if apiErr.ErrorCode != "ERR-17-001" || apiErr.StatusCode != 0 {
			t.Fatalf("error %d = %+v", i+1, apiErr)
		}
	}
	if rec.infoCalls() != 0 || rec.count() != 0 {
		t.Fatalf("requests were made: info=%d logs=%d", rec.infoCalls(), rec.count())
	}
}

func TestLogRedirectIsAnError(t *testing.T) {
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Location", "https://example.com/elsewhere")
		w.WriteHeader(http.StatusFound)
	})
	_, err := client.FetchCVMLogs(context.Background(), "app_test", containerSource, nil)
	if apiErr := asAPIError(t, err); apiErr.StatusCode != 302 || apiErr.Message != "HTTP 302" {
		t.Fatalf("fetch error = %+v", apiErr)
	}
	_, errs := client.FollowCVMLogs(context.Background(), "app_test", serialSource, nil)
	if apiErr := asAPIError(t, <-errs); apiErr.StatusCode != 302 {
		t.Fatalf("follow error = %+v", apiErr)
	}
	if rec.count() != 2 {
		t.Fatalf("connections = %d, want 2 (redirect not followed, follow stops)", rec.count())
	}
}

// lookupFailingTransport fails the first API lookups, then serves the API normally.
type lookupFailingTransport struct {
	mu       sync.Mutex
	failures []int // per API request: status to return, or -1 for a network error
	lookups  int
}

func (tr *lookupFailingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	tr.mu.Lock()
	i := tr.lookups
	tr.lookups++
	tr.mu.Unlock()
	if i < len(tr.failures) {
		if tr.failures[i] < 0 {
			return nil, errors.New("connection reset")
		}
		return &http.Response{
			StatusCode: tr.failures[i], Header: http.Header{},
			Body: io.NopCloser(strings.NewReader(`{"message":"gateway"}`)), Request: req,
		}, nil
	}
	return http.DefaultTransport.RoundTrip(req)
}

func TestFollowEnforcesMinimumConnectionInterval(t *testing.T) {
	for _, tc := range []struct {
		name   string
		source LogSource
		body   string
	}{
		// The VMM answers 200 with one plain-text error line and ends at once.
		{"node", serialSource, "<failed to read line: stream did not contain valid UTF-8>\n"},
		{"container", containerSource, ndjsonRecord("stdout", "2026-11-09T12:00:00Z once\n")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
				_, _ = io.WriteString(w, tc.body)
			})
			setMinConnectionInterval(t, time.Second)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			lines, errs := client.FollowCVMLogs(ctx, "app_test", tc.source, nil)
			go func() {
				for range lines {
				}
			}()
			deadline := time.After(5 * time.Second)
			for rec.count() < 3 {
				select {
				case err := <-errs:
					t.Fatalf("follow stopped: %v", err)
				case <-deadline:
					t.Fatalf("connections = %d", rec.count())
				case <-time.After(10 * time.Millisecond):
				}
			}
			cancel()
			for range errs { // wait for the follow goroutine before cleanup resets the interval
			}
			_, times := rec.snapshot()
			for i := 1; i < 3; i++ {
				if gap := times[i].Sub(times[i-1]); gap < 950*time.Millisecond {
					t.Fatalf("connection %d started %v after the previous one, want >= 1s", i+1, gap)
				}
			}
		})
	}
}

func TestFollowCancelDuringConnectionIntervalReturnsPromptly(t *testing.T) {
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "line\n")
	})
	setMinConnectionInterval(t, time.Hour)
	ctx, cancel := context.WithCancel(context.Background())
	lines, errs := client.FollowCVMLogs(ctx, "app_test", serialSource, nil)
	<-lines
	for rec.count() < 1 {
		time.Sleep(5 * time.Millisecond)
	}
	time.Sleep(50 * time.Millisecond)
	cancelled := time.Now()
	cancel()
	if _, err := collectFollow(t, lines, errs, 2*time.Second); err != nil {
		t.Fatal(err)
	}
	if elapsed := time.Since(cancelled); elapsed > 200*time.Millisecond {
		t.Fatalf("cancel during the connection interval took %v", elapsed)
	}
}

func TestFollowRetriesTransientLookupFailures(t *testing.T) {
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, ndjsonRecord("stdout", "2026-11-09T12:00:00Z up\n"))
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{"containers": []map[string]any{{
				"id": "c1", "names": []string{"/app"},
			}}})
			return
		}
		_ = json.NewEncoder(w).Encode(containerInfo(logs.URL))
	}))
	defer api.Close()
	newClient := func(tr *lookupFailingTransport) *Client {
		client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL), WithMaxRetries(0),
			WithHTTPClient(&http.Client{Transport: tr}))
		if err != nil {
			t.Fatal(err)
		}
		return client
	}

	t.Run("502, 429 and network error then success", func(t *testing.T) {
		tr := &lookupFailingTransport{failures: []int{502, 429, -1}}
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		lines, errs := newClient(tr).FollowCVMLogs(ctx, "app_test", containerSource, nil)
		select {
		case line := <-lines:
			if line != "up\n" {
				t.Fatalf("line = %q", line)
			}
		case err := <-errs:
			t.Fatalf("transient lookup failure must be retried: %v", err)
		case <-time.After(5 * time.Second):
			t.Fatal("timeout")
		}
	})
	t.Run("gives up after five", func(t *testing.T) {
		tr := &lookupFailingTransport{failures: []int{502, 502, 502, 502, 502, 502}}
		_, errs := newClient(tr).FollowCVMLogs(context.Background(), "app_test", containerSource, nil)
		var err error
		select {
		case err = <-errs:
		case <-time.After(10 * time.Second):
			t.Fatal("timeout")
		}
		if asAPIError(t, err).StatusCode != 502 || tr.lookups != 5 {
			t.Fatalf("got %v after %d lookups, want 502 after 5", err, tr.lookups)
		}
	})
	t.Run("4xx lookup stops", func(t *testing.T) {
		tr := &lookupFailingTransport{failures: []int{404}}
		_, errs := newClient(tr).FollowCVMLogs(context.Background(), "app_test", containerSource, nil)
		if err := <-errs; asAPIError(t, err).StatusCode != 404 || tr.lookups != 1 {
			t.Fatalf("got %v after %d lookups", err, tr.lookups)
		}
	})
}

func TestFollowCVMLogEntries(t *testing.T) {
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, ndjsonRecord("stdout", "2026-11-09T12:00:00.5Z hello\n")+ndjsonRecord("stderr", "2026-11-09T12:00:00.6Z oops\n"))
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	entries, errs := client.FollowCVMLogEntries(ctx, "app_test", containerSource, &LogsOptions{Tail: 10})
	want := []LogEntry{{"stdout", "hello\n"}, {"stderr", "oops\n"}}
	for i, w := range want {
		select {
		case e := <-entries:
			if e != w {
				t.Fatalf("entry %d = %+v, want %+v", i, e, w)
			}
		case err := <-errs:
			t.Fatal(err)
		case <-time.After(2 * time.Second):
			t.Fatal("timeout")
		}
	}
	cancel()
	queries, _ := rec.snapshot()
	for _, p := range []string{"follow=true", "tail=10", "timestamps=true", "format=ndjson"} {
		if !strings.Contains(queries[0], p) {
			t.Fatalf("first query %q missing %s", queries[0], p)
		}
	}

	t.Run("timestamps kept when requested", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		entries, errs := client.FollowCVMLogEntries(ctx, "app_test", containerSource, &LogsOptions{Timestamps: true})
		select {
		case e := <-entries:
			if e.Message != "2026-11-09T12:00:00.5Z hello\n" {
				t.Fatalf("entry = %+v", e)
			}
		case err := <-errs:
			t.Fatal(err)
		case <-time.After(2 * time.Second):
			t.Fatal("timeout")
		}
	})
	t.Run("node source rejected", func(t *testing.T) {
		entries, errs := client.FollowCVMLogEntries(context.Background(), "app_test", serialSource, nil)
		got, err := collectFollow(t, entries, errs, time.Second)
		if err == nil || len(got) != 0 || !strings.Contains(err.Error(), "container") {
			t.Fatalf("got %+v, %v", got, err)
		}
	})
}

func TestOutputIsByteIdentical(t *testing.T) {
	t.Run("node follow final line without newline", func(t *testing.T) {
		client, _ := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
			if n == 1 {
				_, _ = io.WriteString(w, "first\n[vmm heartbeat]\nlast")
			}
		})
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		lines, errs := client.FollowCVMLogs(ctx, "app_test", serialSource, nil)
		var got []string
		for len(got) < 2 {
			select {
			case line := <-lines:
				got = append(got, line)
			case err := <-errs:
				t.Fatal(err)
			case <-time.After(2 * time.Second):
				t.Fatal("timeout")
			}
		}
		if got[0] != "first\n" || got[1] != "last" {
			t.Fatalf("got %q", got)
		}
	})
	t.Run("container text follow final line without newline", func(t *testing.T) {
		client, _ := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
			if n == 1 {
				_, _ = io.WriteString(w, "2026-11-09T12:00:00Z a\n2026-11-09T12:00:01Z b")
			}
		})
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		lines, errs := client.FollowCVMLogs(ctx, "app_test", containerSource, &LogsOptions{Format: "text"})
		var got []string
		for len(got) < 2 {
			select {
			case line := <-lines:
				got = append(got, line)
			case err := <-errs:
				t.Fatal(err)
			case <-time.After(2 * time.Second):
				t.Fatal("timeout")
			}
		}
		if got[0] != "a\n" || got[1] != "b" {
			t.Fatalf("got %q", got)
		}
	})
	t.Run("fetch", func(t *testing.T) {
		bodies := map[string]string{
			"node":   "x\n[teepod heartbeat]\ny",
			"text":   "p\nq",
			"ndjson": ndjsonRecord("stdout", "m\n") + ndjsonRecord("stdout", "") + ndjsonRecord("stderr", "tail"),
		}
		want := map[string]string{"node": "x\ny", "text": "p\nq", "ndjson": "m\ntail"}
		for name, body := range bodies {
			client, _ := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
				_, _ = io.WriteString(w, body)
			})
			source, opts := containerSource, &LogsOptions{Format: name}
			if name == "node" {
				source, opts = serialSource, nil
			}
			got, err := client.FetchCVMLogs(context.Background(), "app_test", source, opts)
			if err != nil || got != want[name] {
				t.Fatalf("%s: got %q, %v; want %q", name, got, err, want[name])
			}
		}
	})
	t.Run("empty ndjson message stays empty", func(t *testing.T) {
		client, _ := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
			_, _ = io.WriteString(w, ndjsonRecord("stdout", "2026-11-09T12:00:00Z "))
		})
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		lines, errs := client.FollowCVMLogs(ctx, "app_test", containerSource, nil)
		select {
		case line := <-lines:
			if line != "" {
				t.Fatalf("line = %q, want empty", line)
			}
		case err := <-errs:
			t.Fatal(err)
		case <-time.After(2 * time.Second):
			t.Fatal("timeout")
		}
	})
}

func TestInvalidContainerNameRejectedBeforeRequest(t *testing.T) {
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {})
	_, err := client.FetchCVMLogs(context.Background(), "app_test", LogSource{Type: "container", Name: "app%2F..%2Fx"}, nil)
	if err == nil || !strings.Contains(err.Error(), "invalid container name") {
		t.Fatalf("got %v", err)
	}
	_, errs := client.FollowCVMLogs(context.Background(), "app_test", LogSource{Type: "container", Name: "a b"}, nil)
	if err := <-errs; err == nil || !strings.Contains(err.Error(), "invalid container name") {
		t.Fatalf("got %v", err)
	}
	if rec.infoCalls() != 0 || rec.count() != 0 {
		t.Fatalf("requests were made: info=%d logs=%d", rec.infoCalls(), rec.count())
	}
}

func TestContainerNameMatchesGatewayRule(t *testing.T) {
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {})
	for _, name := range []string{".app", "-x", "_x", "a..b", "..", strings.Repeat("a", 129)} {
		_, err := client.FetchCVMLogEntries(context.Background(), "app_test", LogSource{Type: "container", Name: name}, nil)
		if err == nil || !strings.Contains(err.Error(), "invalid container name") {
			t.Fatalf("%q: got %v", name, err)
		}
		entries, errs := client.FollowCVMLogEntries(context.Background(), "app_test", LogSource{Type: "container", Name: name}, nil)
		if _, err := collectFollow(t, entries, errs, time.Second); err == nil || !strings.Contains(err.Error(), "invalid container name") {
			t.Fatalf("%q: follow got %v", name, err)
		}
	}
	if rec.infoCalls() != 0 || rec.count() != 0 {
		t.Fatalf("requests were made: info=%d logs=%d", rec.infoCalls(), rec.count())
	}
	for _, name := range []string{"a" + strings.Repeat("b", 127), "/web-1.v2_x", "9", "a.b.c"} {
		if _, err := containerSlug(name); err != nil {
			t.Fatalf("%q must be valid: %v", name, err)
		}
	}
}

func TestContainerLogBaseFallbackAppendsQueryRaw(t *testing.T) {
	var target string
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		target = r.RequestURI
		_, _ = io.WriteString(w, ndjsonRecord("stdout", "hi\n"))
	}))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{"containers": []map[string]any{{"id": "c1", "names": []string{"/web"}}}})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"public_logs": true,
			"logs": map[string]any{
				"container_log_base": logs.URL + "/logs/123/container/",
				"auth_query":         "exp=1&sig=ab+c/d=",
			},
		})
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	got, err := client.FetchCVMLogs(context.Background(), "app_test", LogSource{Type: "container", Name: "web"}, &LogsOptions{Tail: "all"})
	if err != nil || got != "hi\n" {
		t.Fatalf("got %q, %v", got, err)
	}
	if target != "/logs/123/container/web?exp=1&sig=ab+c/d=&tail=all&format=ndjson" {
		t.Fatalf("request target = %q", target)
	}
}

func TestFollowResolvesContainerOnceAndLooksUpInfoPerConnection(t *testing.T) {
	until := time.Date(2026, 11, 9, 12, 0, 3, 0, time.UTC)
	stubFollowNow(t, func() time.Time { return until.Add(-time.Hour) })
	for _, source := range []LogSource{{Type: "container"}, {Type: "container", Name: "app"}, {Type: "container", Name: "c1"}} {
		t.Run("name="+source.Name, func(t *testing.T) {
			client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
				// Two connections end cleanly after one record; the third reaches until.
				_, _ = io.WriteString(w, ndjsonRecord("stdout", fmt.Sprintf("2026-11-09T12:00:%02dZ r%d\n", n+(n/3), n)))
			})
			lines, errs := client.FollowCVMLogs(context.Background(), "app_test", source,
				&LogsOptions{Until: until.Format(time.RFC3339)})
			got, err := collectFollow(t, lines, errs, 5*time.Second)
			if err != nil || strings.Join(got, "") != "r1\nr2\nr3\n" {
				t.Fatalf("got %q, %v", got, err)
			}
			rec.mu.Lock()
			defer rec.mu.Unlock()
			if len(rec.uris) != 3 || rec.composition != 1 || rec.info != 3 {
				t.Fatalf("connections=%d composition=%d info=%d, want 3/1/3", len(rec.uris), rec.composition, rec.info)
			}
			for _, uri := range rec.uris {
				if !strings.HasPrefix(uri, "/logs/123/container/app?sig=abc&") {
					t.Fatalf("request target %q not built from container_log_base", uri)
				}
			}
		})
	}
}

func TestContainerResolutionErrors(t *testing.T) {
	var calls int
	logs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { calls++ }))
	defer logs.Close()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{"containers": []map[string]any{
				{"id": "abc111", "names": []string{"/web"}},
				{"id": "abc222", "names": []string{"/worker"}},
			}})
			return
		}
		_ = json.NewEncoder(w).Encode(containerInfo(logs.URL))
	}))
	defer api.Close()
	client, err := NewClient(WithAPIKey("k"), WithBaseURL(api.URL))
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.FetchCVMLogEntries(context.Background(), "app_test", LogSource{Type: "container", Name: "missing"}, nil)
	if apiErr := asAPIError(t, err); apiErr.ErrorCode != "ERR-17-007" || apiErr.Message != "Container not found" || apiErr.StatusCode != 0 {
		t.Fatalf("not found = %+v", apiErr)
	}
	_, errs := client.FollowCVMLogs(context.Background(), "app_test", LogSource{Type: "container", Name: "abc"}, nil)
	apiErr := asAPIError(t, <-errs)
	if apiErr.ErrorCode != "ERR-17-001" || apiErr.StatusCode != 0 ||
		!strings.Contains(apiErr.Message, "web") || !strings.Contains(apiErr.Message, "worker") {
		t.Fatalf("ambiguous prefix = %+v", apiErr)
	}
	if calls != 0 {
		t.Fatalf("log requests = %d, want 0", calls)
	}
}

func TestCompositionErrorIsSurfaced(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/composition") {
			_ = json.NewEncoder(w).Encode(map[string]any{"containers": nil, "error": "CVM is not running"})
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
	if apiErr := asAPIError(t, err); apiErr.Message != "CVM is not running" || apiErr.StatusCode != 0 {
		t.Fatalf("got %+v", apiErr)
	}
}

func TestFollowLogRequestSendsUserAgent(t *testing.T) {
	client, rec := newLogTestClient(t, func(n int, w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "line\n")
	})
	client.userAgent = "MyApp/1.0 " + client.userAgent
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	lines, errs := client.FollowCVMLogs(ctx, "app_test", serialSource, nil)
	select {
	case <-lines:
	case err := <-errs:
		t.Fatal(err)
	case <-time.After(2 * time.Second):
		t.Fatal("timeout")
	}
	cancel()
	rec.mu.Lock()
	defer rec.mu.Unlock()
	if !strings.HasPrefix(rec.agents[0], "MyApp/1.0 ") {
		t.Fatalf("User-Agent = %q", rec.agents[0])
	}
}
