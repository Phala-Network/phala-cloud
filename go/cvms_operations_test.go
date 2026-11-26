package phala

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"
)

const testPoll = time.Millisecond

func opJSON(corr, status string, extra string) string {
	return fmt.Sprintf(`{"correlation_id":%q,"operation_type":"compose_update","status":%q%s}`, corr, status, extra)
}

func opsPage(items ...string) fakeReply {
	return fakeReply{status: 200, body: `{"items":[` + strings.Join(items, ",") + `],"next_cursor":null,"total":` + fmt.Sprint(len(items)) + `}`}
}

func finalityExtra(corr, phase, stage string) string {
	return fmt.Sprintf(`,"finality_wait":{"operation":"update","correlation_id":%q,"phase":%q,"stage":%q,"transaction":null,"finality":{"block_tag":null,"policy_block_number":null,"blocks_remaining":null,"eta_seconds":null}}`, corr, phase, stage)
}

func TestGetCVMOperationsSendsQuery(t *testing.T) {
	client, tr := newFakeClient(t, 0, opsPage(opJSON("c1", "failed", `,"failure_reason":"tx_reverted","error_message":"boom"`)))
	start := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	page, err := client.GetCVMOperations(context.Background(), "cvm-1", &GetCVMOperationsOptions{
		CorrelationID: "c1", OperationTypes: []string{"compose_update", "resize"}, StartTime: &start, Limit: 5, Cursor: "cur",
	})
	if err != nil {
		t.Fatal(err)
	}
	q, _ := url.ParseQuery(tr.queries[0])
	if tr.paths[0] != "/cvms/cvm-1/operations" || q.Get("correlation_id") != "c1" || q.Get("limit") != "5" ||
		q.Get("cursor") != "cur" || q.Get("start_time") != "2026-01-02T03:04:05Z" || strings.Join(q["operation_types"], ",") != "compose_update,resize" {
		t.Fatalf("path %q query %q", tr.paths[0], tr.queries[0])
	}
	if len(page.Items) != 1 || page.Items[0].FailureReason != CVMFailureTxReverted || page.Items[0].ErrorMessage != "boom" {
		t.Fatalf("page = %+v", page)
	}
}

func TestWaitForCVMFinalityCompletesAfterPolls(t *testing.T) {
	client, tr := newFakeClient(t, 0,
		opsPage(), // not in history yet
		opsPage(opJSON("c1", "in_progress", finalityExtra("c1", "awaiting_finality", "submitted"))),
		opsPage(opJSON("c1", "in_progress", finalityExtra("c1", "awaiting_finality", "submitted"))),
		opsPage(opJSON("c1", "in_progress", finalityExtra("c1", "applying", "finalized"))),
		opsPage(opJSON("c1", "completed", "")),
	)
	var stages []string
	op, err := client.WaitForCVMFinality(context.Background(), "cvm-1", "c1", &WaitForCVMFinalityOptions{
		PollInterval: testPoll,
		OnStage:      func(w CVMFinalityWaitStatus) { stages = append(stages, w.Phase+"/"+w.Stage) },
	})
	if err != nil {
		t.Fatal(err)
	}
	if op.Status != CVMOperationStatusCompleted || tr.requests() != 5 {
		t.Fatalf("status %q after %d requests", op.Status, tr.requests())
	}
	if tr.queries[0] != "correlation_id=c1" {
		t.Fatalf("query = %q", tr.queries[0])
	}
	if got := strings.Join(stages, ","); got != "awaiting_finality/submitted,applying/finalized" {
		t.Fatalf("stages = %s", got)
	}
}

func TestWaitForCVMFinalityFailedAndCancelled(t *testing.T) {
	for _, status := range []string{CVMOperationStatusFailed, CVMOperationStatusCancelled} {
		t.Run(status, func(t *testing.T) {
			client, tr := newFakeClient(t, 0,
				opsPage(opJSON("c1", "in_progress", "")),
				opsPage(opJSON("c1", status, `,"failure_reason":"superseded","error_message":"replaced by a newer update"`)),
			)
			_, err := client.WaitForCVMFinality(context.Background(), "cvm-1", "c1", &WaitForCVMFinalityOptions{PollInterval: testPoll})
			var failed *CVMOperationFailedError
			if !errors.As(err, &failed) {
				t.Fatalf("err = %v", err)
			}
			if failed.Operation.Status != status || failed.Operation.FailureReason != CVMFailureSuperseded ||
				failed.Operation.ErrorMessage != "replaced by a newer update" || tr.requests() != 2 {
				t.Fatalf("failed = %+v after %d requests", failed.Operation, tr.requests())
			}
			want := "CVM operation c1 " + status + " (superseded). replaced by a newer update"
			if !strings.Contains(err.Error(), want) {
				t.Fatalf("message = %q", err.Error())
			}
		})
	}
}

