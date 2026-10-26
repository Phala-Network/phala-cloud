package phala

import (
	"context"
	"errors"
	"time"

	"github.com/cenkalti/backoff/v5"
)

const (
	retryBaseDelay = time.Second
	retryMaxDelay  = 20 * time.Second
)

// responseBackOff lets the server override the library's exponential delay.
// Advancing the base strategy also counts attempts that carried Retry-After.
type responseBackOff struct {
	backoff.BackOff
	serverDelay time.Duration
}

func (b *responseBackOff) NextBackOff() time.Duration {
	delay := b.BackOff.NextBackOff()
	if b.serverDelay > 0 {
		return b.serverDelay
	}
	return delay
}

// doWithRetry keeps API classification separate from the library's retry loop.
func (c *Client) doWithRetry(ctx context.Context, fn func() error) error {
	exponential := backoff.NewExponentialBackOff()
	exponential.InitialInterval = retryBaseDelay
	exponential.MaxInterval = retryMaxDelay
	exponential.Multiplier = 2
	exponential.RandomizationFactor = 0
	strategy := &responseBackOff{BackOff: exponential}
	_, err := backoff.Retry(ctx, func() (struct{}, error) {
		if err := ctx.Err(); err != nil {
			return struct{}{}, backoff.Permanent(err)
		}
		err := fn()
		if err == nil {
			return struct{}{}, nil
		}
		var apiErr *APIError
		if !errors.As(err, &apiErr) || !apiErr.IsRetryable() {
			return struct{}{}, backoff.Permanent(err)
		}
		strategy.serverDelay = apiErr.RetryAfter()
		return struct{}{}, err
	}, backoff.WithBackOff(strategy), backoff.WithMaxTries(uint(c.maxRetries)+1), backoff.WithMaxElapsedTime(0))
	// v5 can return a PermanentError at the attempt limit; preserve the SDK error.
	var permanent *backoff.PermanentError
	if errors.As(err, &permanent) {
		return permanent.Unwrap()
	}
	return err
}
