package phala

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"testing"
	"testing/synctest"
	"time"
)

var (
	rateLimited60 = fakeReply{status: 429, retryAfter: "60", body: `{"detail":"Rate limit exceeded"}`}
	okReply       = fakeReply{status: 200, body: `{}`}
)

func requireAPIStatus(t *testing.T, err error, status int) *APIError {
	t.Helper()
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("err = %v (%T), want *APIError", err, err)
	}
	if apiErr.StatusCode != status {
		t.Fatalf("status = %d, want %d", apiErr.StatusCode, status)
	}
	return apiErr
}

// elapsed runs fn inside a synctest bubble and reports the virtual time it took.
func elapsed(fn func()) time.Duration {
	start := time.Now()
	fn()
	return time.Since(start)
}

func TestReadRetryBehavior(t *testing.T) {
	tests := []struct {
		name         string
		script       []fakeReply
		wantRequests int
		wantWait     time.Duration
		wantStatus   int // 0 = success
	}{
		{"429 with Retry-After then 200", []fakeReply{rateLimited60, okReply}, 2, 60 * time.Second, 0},
		{"429 without Retry-After falls back to backoff", []fakeReply{{status: 429}, okReply}, 2, retryBaseDelay, 0},
		{"503 then 200", []fakeReply{{status: 503}, okReply}, 2, retryBaseDelay, 0},
		{"two 503 back off exponentially", []fakeReply{{status: 503}, {status: 503}, okReply}, 3, 3 * time.Second, 0},
		{"409 is not retried", []fakeReply{{status: 409}, okReply}, 1, 0, 409},
		{"500 is not retried", []fakeReply{{status: 500}, okReply}, 1, 0, 500},
		{"404 is not retried", []fakeReply{{status: 404}, okReply}, 1, 0, 404},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				c, tr := newFakeClient(t, 30, tc.script...)
				var err error
				wait := elapsed(func() { err = c.getJSON(context.Background(), "/x", &struct{}{}) })
				if tc.wantStatus == 0 && err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if tc.wantStatus != 0 {
					requireAPIStatus(t, err, tc.wantStatus)
				}
				if got := tr.requests(); got != tc.wantRequests {
					t.Fatalf("requests = %d, want %d", got, tc.wantRequests)
				}
				if wait != tc.wantWait {
					t.Fatalf("waited %v, want %v", wait, tc.wantWait)
				}
			})
		})
	}
}

// The public read methods must go through the retry path, not only the helper.
func TestPublicReadsRetryOn429(t *testing.T) {
	calls := map[string]func(c *Client) error{
		"GetCVMInfo":            func(c *Client) error { _, err := c.GetCVMInfo(context.Background(), "cvm"); return err },
		"GetCVMInfoWithOptions": func(c *Client) error { _, err := c.GetCVMInfoWithOptions(context.Background(), "cvm", nil); return err },
		"GetCVMInfoV20260121":   func(c *Client) error { _, err := c.GetCVMInfoV20260121(context.Background(), "cvm"); return err },
		"GetCVMState":           func(c *Client) error { _, err := c.GetCVMState(context.Background(), "cvm"); return err },
		"GetCVMList":            func(c *Client) error { _, err := c.GetCVMList(context.Background(), nil); return err },
		"GetCVMListV20260121":   func(c *Client) error { _, err := c.GetCVMListV20260121(context.Background(), nil); return err },
		"GetCVMComposeFile":     func(c *Client) error { _, err := c.GetCVMComposeFile(context.Background(), "cvm"); return err },
		"GetCVMDockerCompose":   func(c *Client) error { _, err := c.GetCVMDockerCompose(context.Background(), "cvm"); return err },
		"GetCurrentUser":        func(c *Client) error { _, err := c.GetCurrentUser(context.Background()); return err },
		"ListWorkspaces":        func(c *Client) error { _, err := c.ListWorkspaces(context.Background()); return err },
		"ListSSHKeys":           func(c *Client) error { _, err := c.ListSSHKeys(context.Background()); return err },
		"ListKMSContracts":      func(c *Client) error { _, err := c.ListKMSContracts(context.Background()); return err },
		"GetKMSList":            func(c *Client) error { _, err := c.GetKMSList(context.Background()); return err },
	}
	for name, call := range calls {
		t.Run(name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				body := `{}`
				if name == "ListSSHKeys" {
					body = `[]`
				}
				c, tr := newFakeClient(t, 30, rateLimited60, fakeReply{status: 200, body: body})
				var err error
				wait := elapsed(func() { err = call(c) })
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if got := tr.requests(); got != 2 {
					t.Fatalf("requests = %d, want 2", got)
				}
				if wait != 60*time.Second {
					t.Fatalf("waited %v, want 60s", wait)
				}
				for _, m := range tr.methods {
					if m != http.MethodGet {
						t.Fatalf("method = %s, want GET", m)
					}
				}
			})
		})
	}
}

