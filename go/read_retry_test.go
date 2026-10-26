package phala

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"testing/synctest"
	"time"
)

type readRetryTransport func(*http.Request) (*http.Response, error)

func (f readRetryTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func retryResponse(status int, after, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     http.Header{"Retry-After": {after}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func readRetryClient(t *testing.T, transport readRetryTransport, retries int) *Client {
	t.Helper()
	c, err := NewClient(WithAPIKey("test-key"), WithBaseURL("https://example.invalid"),
		WithHTTPClient(&http.Client{Transport: transport, Timeout: 30 * time.Second}), WithMaxRetries(retries))
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestReadsRetryAfterBeyondRequestTimeout(t *testing.T) {
	for _, endpoint := range []string{"info", "state", "versioned", "text", "head"} {
		t.Run(endpoint, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				start := time.Now()
				calls := 0
				c := readRetryClient(t, func(req *http.Request) (*http.Response, error) {
					calls++
					if req.Header.Get("X-API-Key") != "test-key" {
						t.Error("lost credentials on retry")
					}
					if endpoint == "versioned" && req.Header.Get("X-Phala-Version") != "2026-05-22" {
						t.Error("lost pinned API version on retry")
					}
					if calls == 1 {
						return retryResponse(429, "60", `{"detail":"Rate limit exceeded"}`), nil
					}
					if time.Since(start) < time.Minute {
						t.Error("retried before Retry-After elapsed")
					}
					return retryResponse(200, "", `{}`), nil
				}, 2)
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
				defer cancel()
				var err error
				switch endpoint {
				case "info":
					_, err = c.GetCVMInfo(ctx, "test-vm")
				case "state":
					_, err = c.GetCVMState(ctx, "test-vm")
				case "versioned":
					_, err = c.GetKMSInfo(ctx, "test-kms")
				case "text":
					_, err = c.GetCVMComposeFile(ctx, "test-vm")
				case "head":
					err = c.doEmpty(ctx, http.MethodHead, "/health")
				}
				if err != nil || calls != 2 {
					t.Fatalf("calls=%d, err=%v; want success after two requests", calls, err)
				}
			})
		})
	}
}

func TestReadRetryAlreadyCanceled(t *testing.T) {
	calls := 0
	c := readRetryClient(t, func(*http.Request) (*http.Response, error) {
		calls++
		return retryResponse(200, "", `{}`), nil
	}, 1)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := c.GetCVMInfo(ctx, "test-vm")
	if !errors.Is(err, context.Canceled) || calls != 0 {
		t.Fatalf("calls=%d err=%v; want no request after cancellation", calls, err)
	}
}

func TestReadRetryDoesNotReplayTransportOrDecodeFailure(t *testing.T) {
	for _, transportFailure := range []bool{true, false} {
		calls := 0
		c := readRetryClient(t, func(*http.Request) (*http.Response, error) {
			calls++
			if transportFailure {
				return nil, io.ErrUnexpectedEOF
			}
			return retryResponse(200, "", `{`), nil
		}, 2)
		_, err := c.GetCVMInfo(context.Background(), "test-vm")
		if err == nil || calls != 1 {
			t.Fatalf("transportFailure=%v calls=%d err=%v", transportFailure, calls, err)
		}
	}
}

func TestReadRetryRejectsNegativeBudget(t *testing.T) {
	if _, err := NewClient(WithAPIKey("test-key"), WithMaxRetries(-1)); err == nil {
		t.Fatal("negative retry budget must be rejected")
	}
}

func TestReadRetryPreservesRequestBody(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		calls := 0
		c := readRetryClient(t, func(req *http.Request) (*http.Response, error) {
			calls++
			body, err := io.ReadAll(req.Body)
			req.Body.Close()
			if err != nil || string(body) != `{"filter":"ready"}` {
				t.Errorf("attempt %d: body=%q err=%v", calls, body, err)
			}
			if calls == 1 {
				return retryResponse(429, "1", `{}`), nil
			}
			return retryResponse(200, "", `{}`), nil
		}, 1)
		err := c.doJSON(context.Background(), "GET", "/test", map[string]string{"filter": "ready"}, nil)
		if err != nil || calls != 2 {
			t.Fatalf("calls=%d err=%v", calls, err)
		}
	})
}
