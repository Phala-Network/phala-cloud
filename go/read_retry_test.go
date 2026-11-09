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

type retryTransport func(*http.Request) (*http.Response, error)

func (f retryTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestAutomaticReadRetries(t *testing.T) {
	for _, tc := range []struct {
		name, method string
		timeout      time.Duration
	}{
		{"GET", "GET", 5 * time.Minute},
		{"HEAD", "HEAD", 5 * time.Minute},
		{"POST", "POST", 5 * time.Minute},
		{"deadline", "GET", 45 * time.Second},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				calls, start := 0, time.Now()
				client, err := NewClient(WithAPIKey("test-key"), WithMaxRetries(1), WithHTTPClient(&http.Client{
					Timeout: 30 * time.Second,
					Transport: retryTransport(func(*http.Request) (*http.Response, error) {
						calls++
						status := http.StatusOK
						if calls == 1 {
							status = http.StatusTooManyRequests
						}
						return &http.Response{StatusCode: status, Header: http.Header{"Retry-After": {"60"}}, Body: io.NopCloser(strings.NewReader("{}"))}, nil
					}),
				}))
				if err != nil {
					t.Fatal(err)
				}
				ctx, cancel := context.WithTimeout(context.Background(), tc.timeout)
				defer cancel()
				err = client.doJSON(ctx, tc.method, "/test", nil, nil)
				switch tc.name {
				case "POST":
					var apiErr *APIError
					if !errors.As(err, &apiErr) || apiErr.StatusCode != 429 || calls != 1 {
						t.Fatalf("calls=%d err=%v", calls, err)
					}
				case "deadline":
					if !errors.Is(err, context.DeadlineExceeded) || calls != 1 {
						t.Fatalf("calls=%d err=%v", calls, err)
					}
				default:
					if err != nil || calls != 2 || time.Since(start) != time.Minute {
						t.Fatalf("calls=%d elapsed=%s err=%v", calls, time.Since(start), err)
					}
				}
			})
		})
	}
}
