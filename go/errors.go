package phala

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// ErrorDetail represents a field-level validation error detail.
type ErrorDetail struct {
	Field   string `json:"field"`
	Value   any    `json:"value"`
	Message string `json:"message"`
}

// ErrorLink represents a reference link attached to an API error.
type ErrorLink struct {
	URL   string `json:"url"`
	Label string `json:"label"`
}

// APIError represents an error response from the Phala Cloud API.
type APIError struct {
	StatusCode  int
	Message     string
	Detail      any
	Body        string
	Headers     http.Header
	RequestID   string
	ErrorCode   string
	Details     []ErrorDetail
	Suggestions []string
	Links       []ErrorLink
	// fromStreamBody marks a terminal error read from a 200 log body (guest
	// agent record, invalid record, repeated empty stream ends). It has no HTTP
	// status; log follow stops on it instead of reconnecting.
	fromStreamBody bool
}

func (e *APIError) Error() string {
	if e.fromStreamBody || e.StatusCode <= 0 {
		if e.Message != "" {
			return e.Message
		}
		return "phala api error"
	}
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
// A 409 Conflict with a structured ErrorCode is a deterministic business error
// and is not retryable.
func (e *APIError) IsRetryable() bool {
	if e.StatusCode == http.StatusConflict && e.ErrorCode != "" {
		return false
	}
	return e.StatusCode == http.StatusConflict ||
		e.StatusCode == http.StatusTooManyRequests ||
		e.StatusCode == http.StatusServiceUnavailable
}

// IsConflict returns true if the error is a 409 Conflict.
func (e *APIError) IsConflict() bool {
	return e.StatusCode == http.StatusConflict
}

// IsComposePrecondition returns true if the error is a compose hash precondition failure (465).
func (e *APIError) IsComposePrecondition() bool {
	return e.StatusCode == 465
}

// ComposePrecondition extracts a structured compose-hash precondition response from a 465 error.
// It returns the populated response and true when the error contains the required fields.
func (e *APIError) ComposePrecondition() (*ComposeHashPreconditionResponse, bool) {
	if !e.IsComposePrecondition() {
		return nil, false
	}
	fieldMap := make(map[string]any)
	for _, d := range e.Details {
		if d.Field != "" {
			fieldMap[d.Field] = d.Value
		}
	}
	composeHash, _ := fieldMap["compose_hash"].(string)
	appID, _ := fieldMap["app_id"].(string)
	if composeHash == "" || appID == "" {
		return nil, false
	}
	deviceID, _ := fieldMap["device_id"].(string)
	var kmsInfo *KMSInfo
	if v, ok := fieldMap["kms_info"]; ok {
		b, _ := json.Marshal(v)
		_ = json.Unmarshal(b, &kmsInfo)
	}
	return &ComposeHashPreconditionResponse{
		Message:     e.Message,
		ComposeHash: composeHash,
		AppID:       appID,
		DeviceID:    deviceID,
		KMSInfo:     kmsInfo,
	}, true
}

// maxRetryAfter bounds the wait taken from a Retry-After header. The API's
// rate limiter sends 60 seconds, so the bound leaves ample headroom while
// keeping a malformed or hostile header from stalling a caller for hours.
const maxRetryAfter = 5 * time.Minute

// RetryAfter returns the duration to wait before retrying, based on the
// Retry-After header. Both delta-seconds and HTTP-date forms are honoured.
// The result is never negative and never exceeds five minutes.
//
// It returns 0 ("no hint") when the header is absent, unparsable, negative,
// zero, or an HTTP-date that is not in the future; the retry loops then fall
// back to exponential backoff.
func (e *APIError) RetryAfter() time.Duration {
	if e.Headers == nil {
		return 0
	}
	ra := strings.TrimSpace(e.Headers.Get("Retry-After"))
	if ra == "" {
		return 0
	}
	// Delta-seconds: digits only, so signs are rejected.
	if secs, err := strconv.ParseUint(ra, 10, 64); err == nil {
		if secs > uint64(maxRetryAfter/time.Second) {
			return maxRetryAfter
		}
		return time.Duration(secs) * time.Second
	} else if errors.Is(err, strconv.ErrRange) {
		// All digits but beyond uint64: an absurdly large wait.
		return maxRetryAfter
	}
	// HTTP-date.
	if t, err := http.ParseTime(ra); err == nil {
		d := time.Until(t)
		if d > maxRetryAfter {
			return maxRetryAfter
		}
		if d > 0 {
			return d
		}
	}
	return 0
}

// IsStructured returns true when the error includes a structured ErrorCode.
func (e *APIError) IsStructured() bool {
	return e.ErrorCode != ""
}

// HasErrorCode returns true if the error has the given error code.
func (e *APIError) HasErrorCode(code string) bool {
	return e.ErrorCode == code
}

// FormatError returns a human-readable formatted representation of the error,
// including details, suggestions, and links when available.
func (e *APIError) FormatError() string {
	var b strings.Builder
	if e.ErrorCode != "" {
		fmt.Fprintf(&b, "[%s] ", e.ErrorCode)
	}
	b.WriteString(e.Message)

	if e.RequestID != "" {
		fmt.Fprintf(&b, "\nRequest ID: %s", e.RequestID)
	}

	if len(e.Details) > 0 {
		b.WriteString("\n\nDetails:")
		for _, d := range e.Details {
			fmt.Fprintf(&b, "\n  - %s", d.Message)
			if d.Field != "" {
				fmt.Fprintf(&b, " (field: %s", d.Field)
				if rendered := formatErrorDetailValue(d.Value); rendered != "" {
					fmt.Fprintf(&b, ", value: %s", rendered)
				}
				b.WriteString(")")
			}
		}
	}

	if len(e.Suggestions) > 0 {
		b.WriteString("\n\nSuggestions:")
		for _, s := range e.Suggestions {
			fmt.Fprintf(&b, "\n  - %s", s)
		}
	}

	if len(e.Links) > 0 {
		b.WriteString("\n\nReferences:")
		for _, l := range e.Links {
			if l.Label != "" {
				fmt.Fprintf(&b, "\n  - %s: %s", l.Label, l.URL)
			} else {
				fmt.Fprintf(&b, "\n  - %s", l.URL)
			}
		}
	}

	return b.String()
}

func formatErrorDetailValue(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	default:
		b, err := json.Marshal(v)
		if err != nil {
			return fmt.Sprintf("%v", v)
		}
		return string(b)
	}
}
