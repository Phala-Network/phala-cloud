package phala

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// Known CVMOperation.Status values. The server may add more, so Status stays a string.
const (
	CVMOperationStatusInProgress = "in_progress"
	CVMOperationStatusCompleted  = "completed"
	CVMOperationStatusFailed     = "failed"
	CVMOperationStatusCancelled  = "cancelled"
)

// Known CVMOperation.FailureReason values. The server may add more.
const (
	CVMFailureTxReverted          = "tx_reverted"
	CVMFailureTxDropped           = "tx_dropped"
	CVMFailureRegistrationRemoved = "registration_removed"
	CVMFailureSuperseded          = "superseded"
	CVMFailureOutdated            = "outdated"
	CVMFailureCancelled           = "cancelled"
	CVMFailureApplyFailed         = "apply_failed"
	CVMFailureBootFailed          = "boot_failed"
)

const (
	defaultFinalityTimeout      = 30 * time.Minute
	defaultFinalityPollInterval = 15 * time.Second
)

// CVMOperation is one operation in a CVM's history.
type CVMOperation struct {
	CorrelationID string `json:"correlation_id"`
	OperationType string `json:"operation_type"`
	Status        string `json:"status"`
	// FinalityWait is set while the operation waits for on-chain finality.
	FinalityWait  *CVMFinalityWaitStatus `json:"finality_wait,omitempty"`
	FailureReason string                 `json:"failure_reason,omitempty"`
	ErrorMessage  string                 `json:"error_message,omitempty"`
}

// CVMOperationsPage is one page of a CVM's operation history, newest first.
type CVMOperationsPage struct {
	Items      []CVMOperation `json:"items"`
	NextCursor *string        `json:"next_cursor,omitempty"`
	Total      int            `json:"total"`
}

// GetCVMOperationsOptions filters the operation history. All fields are optional.
type GetCVMOperationsOptions struct {
	// CorrelationID returns only the operation with this ID.
	CorrelationID string
	// OperationTypes keeps only these types, for example "compose_update".
	OperationTypes []string
	// StartTime and EndTime bound the time an operation started.
	StartTime *time.Time
	EndTime   *time.Time
	// Limit is the page size (1-500). The server default is 50.
	Limit int
	// Cursor is NextCursor from the previous page.
	Cursor string
}

func (o *GetCVMOperationsOptions) query() url.Values {
	q := url.Values{}
	if o == nil {
		return q
	}
	if o.CorrelationID != "" {
		q.Set("correlation_id", o.CorrelationID)
	}
	for _, t := range o.OperationTypes {
		q.Add("operation_types", t)
	}
	if o.StartTime != nil {
		q.Set("start_time", o.StartTime.UTC().Format(time.RFC3339Nano))
	}
	if o.EndTime != nil {
		q.Set("end_time", o.EndTime.UTC().Format(time.RFC3339Nano))
	}
	if o.Limit > 0 {
		q.Set("limit", strconv.Itoa(o.Limit))
	}
	if o.Cursor != "" {
		q.Set("cursor", o.Cursor)
	}
	return q
}

func cvmOperationsPath(cvmID string, opts *GetCVMOperationsOptions) string {
	path := cvmPath(cvmID, "operations")
	if encoded := opts.query().Encode(); encoded != "" {
		path += "?" + encoded
	}
	return path
}

