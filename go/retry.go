package phala

import (
	"context"
	"errors"
	"math"
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

		// Calculate delay.
		delay := apiErr.RetryAfter()
		if delay == 0 {
			delay = time.Duration(math.Min(
				float64(retryBaseDelay)*math.Pow(2, float64(attempt)),
				float64(retryMaxDelay),
			))
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
	}
	return lastErr
}
