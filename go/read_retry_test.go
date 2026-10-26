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

func TestReadRetryBackoffAndExhaustion(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		start := time.Now()
		var times []time.Duration
		c := readRetryClient(t, func(*http.Request) (*http.Response, error) {
			times = append(times, time.Since(start))
			return retryResponse(429, "", `{}`), nil
		}, 7)
		_, err := c.GetCVMInfo(context.Background(), "test-vm")
		var apiErr *APIError
		if !errors.As(err, &apiErr) || apiErr.StatusCode != 429 {
			t.Fatalf("want final throttling error, got %v", err)
		}
		want := []time.Duration{0, 1, 3, 7, 15, 31, 51, 71}
		if len(times) != len(want) {
			t.Fatalf("attempts=%d, want %d", len(times), len(want))
		}
		for i := range want {
			if times[i] != want[i]*time.Second {
				t.Errorf("attempt %d at %v, want %v", i, times[i], want[i]*time.Second)
			}
		}
	})
}

func TestReadRetryStopsAtOperationDeadline(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		calls := 0
		c := readRetryClient(t, func(*http.Request) (*http.Response, error) {
			calls++
			return retryResponse(429, "60", `{}`), nil
		}, 30)
		ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		defer cancel()
		_, err := c.GetCVMInfo(ctx, "test-vm")
		if !errors.Is(err, context.DeadlineExceeded) || calls != 1 {
			t.Fatalf("calls=%d err=%v; want deadline without another attempt", calls, err)
		}
	})
}

func TestReadRetryCancellation(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		done := make(chan struct{})
		calls := 0
		c := readRetryClient(t, func(*http.Request) (*http.Response, error) {
			calls++
			go func() { time.Sleep(time.Second); cancel(); close(done) }()
			return retryResponse(429, "60", `{}`), nil
		}, 30)
		_, err := c.GetCVMInfo(ctx, "test-vm")
		<-done
		if !errors.Is(err, context.Canceled) || calls != 1 {
			t.Fatalf("calls=%d err=%v; want cancellation without retry", calls, err)
		}
	})
}

func TestReadRetryDoesNotReplayWritesOrPermanentErrors(t *testing.T) {
	for _, tc := range []struct {
		method string
		status int
		body   string
	}{
		{"POST", 429, `{}`}, {"PATCH", 503, `{}`}, {"DELETE", 409, `{}`},
		{"GET", 400, `{}`}, {"GET", 401, `{}`}, {"GET", 403, `{}`},
		{"GET", 409, `{"error_code":"DETERMINISTIC_CONFLICT"}`},
	} {
		t.Run(tc.method+http.StatusText(tc.status), func(t *testing.T) {
			calls := 0
			c := readRetryClient(t, func(*http.Request) (*http.Response, error) {
				calls++
				return retryResponse(tc.status, "", tc.body), nil
			}, 2)
			err := c.doJSON(context.Background(), tc.method, "/test", nil, nil)
			if err == nil || calls != 1 {
				t.Fatalf("calls=%d err=%v; want one failed request", calls, err)
			}
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

func TestReadRetryHTTPDateAndTransientStatuses(t *testing.T) {
	for _, status := range []int{409, 429, 503} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				start := time.Now()
				calls := 0
				c := readRetryClient(t, func(*http.Request) (*http.Response, error) {
					calls++
					if calls == 1 {
						return retryResponse(status, start.Add(time.Minute).Format(http.TimeFormat), `{}`), nil
					}
					return retryResponse(200, "", `{}`), nil
				}, 1)
				_, err := c.GetCVMInfo(context.Background(), "test-vm")
				if err != nil || calls != 2 || time.Since(start) != time.Minute {
					t.Fatalf("calls=%d delay=%v err=%v", calls, time.Since(start), err)
				}
			})
		})
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

func TestReadRetryBudgetValidation(t *testing.T) {
	if _, err := NewClient(WithAPIKey("test-key"), WithMaxRetries(-1)); err == nil {
		t.Fatal("negative retry budget must be rejected")
	}
	calls := 0
	c := readRetryClient(t, func(*http.Request) (*http.Response, error) {
		calls++
		return retryResponse(429, "60", `{}`), nil
	}, 0)
	_, err := c.GetCVMInfo(context.Background(), "test-vm")
	if err == nil || calls != 1 {
		t.Fatalf("zero retry budget: calls=%d err=%v", calls, err)
	}
}

func TestReadRetryHeaderCannotOverflowIntoImmediateRetry(t *testing.T) {
	for _, header := range []string{"-1", "9223372036854775808", "999999999999999999999999999999"} {
		synctest.Test(t, func(t *testing.T) {
			calls := 0
			c := readRetryClient(t, func(*http.Request) (*http.Response, error) {
				calls++
				return retryResponse(429, header, `{}`), nil
			}, 1)
			ctx, cancel := context.WithTimeout(context.Background(), time.Second/2)
			defer cancel()
			_, err := c.GetCVMInfo(ctx, "test-vm")
			if !errors.Is(err, context.DeadlineExceeded) || calls != 1 {
				t.Fatalf("header=%q calls=%d err=%v", header, calls, err)
			}
		})
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