func TestReadRetryExhaustionReturnsLast429(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		const maxRetries = 3
		c, tr := newFakeClient(t, maxRetries, fakeReply{status: 429, retryAfter: "7", body: `{"detail":"Rate limit exceeded"}`})
		var err error
		wait := elapsed(func() { _, err = c.GetCVMState(context.Background(), "cvm") })
		apiErr := requireAPIStatus(t, err, 429)
		if got := tr.requests(); got != maxRetries+1 {
			t.Fatalf("requests = %d, want %d", got, maxRetries+1)
		}
		if wait != maxRetries*7*time.Second {
			t.Fatalf("waited %v, want %v", wait, maxRetries*7*time.Second)
		}
		if apiErr.Headers.Get("Retry-After") != "7" || apiErr.RetryAfter() != 7*time.Second {
			t.Fatalf("headers lost: %v", apiErr.Headers)
		}
		if err.Error() != "phala api error (status 429): Rate limit exceeded" {
			t.Fatalf("message = %q", err.Error())
		}
	})
}

func TestReadRetryZeroBudgetDoesNotRetry(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		c, tr := newFakeClient(t, 0, rateLimited60, okReply)
		_, err := c.GetCVMState(context.Background(), "cvm")
		requireAPIStatus(t, err, 429)
		if got := tr.requests(); got != 1 {
			t.Fatalf("requests = %d, want 1", got)
		}
	})
}

func TestReadRetryContext(t *testing.T) {
	t.Run("cancel during the wait returns promptly", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			c, tr := newFakeClient(t, 30, rateLimited60, okReply)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			time.AfterFunc(5*time.Second, cancel)
			var err error
			wait := elapsed(func() { _, err = c.GetCVMState(ctx, "cvm") })
			if !errors.Is(err, context.Canceled) {
				t.Fatalf("err = %v, want context.Canceled", err)
			}
			if wait != 5*time.Second || tr.requests() != 1 {
				t.Fatalf("waited %v with %d requests, want 5s and 1", wait, tr.requests())
			}
		})
	})

	deadlineTests := []struct {
		name         string
		script       []fakeReply
		deadline     time.Duration
		wantRequests int
		wantWait     time.Duration
		wantRetryAft time.Duration
		wantSuccess  bool
	}{
		{"deadline before Retry-After returns immediately", []fakeReply{rateLimited60, okReply}, 30 * time.Second, 1, 0, 60 * time.Second, false},
		{"deadline equal to Retry-After returns immediately", []fakeReply{rateLimited60, okReply}, 60 * time.Second, 1, 0, 60 * time.Second, false},
		{"deadline before backoff returns immediately", []fakeReply{{status: 429}, okReply}, 500 * time.Millisecond, 1, 0, 0, false},
		{"deadline after Retry-After still retries", []fakeReply{rateLimited60, okReply}, 90 * time.Second, 2, 60 * time.Second, 0, true},
	}
	for _, tc := range deadlineTests {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				c, tr := newFakeClient(t, 30, tc.script...)
				ctx, cancel := context.WithTimeout(context.Background(), tc.deadline)
				defer cancel()
				var err error
				wait := elapsed(func() { _, err = c.GetCVMState(ctx, "cvm") })
				if tr.requests() != tc.wantRequests || wait != tc.wantWait {
					t.Fatalf("%d requests after %v, want %d after %v", tr.requests(), wait, tc.wantRequests, tc.wantWait)
				}
				if tc.wantSuccess {
					if err != nil {
						t.Fatalf("unexpected error: %v", err)
					}
					return
				}
				// The caller can tell rate limiting was the cause and also that
				// the deadline stopped the retries.
				apiErr := requireAPIStatus(t, err, 429)
				if !errors.Is(err, context.DeadlineExceeded) {
					t.Fatalf("err = %v, want it to wrap context.DeadlineExceeded", err)
				}
				if apiErr.RetryAfter() != tc.wantRetryAft {
					t.Fatalf("RetryAfter = %v, want %v", apiErr.RetryAfter(), tc.wantRetryAft)
				}
			})
		})
	}
}

func TestRetryAfterForms(t *testing.T) {
	// HTTP-date cases are relative to "now"; a fixed offset from the virtual
	// clock keeps them exact.
	inFuture := func(d time.Duration) func() string {
		return func() string { return time.Now().Add(d).UTC().Format(http.TimeFormat) }
	}
	literal := func(s string) func() string { return func() string { return s } }
	tests := []struct {
		name   string
		header func() string
		want   time.Duration
	}{
		{"seconds", literal("60"), 60 * time.Second},
		{"seconds with spaces", literal(" 60 "), 60 * time.Second},
		{"exactly the cap", literal("300"), maxRetryAfter},
		{"just over the cap", literal("301"), maxRetryAfter},
		{"http date in the future", inFuture(45 * time.Second), 45 * time.Second},
		{"http date far in the future is capped", inFuture(48 * time.Hour), maxRetryAfter},
		{"http date in the past", inFuture(-time.Hour), 0},
		{"zero", literal("0"), 0},
		{"negative", literal("-5"), 0},
		{"explicit plus sign", literal("+5"), 0},
		{"non numeric", literal("soon"), 0},
		{"fractional", literal("1.5"), 0},
		{"empty", literal(""), 0},
		{"overflows when converted to a duration", literal(strconv.FormatInt(1<<62, 10)), maxRetryAfter},
		{"max int64", literal(strconv.FormatInt(1<<63-1, 10)), maxRetryAfter},
		{"beyond uint64", literal("99999999999999999999999999"), maxRetryAfter},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				e := &APIError{StatusCode: 429, Headers: http.Header{}}
				if h := tc.header(); h != "" {
					e.Headers.Set("Retry-After", h)
				}
				if got := e.RetryAfter(); got != tc.want {
					t.Fatalf("RetryAfter(%q) = %v, want %v", e.Headers.Get("Retry-After"), got, tc.want)
				}
			})
		})
	}
	t.Run("no headers", func(t *testing.T) {
		if got := (&APIError{StatusCode: 429}).RetryAfter(); got != 0 {
			t.Fatalf("RetryAfter = %v, want 0", got)
		}
	})
}

