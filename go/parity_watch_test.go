package phala

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestWatchReconnectAndPermanentFailure(t *testing.T) {
	for _, tc := range []struct {
		name, first string
		status      int
		wantCalls   int
	}{
		{"timeout", "event: timeout\ndata: {}\n\n", 200, 2},
		{"eof", "event: state\ndata: {}\n\n", 200, 2},
		{"unauthorized", "", 401, 1},
		{"not implemented", "", 501, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var calls atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				n := calls.Add(1)
				if tc.status != 200 {
					w.Header().Set("X-Request-ID", "request-id")
					w.WriteHeader(tc.status)
					fmt.Fprint(w, `{"detail":"denied"}`)
					return
				}
				if n == 1 {
					fmt.Fprint(w, tc.first)
					return
				}
				fmt.Fprint(w, "event: complete\ndata: {\"status\":\"running\"}\n\n")
			}))
			defer server.Close()
			c, err := NewClient(WithAPIKey("key"), WithBaseURL(server.URL))
			if err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			max := 1
			events, err := c.WatchCVMState(ctx, "cvm", &WatchCVMStateOptions{Target: "running", MaxRetries: &max, RetryDelay: time.Millisecond})
			if err != nil {
				t.Fatal(err)
			}
			var last CVMStateEvent
			for event := range events {
				last = event
			}
			if calls.Load() != int32(tc.wantCalls) {
				t.Fatalf("calls %d, want %d", calls.Load(), tc.wantCalls)
			}
			if tc.status != 200 {
				var apiErr *APIError
				if !errors.As(last.Error, &apiErr) || apiErr.StatusCode != tc.status || apiErr.Body != `{"detail":"denied"}` || apiErr.RequestID != "request-id" {
					t.Fatalf("expected API error, got %v", last.Error)
				}
			}
			if tc.status == 200 && last.Event != "complete" {
				t.Fatalf("last event: %+v", last)
			}
		})
	}
}

func TestWatchErrorEventContinues(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "event: state\ndata: {\"status\":\"booting\",\"boot_progress\":42}\n\nevent: error\ndata: {\"error\":\"temporary\"}\n\nevent: state\ndata: {\"status\":\"booting\",\"boot_progress\":100}\n\nevent: complete\ndata: {\"status\":\"running\",\"target\":\"running\"}\n\n")
	}))
	defer server.Close()
	c, _ := NewClient(WithAPIKey("key"), WithBaseURL(server.URL))
	ch, err := c.WatchCVMState(context.Background(), "cvm", &WatchCVMStateOptions{Target: "running"})
	if err != nil {
		t.Fatal(err)
	}
	var events []CVMStateEvent
	for event := range ch {
		events = append(events, event)
	}
	if len(events) != 4 || events[1].Event != "error" || events[1].Error == nil || events[3].Event != "complete" {
		t.Fatalf("events: %+v", events)
	}
}

func TestWatchMalformedCompleteDoesNotSucceed(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, "event: complete\ndata: {}\n\n") }))
	defer server.Close()
	c, _ := NewClient(WithAPIKey("key"), WithBaseURL(server.URL))
	zero := 0
	ch, err := c.WatchCVMState(context.Background(), "cvm", &WatchCVMStateOptions{Target: "running", MaxRetries: &zero})
	if err != nil {
		t.Fatal(err)
	}
	var last CVMStateEvent
	for event := range ch {
		last = event
	}
	if last.Error == nil {
		t.Fatalf("malformed complete treated as success: %+v", last)
	}
}

func TestWatchErrorThenEOF(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "event: state\ndata: {}\n\nevent: error\ndata: {\"error\":\"temporary\"}\n\n")
	}))
	defer server.Close()
	c, _ := NewClient(WithAPIKey("key"), WithBaseURL(server.URL))
	zero := 0
	ch, err := c.WatchCVMState(context.Background(), "cvm", &WatchCVMStateOptions{Target: "running", MaxRetries: &zero})
	if err != nil {
		t.Fatal(err)
	}
	var events []CVMStateEvent
	for event := range ch {
		events = append(events, event)
	}
	var streamErr *WatchStreamError
	if len(events) != 3 || events[1].Event != "error" || !errors.Is(events[2].Error, io.ErrUnexpectedEOF) || !errors.As(events[2].Error, &streamErr) {
		t.Fatalf("events: %+v", events)
	}
}

func TestWatchTargetIsEscaped(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("target") != "running&other=1" || r.URL.Query().Has("other") {
			t.Errorf("query: %s", r.URL.RawQuery)
		}
		fmt.Fprint(w, "event: complete\ndata: {\"status\":\"running\"}\n\n")
	}))
	defer server.Close()
	c, _ := NewClient(WithAPIKey("key"), WithBaseURL(server.URL))
	ch, err := c.WatchCVMState(context.Background(), "cvm", &WatchCVMStateOptions{Target: "running&other=1"})
	if err != nil {
		t.Fatal(err)
	}
	for range ch {
	}
}

func TestWatchCancellationUnblocksDelivery(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for i := 0; i < 100; i++ {
			fmt.Fprint(w, "event: state\ndata: {}\n\n")
		}
	}))
	defer server.Close()
	c, _ := NewClient(WithAPIKey("key"), WithBaseURL(server.URL))
	ctx, cancel := context.WithCancel(context.Background())
	ch, err := c.WatchCVMState(ctx, "cvm", &WatchCVMStateOptions{Target: "running"})
	if err != nil {
		t.Fatal(err)
	}
	cancel()
	done := make(chan struct{})
	go func() {
		for range ch {
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("watch did not stop")
	}
}

func TestWatchRejectsInvalidOptions(t *testing.T) {
	c, _ := NewClient(WithAPIKey("key"))
	neg := -1
	for _, opts := range []*WatchCVMStateOptions{{}, {Target: "running", MaxRetries: &neg}, {Target: "running", Interval: 1}, {Target: "running", Timeout: 1}} {
		if _, err := c.WatchCVMState(context.Background(), "cvm", opts); err == nil {
			t.Fatalf("accepted %+v", opts)
		}
	}
}