func TestWaitForCVMFinalityTimeout(t *testing.T) {
	client, _ := newFakeClient(t, 0, opsPage(opJSON("c1", "in_progress", "")))
	_, err := client.WaitForCVMFinality(context.Background(), "cvm-1", "c1", &WaitForCVMFinalityOptions{Timeout: 30 * time.Millisecond, PollInterval: testPoll})
	var timeout *CVMFinalityTimeoutError
	if !errors.As(err, &timeout) || timeout.CorrelationID != "c1" {
		t.Fatalf("err = %v", err)
	}
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatal("timeout should match context.DeadlineExceeded")
	}
	var failed *CVMOperationFailedError
	if errors.As(err, &failed) {
		t.Fatal("timeout is not a failed operation")
	}
}

func TestWaitForCVMFinalityMissingOperationTimesOut(t *testing.T) {
	client, _ := newFakeClient(t, 0, opsPage(opJSON("other", "completed", "")))
	_, err := client.WaitForCVMFinality(context.Background(), "cvm-1", "c1", &WaitForCVMFinalityOptions{Timeout: 20 * time.Millisecond, PollInterval: testPoll})
	var timeout *CVMFinalityTimeoutError
	if !errors.As(err, &timeout) {
		t.Fatalf("err = %v", err)
	}
}

func TestWaitForCVMFinalityContextCancel(t *testing.T) {
	client, _ := newFakeClient(t, 0, opsPage(opJSON("c1", "in_progress", "")))
	ctx, cancel := context.WithCancel(context.Background())
	time.AfterFunc(20*time.Millisecond, cancel)
	_, err := client.WaitForCVMFinality(ctx, "cvm-1", "c1", &WaitForCVMFinalityOptions{PollInterval: testPoll})
	var timeout *CVMFinalityTimeoutError
	if !errors.Is(err, context.Canceled) || errors.As(err, &timeout) {
		t.Fatalf("err = %v", err)
	}
	// Already cancelled: no request is sent.
	client, tr := newFakeClient(t, 0, opsPage())
	if _, err := client.WaitForCVMFinality(ctx, "cvm-1", "c1", nil); !errors.Is(err, context.Canceled) || tr.requests() != 0 {
		t.Fatalf("err = %v, requests = %d", err, tr.requests())
	}
}

func TestWaitForCVMFinalityIgnoresOtherOperations(t *testing.T) {
	client, _ := newFakeClient(t, 0,
		opsPage(opJSON("other", "completed", ""), opJSON("c1", "in_progress", "")),
		opsPage(opJSON("other", "failed", `,"failure_reason":"tx_reverted"`), opJSON("c1", "completed", ""), opJSON("c1-later", "failed", "")),
	)
	op, err := client.WaitForCVMFinality(context.Background(), "cvm-1", "c1", &WaitForCVMFinalityOptions{PollInterval: testPoll})
	if err != nil || op.CorrelationID != "c1" {
		t.Fatalf("op = %+v, err = %v", op, err)
	}
}

func TestWaitForCVMFinalityDropsMismatchedFinalityWait(t *testing.T) {
	client, _ := newFakeClient(t, 0,
		opsPage(opJSON("c1", "in_progress", finalityExtra("other", "applying", "finalized"))),
		opsPage(opJSON("c1", "completed", "")),
	)
	called := false
	_, err := client.WaitForCVMFinality(context.Background(), "cvm-1", "c1", &WaitForCVMFinalityOptions{
		PollInterval: testPoll, OnStage: func(CVMFinalityWaitStatus) { called = true },
	})
	if err != nil || called {
		t.Fatalf("err = %v, OnStage called = %v", err, called)
	}
}