// Writes keep their exact pre-existing behaviour. The call sites are pinned
// one by one because they differ: some are wrapped in doWithRetry, others are
// not.
func TestWritesKeepTheirRetryBehavior(t *testing.T) {
	tests := []struct {
		name         string
		call         func(c *Client) error
		script       []fakeReply
		maxRetries   int
		wantRequests int
		wantWait     time.Duration
		wantStatus   int // 0 = success
	}{
		{
			name: "POST without retry wrapper (CreateSSHKey) is not retried on 429",
			call: func(c *Client) error {
				_, err := c.CreateSSHKey(context.Background(), &CreateSSHKeyRequest{})
				return err
			},
			script:     []fakeReply{rateLimited60, okReply},
			maxRetries: 30, wantRequests: 1, wantStatus: 429,
		},
		{
			name:       "POST with retry wrapper (StartCVM) retries 429 using Retry-After",
			call:       func(c *Client) error { _, err := c.StartCVM(context.Background(), "cvm"); return err },
			script:     []fakeReply{rateLimited60, okReply},
			maxRetries: 30, wantRequests: 2, wantWait: 60 * time.Second,
		},
		{
			name:       "POST with retry wrapper (StartCVM) still retries 409",
			call:       func(c *Client) error { _, err := c.StartCVM(context.Background(), "cvm"); return err },
			script:     []fakeReply{{status: 409}, okReply},
			maxRetries: 30, wantRequests: 2, wantWait: retryBaseDelay,
		},
		{
			name:       "PATCH with retry wrapper (UpdateCVMListed) retries 503",
			call:       func(c *Client) error { return c.UpdateCVMListed(context.Background(), "cvm", true) },
			script:     []fakeReply{{status: 503}, okReply},
			maxRetries: 30, wantRequests: 2, wantWait: retryBaseDelay,
		},
		{
			name:       "wrapped write exhausts at maxRetries+1",
			call:       func(c *Client) error { _, err := c.StartCVM(context.Background(), "cvm"); return err },
			script:     []fakeReply{{status: 429}},
			maxRetries: 2, wantRequests: 3, wantWait: 3 * time.Second, wantStatus: 429,
		},
		{
			name:       "wrapped write caps an absurd Retry-After",
			call:       func(c *Client) error { _, err := c.StartCVM(context.Background(), "cvm"); return err },
			script:     []fakeReply{{status: 429, retryAfter: "86400"}, okReply},
			maxRetries: 30, wantRequests: 2, wantWait: maxRetryAfter,
		},
		{
			name:       "wrapped write treats a negative Retry-After as no hint",
			call:       func(c *Client) error { _, err := c.StartCVM(context.Background(), "cvm"); return err },
			script:     []fakeReply{{status: 429, retryAfter: "-30"}, okReply},
			maxRetries: 30, wantRequests: 2, wantWait: retryBaseDelay,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				c, tr := newFakeClient(t, tc.maxRetries, tc.script...)
				var err error
				wait := elapsed(func() { err = tc.call(c) })
				if tc.wantStatus == 0 && err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if tc.wantStatus != 0 {
					requireAPIStatus(t, err, tc.wantStatus)
				}
				if got := tr.requests(); got != tc.wantRequests {
					t.Fatalf("requests = %d, want %d", got, tc.wantRequests)
				}
				if wait != tc.wantWait {
					t.Fatalf("waited %v, want %v", wait, tc.wantWait)
				}
			})
		})
	}
}

// A GET that already sits inside doWithRetry must not pick up a second retry
// layer: persistent 503 yields exactly maxRetries+1 requests.
func TestAlreadyWrappedReadIsNotRetriedTwice(t *testing.T) {
	for _, status := range []int{503, 429} {
		t.Run(strconv.Itoa(status), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				const maxRetries = 2
				c, tr := newFakeClient(t, maxRetries, fakeReply{status: status})
				_, err := c.GetPreLaunchScriptUpgradeStatus(context.Background(), "cvm")
				requireAPIStatus(t, err, status)
				if got := tr.requests(); got != maxRetries+1 {
					t.Fatalf("requests = %d, want %d", got, maxRetries+1)
				}
			})
		})
	}
}
