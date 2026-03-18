package phala

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestDoWithRetry_SuccessNoRetry(t *testing.T) {
	c := &Client{maxRetries: 3}
	calls := 0
	err := c.doWithRetry(context.Background(), func() error {
		calls++
		return nil
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if calls != 1 {
		t.Errorf("calls = %d, want 1", calls)
	}
}

func TestDoWithRetry_NonRetryableError(t *testing.T) {
	c := &Client{maxRetries: 3}
	calls := 0
	err := c.doWithRetry(context.Background(), func() error {
		calls++
		return &APIError{StatusCode: 400, Message: "bad request"}
	})
	if calls != 1 {
		t.Errorf("calls = %d, want 1 (should not retry non-retryable)", calls)
	}
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T", err)
	}
	if apiErr.StatusCode != 400 {
		t.Errorf("status = %d, want 400", apiErr.StatusCode)
	}
}

func TestDoWithRetry_NonAPIError(t *testing.T) {
	c := &Client{maxRetries: 3}
	calls := 0
	err := c.doWithRetry(context.Background(), func() error {
		calls++
		return errors.New("network error")
	})
	if calls != 1 {
		t.Errorf("calls = %d, want 1 (should not retry non-API errors)", calls)
	}
	if err == nil || err.Error() != "network error" {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestDoWithRetry_RetryThenSuccess(t *testing.T) {
	c := &Client{maxRetries: 5}
	calls := 0
	err := c.doWithRetry(context.Background(), func() error {
		calls++
		if calls < 3 {
			return &APIError{StatusCode: 429, Message: "too many requests"}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if calls != 3 {
		t.Errorf("calls = %d, want 3", calls)
	}
}

func TestDoWithRetry_ExhaustsRetries(t *testing.T) {
	c := &Client{maxRetries: 2}
	calls := 0
	err := c.doWithRetry(context.Background(), func() error {
		calls++
		return &APIError{StatusCode: 503, Message: "unavailable"}
	})
	if err == nil {
		t.Fatal("expected error after exhausting retries")
	}
	// maxRetries=2 means: attempt 0, 1, 2 = 3 total calls
	if calls != 3 {
		t.Errorf("calls = %d, want 3", calls)
	}
}

func TestDoWithRetry_ContextCanceled(t *testing.T) {
	c := &Client{maxRetries: 100}
	ctx, cancel := context.WithCancel(context.Background())
	calls := 0
	err := c.doWithRetry(ctx, func() error {
		calls++
		if calls == 2 {
			cancel()
		}
		return &APIError{StatusCode: 429, Message: "too many requests"}
	})
	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected context.Canceled, got %v", err)
	}
}

func TestDoWithRetry_ZeroRetries(t *testing.T) {
	c := &Client{maxRetries: 0}
	calls := 0
	err := c.doWithRetry(context.Background(), func() error {
		calls++
		return &APIError{StatusCode: 409, Message: "conflict"}
	})
	if err == nil {
		t.Fatal("expected error with zero retries")
	}
	if calls != 1 {
		t.Errorf("calls = %d, want 1", calls)
	}
}

func TestDoWithRetry_RetryAfterHeader(t *testing.T) {
	c := &Client{maxRetries: 1}
	start := time.Now()
	calls := 0
	_ = c.doWithRetry(context.Background(), func() error {
		calls++
		return &APIError{StatusCode: 429, Message: "rate limited"}
	})
	elapsed := time.Since(start)
	// With maxRetries=1, should have base delay ~1s between attempt 0 and 1.
	if elapsed < 500*time.Millisecond {
		t.Errorf("expected some delay from retry, elapsed=%v", elapsed)
	}
}