func TestWaitForCVMFinalityRetriesTransientErrors(t *testing.T) {
	for _, status := range []int{408, 425, 429, 502, 503} {
		t.Run(fmt.Sprint(status), func(t *testing.T) {
			client, tr := newFakeClient(t, 0,
				fakeReply{status: status, body: `{"detail":"later"}`},
				opsPage(opJSON("c1", "completed", "")),
			)
			if _, err := client.WaitForCVMFinality(context.Background(), "cvm-1", "c1", &WaitForCVMFinalityOptions{PollInterval: testPoll}); err != nil {
				t.Fatal(err)
			}
			if tr.requests() != 2 {
				t.Fatalf("requests = %d", tr.requests())
			}
		})
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestWaitForCVMFinalityRetriesNetworkError(t *testing.T) {
	var mu sync.Mutex
	calls := 0
	ok := opsPage(opJSON("c1", "completed", ""))
	client, err := NewClient(WithAPIKey("k"), WithBaseURL("http://api.invalid"), WithMaxRetries(0),
		WithHTTPClient(&http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			mu.Lock()
			defer mu.Unlock()
			calls++
			if calls == 1 {
				return nil, errors.New("connection refused")
			}
			return ok.response(r), nil
		})}))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := client.WaitForCVMFinality(context.Background(), "cvm-1", "c1", &WaitForCVMFinalityOptions{PollInterval: testPoll}); err != nil || calls != 2 {
		t.Fatalf("err = %v, calls = %d", err, calls)
	}
}

func TestWaitForCVMFinalityTimeoutCarriesLastTransientError(t *testing.T) {
	client, _ := newFakeClient(t, 0, fakeReply{status: 502, body: `{"detail":"bad gateway"}`})
	_, err := client.WaitForCVMFinality(context.Background(), "cvm-1", "c1", &WaitForCVMFinalityOptions{Timeout: 20 * time.Millisecond, PollInterval: testPoll})
	var timeout *CVMFinalityTimeoutError
	var apiErr *APIError
	if !errors.As(err, &timeout) || !errors.As(err, &apiErr) || apiErr.StatusCode != 502 {
		t.Fatalf("err = %v", err)
	}
}

func TestWaitForCVMFinalityDoesNotRetryOtherErrors(t *testing.T) {
	for _, status := range []int{401, 403, 404, 422} {
		client, tr := newFakeClient(t, 0, fakeReply{status: status, body: `{"detail":"no"}`}, opsPage(opJSON("c1", "completed", "")))
		_, err := client.WaitForCVMFinality(context.Background(), "cvm-1", "c1", &WaitForCVMFinalityOptions{PollInterval: testPoll})
		var apiErr *APIError
		if !errors.As(err, &apiErr) || apiErr.StatusCode != status || tr.requests() != 1 {
			t.Fatalf("status %d: err = %v, requests = %d", status, err, tr.requests())
		}
	}
}

func TestWaitForCVMFinalityRejectsBadInput(t *testing.T) {
	client, tr := newFakeClient(t, 0, opsPage())
	if _, err := client.WaitForCVMFinality(context.Background(), "cvm-1", "", nil); err == nil {
		t.Fatal("empty correlation ID accepted")
	}
	if _, err := client.WaitForCVMFinality(context.Background(), "cvm-1", "c1", &WaitForCVMFinalityOptions{Timeout: -1}); err == nil {
		t.Fatal("negative timeout accepted")
	}
	if tr.requests() != 0 {
		t.Fatal("request sent for bad input")
	}
}

func TestFinalityCorrelationID(t *testing.T) {
	var patch *PatchCVMResponse
	if patch.FinalityCorrelationID() != "" || (&PatchCVMResponse{}).FinalityCorrelationID() != "" {
		t.Fatal("expected empty")
	}
	w := &CVMFinalityWaitStatus{CorrelationID: "c9"}
	if (&PatchCVMResponse{FinalityWait: w}).FinalityCorrelationID() != "c9" ||
		(&CommitCVMProvisionResponseFields{FinalityWait: w}).FinalityCorrelationID() != "c9" {
		t.Fatal("correlation ID not returned")
	}
}
