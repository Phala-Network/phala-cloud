package phala

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"time"
)

const (
	retryBaseDelay = 1 * time.Second
	retryMaxDelay  = 20 * time.Second
)

// doWithRetry executes fn with exponential backoff retry on retryable errors (409/429/503).
func (c *Client) doWithRetry(ctx context.Context, fn func() error) error {
	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		err := fn()
		if err == nil {
			return nil
		}

		var apiErr *APIError
		if !errors.As(err, &apiErr) || !apiErr.IsRetryable() {
			return err
		}
		lastErr = err

		// Don't delay after the final attempt.
		if attempt == c.maxRetries {
			break
		}

		delay := retryDelay(apiErr, attempt)

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
	}
	return lastErr
}

// retryDelay returns how long to wait after the given failed attempt: the
// server's Retry-After hint (bounded by maxRetryAfter) when present, otherwise
// exponential backoff.
func retryDelay(apiErr *APIError, attempt int) time.Duration {
	if delay := apiErr.RetryAfter(); delay > 0 {
		return delay
	}
	return time.Duration(math.Min(
		float64(retryBaseDelay)*math.Pow(2, float64(attempt)),
		float64(retryMaxDelay),
	))
}

// isReadRetryable reports whether a failed bodyless read may be retried.
// Reads retry on 429 and 503 only. A 409 is a write conflict and is never
// retried for a read.
func isReadRetryable(apiErr *APIError) bool {
	return apiErr.StatusCode == http.StatusTooManyRequests ||
		apiErr.StatusCode == http.StatusServiceUnavailable
}

// doReadWithRetry runs fn, a bodyless GET, retrying on 429 and 503 with the same
// attempt budget and delays as doWithRetry.
//
// Differences from doWithRetry:
//   - 409 is not retried.
//   - If the context deadline would expire before the next wait ends, it
//     returns at once instead of sleeping until the deadline. The returned
//     error wraps both the last *APIError and context.DeadlineExceeded, so
//     errors.As(err, *APIError) and errors.Is(err, context.DeadlineExceeded)
//     both succeed.
//
// Cancellation during a wait returns ctx.Err(), as in doWithRetry. After the
// budget is spent the last *APIError is returned unchanged.
//
// Do not call it around a request that is already inside doWithRetry.
func (c *Client) doReadWithRetry(ctx context.Context, fn func() error) error {
	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		err := fn()
		if err == nil {
			return nil
		}

		var apiErr *APIError
		if !errors.As(err, &apiErr) || !isReadRetryable(apiErr) {
			return err
		}
		lastErr = err

		if attempt == c.maxRetries {
			break
		}

		delay := retryDelay(apiErr, attempt)
		if deadline, ok := ctx.Deadline(); ok && !time.Now().Add(delay).Before(deadline) {
			return fmt.Errorf("%w (next retry in %s would pass the context deadline: %w)", lastErr, delay, context.DeadlineExceeded)
		}

		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
	}
	return lastErr
}

// getJSON issues a GET and decodes the JSON response, retrying 429 and 503.
func (c *Client) getJSON(ctx context.Context, path string, result any) error {
	return c.doReadWithRetry(ctx, func() error {
		return c.doJSON(ctx, http.MethodGet, path, nil, result)
	})
}

// getJSONVersioned is getJSON with X-Phala-Version pinned for this request.
func (c *Client) getJSONVersioned(ctx context.Context, path, version string, result any) error {
	return c.doReadWithRetry(ctx, func() error {
		return c.doJSONVersioned(ctx, http.MethodGet, path, version, nil, result)
	})
}

// getText issues a GET for a text resource, retrying 429 and 503.
func (c *Client) getText(ctx context.Context, path string, result any) error {
	return c.doReadWithRetry(ctx, func() error {
		return c.doText(ctx, http.MethodGet, path, "", "", nil, result)
	})
}
