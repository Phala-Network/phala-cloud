package phala

import (
	"fmt"
	"net/http"
	"strconv"
	"time"
)

// APIError represents an error response from the Phala Cloud API.
type APIError struct {
	StatusCode int
	Message    string
	Detail     any
	Body       string
	Headers    http.Header
	ErrorCode  string
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("phala api error (status %d): %s", e.StatusCode, e.Message)
	}
	return fmt.Sprintf("phala api error (status %d): %s", e.StatusCode, http.StatusText(e.StatusCode))
}

// IsAuth returns true if the error is an authentication/authorization error (401/403).
func (e *APIError) IsAuth() bool {
	return e.StatusCode == http.StatusUnauthorized || e.StatusCode == http.StatusForbidden
}

// IsValidation returns true if the error is a validation error (422).
func (e *APIError) IsValidation() bool {
	return e.StatusCode == http.StatusUnprocessableEntity
}

// IsBusiness returns true if the error is a business logic error (4xx, non-auth, non-validation).
func (e *APIError) IsBusiness() bool {
	return e.StatusCode >= 400 && e.StatusCode < 500 && !e.IsAuth() && !e.IsValidation()
}

// IsServer returns true if the error is a server error (500+).
func (e *APIError) IsServer() bool {
	return e.StatusCode >= 500
}

// IsRetryable returns true if the error is retryable (409/429/503).
func (e *APIError) IsRetryable() bool {
	return e.StatusCode == http.StatusConflict ||
		e.StatusCode == http.StatusTooManyRequests ||
		e.StatusCode == http.StatusServiceUnavailable
}

// IsComposePrecondition returns true if the error is a compose hash precondition failure (465).
func (e *APIError) IsComposePrecondition() bool {
	return e.StatusCode == 465
}

// RetryAfter returns the duration to wait before retrying, based on the Retry-After header.
// Returns 0 if the header is not present or cannot be parsed.
func (e *APIError) RetryAfter() time.Duration {
	if e.Headers == nil {
		return 0
	}
	ra := e.Headers.Get("Retry-After")
	if ra == "" {
		return 0
	}
	// Try parsing as seconds first.
	if secs, err := strconv.Atoi(ra); err == nil {
		return time.Duration(secs) * time.Second
	}
	// Try parsing as HTTP date.
	if t, err := http.ParseTime(ra); err == nil {
		d := time.Until(t)
		if d > 0 {
			return d
		}
	}
	return 0
}
