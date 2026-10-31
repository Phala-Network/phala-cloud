package phala

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type timeoutProbeTransport struct{ deadline chan bool }

func (p timeoutProbeTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	_, ok := r.Context().Deadline()
	p.deadline <- ok
	return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("event: complete\ndata: {\"status\":\"running\"}\n\n")), Request: r}, nil
}

func TestDefaultWatchDoesNotChangeOrdinaryTimeout(t *testing.T) {
	c, _ := NewClient(WithAPIKey("key"))
	probe := timeoutProbeTransport{deadline: make(chan bool, 2)}
	c.httpClient.Transport = probe // Stub only the external transport boundary.
	ch, err := c.WatchCVMState(context.Background(), "cvm", &WatchCVMStateOptions{Target: "running"})
	if err != nil {
		t.Fatal(err)
	}
	for range ch {
	}
	if <-probe.deadline {
		t.Fatal("default watch retained the ordinary request deadline")
	}
	_, err = c.GetCVMInfo(context.Background(), "cvm")
	if err == nil {
		t.Fatal("unexpected JSON success")
	}
	if !<-probe.deadline {
		t.Fatal("ordinary request lost its timeout")
	}
}

func TestWatchTimeoutDefaultsAndExplicitClients(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("timeout") != "300" {
			t.Errorf("timeout query %q", r.URL.RawQuery)
		}
		time.Sleep(50 * time.Millisecond)
		fmt.Fprint(w, "event: complete\ndata: {\"status\":\"running\"}\n\n")
	}))
	defer server.Close()
	for _, tc := range []struct {
		name    string
		opts    []Option
		success bool
	}{
		{"default", nil, true},
		{"explicit timeout", []Option{WithTimeout(10 * time.Millisecond)}, false},
		{"custom client", []Option{WithHTTPClient(&http.Client{Timeout: 10 * time.Millisecond})}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			opts := append([]Option{WithAPIKey("key"), WithBaseURL(server.URL)}, tc.opts...)
			c, err := NewClient(opts...)
			if err != nil {
				t.Fatal(err)
			}
			zero := 0
			ch, err := c.WatchCVMState(context.Background(), "cvm", &WatchCVMStateOptions{Target: "running", MaxRetries: &zero})
			if err != nil {
				t.Fatal(err)
			}
			var last CVMStateEvent
			for event := range ch {
				last = event
			}
			if tc.success && last.Event != "complete" {
				t.Fatalf("event: %+v", last)
			}
			if !tc.success && last.Error == nil {
				t.Fatalf("expected timeout: %+v", last)
			}
		})
	}
}