// GetCVMOperations lists the operations of a CVM, newest first.
func (c *Client) GetCVMOperations(ctx context.Context, cvmID string, opts *GetCVMOperationsOptions) (*CVMOperationsPage, error) {
	var result CVMOperationsPage
	if err := c.getJSON(ctx, cvmOperationsPath(cvmID, opts), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// FinalityCorrelationID returns the correlation ID to pass to WaitForCVMFinality,
// or "" when the update does not wait for on-chain finality.
func (r *PatchCVMResponse) FinalityCorrelationID() string {
	if r == nil || r.FinalityWait == nil {
		return ""
	}
	return r.FinalityWait.CorrelationID
}

// FinalityCorrelationID returns the correlation ID to pass to WaitForCVMFinality,
// or "" when the create does not wait for on-chain finality.
func (r *CommitCVMProvisionResponseFields) FinalityCorrelationID() string {
	if r == nil || r.FinalityWait == nil {
		return ""
	}
	return r.FinalityWait.CorrelationID
}

// WaitForCVMFinalityOptions configures WaitForCVMFinality.
type WaitForCVMFinalityOptions struct {
	// Timeout is the longest local wait. Default 30 minutes. Reaching it does
	// not cancel the operation.
	Timeout time.Duration
	// PollInterval is the time between reads. Default 15 seconds. A longer
	// Retry-After from the server wins.
	PollInterval time.Duration
	// OnStage is called on the first reported stage and whenever the stage or
	// phase changes.
	OnStage func(CVMFinalityWaitStatus)
}

// CVMOperationFailedError reports an operation that ended as failed or cancelled.
type CVMOperationFailedError struct {
	// Operation is the terminal operation. Operation.FailureReason and
	// Operation.ErrorMessage hold the server's raw values.
	Operation CVMOperation
}

func (e *CVMOperationFailedError) Error() string {
	status := e.Operation.Status
	msg := fmt.Sprintf("phala: CVM operation %s %s", e.Operation.CorrelationID, status)
	if r := e.Operation.FailureReason; r != "" && r != status {
		msg += " (" + r + ")"
	}
	msg += "."
	if e.Operation.ErrorMessage != "" {
		msg += " " + e.Operation.ErrorMessage
	}
	return msg
}

// CVMFinalityTimeoutError reports that WaitForCVMFinality stopped waiting after
// its Timeout. The operation may still be in progress.
type CVMFinalityTimeoutError struct {
	CorrelationID string
	Timeout       time.Duration
	// LastPollErr is the last transient polling error, if there was one.
	LastPollErr error
}

func (e *CVMFinalityTimeoutError) Error() string {
	return fmt.Sprintf("phala: stopped waiting for CVM operation %s after %s; the operation may still be in progress", e.CorrelationID, e.Timeout)
}

func (e *CVMFinalityTimeoutError) Unwrap() error { return e.LastPollErr }

// Is makes errors.Is(err, context.DeadlineExceeded) true for a timeout.
func (e *CVMFinalityTimeoutError) Is(target error) bool { return target == context.DeadlineExceeded }

// WaitForCVMFinality polls the CVM's operations until the one with correlationID
// completes. On-chain finality alone is not completion: Phala Cloud still has to
// apply the change.
//
// It returns the completed operation. A failed or cancelled operation returns
// *CVMOperationFailedError. Reaching opts.Timeout returns *CVMFinalityTimeoutError.
// Cancelling ctx returns ctx.Err(). None of these cancels the operation.
//
// An operation that is missing from the history, or has an unknown status, is
// not terminal, so polling continues until the timeout. Timeouts, 408, 425, 429
// and 5xx responses, and network errors are retried at the poll interval. Other
// errors are returned at once.
func (c *Client) WaitForCVMFinality(ctx context.Context, cvmID, correlationID string, opts *WaitForCVMFinalityOptions) (*CVMOperation, error) {
	if correlationID == "" {
		return nil, fmt.Errorf("phala: correlation ID is required")
	}
	var o WaitForCVMFinalityOptions
	if opts != nil {
		o = *opts
	}
	if o.Timeout < 0 || o.PollInterval < 0 {
		return nil, fmt.Errorf("phala: timeout and poll interval must not be negative")
	}
	if o.Timeout == 0 {
		o.Timeout = defaultFinalityTimeout
	}
	if o.PollInterval == 0 {
		o.PollInterval = defaultFinalityPollInterval
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	// The deadline bounds the whole wait, including a request that never returns.
	waitCtx, cancel := context.WithTimeout(ctx, o.Timeout)
	defer cancel()

	path := cvmOperationsPath(cvmID, &GetCVMOperationsOptions{CorrelationID: correlationID})
	var lastPollErr error
	var prevStage, prevPhase string
	var staged bool

	// stop converts the end of waitCtx into the error the caller should see.
	stop := func() error {
		if err := ctx.Err(); err != nil {
			return err
		}
		return &CVMFinalityTimeoutError{CorrelationID: correlationID, Timeout: o.Timeout, LastPollErr: lastPollErr}
	}

	for {
		// Retries belong to this loop so they share its deadline; no read retry here.
		var page CVMOperationsPage
		err := c.doJSON(waitCtx, http.MethodGet, path, nil, &page)
		if waitCtx.Err() != nil {
			return nil, stop()
		}
		delay := o.PollInterval
		if err != nil {
			retryAfter, transient := transientPollError(err)
			if !transient {
				return nil, err
			}
			lastPollErr = err
			delay = max(delay, retryAfter)
		} else if op := findOperation(page.Items, correlationID); op != nil {
			switch op.Status {
			case CVMOperationStatusCompleted:
				return op, nil
			case CVMOperationStatusFailed, CVMOperationStatusCancelled:
				return nil, &CVMOperationFailedError{Operation: *op}
			}
			if w := op.FinalityWait; w != nil && o.OnStage != nil && (!staged || w.Stage != prevStage || w.Phase != prevPhase) {
				staged, prevStage, prevPhase = true, w.Stage, w.Phase
				o.OnStage(*w)
			}
		}

		timer := time.NewTimer(delay)
		select {
		case <-waitCtx.Done():
			timer.Stop()
			return nil, stop()
		case <-timer.C:
		}
	}
}

// findOperation returns the operation with correlationID. A finality_wait that
// belongs to another correlation ID is dropped.
func findOperation(items []CVMOperation, correlationID string) *CVMOperation {
	for i := range items {
		if items[i].CorrelationID != correlationID {
			continue
		}
		op := items[i]
		if op.FinalityWait != nil && op.FinalityWait.CorrelationID != correlationID {
			op.FinalityWait = nil
		}
		return &op
	}
	return nil
}

// transientPollError reports whether a failed poll may succeed on a later try,
// and the server's Retry-After for 429 and 5xx answers.
func transientPollError(err error) (retryAfter time.Duration, transient bool) {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		switch s := apiErr.StatusCode; {
		case s == http.StatusTooManyRequests || (s >= 500 && s < 600):
			return apiErr.RetryAfter(), true
		case s == http.StatusRequestTimeout || s == http.StatusTooEarly:
			return 0, true
		}
		return 0, false
	}
	// Transport failures and a body cut short. A malformed body is not transient.
	var urlErr *url.Error
	return 0, errors.As(err, &urlErr) || errors.Is(err, io.ErrUnexpectedEOF)
}
