package phala

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"testing/synctest"
	"time"
)

// These tests pin the request counts of the SSE watch stream and the log
// follow loop under HTTP 429. Both have their own reconnect budgets; the
// client's per-request read retry must not add a hidden layer underneath them,
// even with the default retry budget.

func TestWatchCVMStateCountsRequestsUnder429(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		c, tr := newFakeClient(t, 30, fakeReply{status: 429, retryAfter: "60", body: `{"detail":"Rate limit exceeded"}`})
		maxRetries := 2
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		events, err := c.WatchCVMState(ctx, "cvm", &WatchCVMStateOptions{
			Target: "running", MaxRetries: &maxRetries, RetryDelay: time.Second,
		})
		if err != nil {
			t.Fatal(err)
		}
		var last CVMStateEvent
		for ev := range events {
			last = ev
		}
		if got := tr.requests(); got != maxRetries+1 {
			t.Fatalf("requests = %d, want %d", got, maxRetries+1)
		}
		var apiErr *APIError
		if !errors.As(last.Error, &apiErr) || apiErr.StatusCode != http.StatusTooManyRequests {
			t.Fatalf("last event error = %v, want 429 APIError", last.Error)
		}
	})
}

func TestFollowNodeLogsCountsLookupRequestsUnder429(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		c, tr := newFakeClient(t, 30, fakeReply{status: 429, retryAfter: "60", body: `{"detail":"Rate limit exceeded"}`})
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		_, errs := c.FollowCVMLogs(ctx, "app_test", LogSource{Type: "node", Channel: CVMLogSerial}, nil)
		err := <-errs
		var apiErr *APIError
		if !errors.As(err, &apiErr) || apiErr.StatusCode != http.StatusTooManyRequests {
			t.Fatalf("err = %v, want 429 APIError", err)
		}
		// The follow loop gives up after its own budget of five consecutive failures.
		if got := tr.requests(); got != 5 {
			t.Fatalf("requests = %d, want 5", got)
		}
	})
}
