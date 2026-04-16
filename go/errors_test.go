package phala

import (
	"net/http"
	"testing"
	"time"
)

func TestAPIError_Error(t *testing.T) {
	tests := []struct {
		name string
		err  APIError
		want string
	}{
		{
			name: "with message",
			err:  APIError{StatusCode: 400, Message: "bad request"},
			want: "phala api error (status 400): bad request",
		},
		{
			name: "without message",
			err:  APIError{StatusCode: 404},
			want: "phala api error (status 404): Not Found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.err.Error()
			if got != tt.want {
				t.Errorf("Error() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestAPIError_Classification(t *testing.T) {
	tests := []struct {
		status               int
		isAuth, isValidation bool
		isBusiness, isServer bool
		isRetryable          bool
		isComposePrecond     bool
	}{
		{401, true, false, false, false, false, false},
		{403, true, false, false, false, false, false},
		{422, false, true, false, false, false, false},
		{400, false, false, true, false, false, false},
		{409, false, false, true, false, true, false},
		{429, false, false, true, false, true, false},
		{465, false, false, true, false, false, true},
		{500, false, false, false, true, false, false},
		{502, false, false, false, true, false, false},
		{503, false, false, false, true, true, false},
	}

	for _, tt := range tests {
		e := &APIError{StatusCode: tt.status}
		if e.IsAuth() != tt.isAuth {
			t.Errorf("status %d: IsAuth() = %v, want %v", tt.status, e.IsAuth(), tt.isAuth)
		}
		if e.IsValidation() != tt.isValidation {
			t.Errorf("status %d: IsValidation() = %v, want %v", tt.status, e.IsValidation(), tt.isValidation)
		}
		if e.IsBusiness() != tt.isBusiness {
			t.Errorf("status %d: IsBusiness() = %v, want %v", tt.status, e.IsBusiness(), tt.isBusiness)
		}
		if e.IsServer() != tt.isServer {
			t.Errorf("status %d: IsServer() = %v, want %v", tt.status, e.IsServer(), tt.isServer)
		}
		if e.IsRetryable() != tt.isRetryable {
			t.Errorf("status %d: IsRetryable() = %v, want %v", tt.status, e.IsRetryable(), tt.isRetryable)
		}
		if e.IsComposePrecondition() != tt.isComposePrecond {
			t.Errorf("status %d: IsComposePrecondition() = %v, want %v", tt.status, e.IsComposePrecondition(), tt.isComposePrecond)
		}
	}
}

func TestAPIError_RetryAfter(t *testing.T) {
	t.Run("no headers", func(t *testing.T) {
		e := &APIError{StatusCode: 429}
		if d := e.RetryAfter(); d != 0 {
			t.Errorf("RetryAfter() = %v, want 0", d)
		}
	})

	t.Run("empty header", func(t *testing.T) {
		e := &APIError{StatusCode: 429, Headers: http.Header{}}
		if d := e.RetryAfter(); d != 0 {
			t.Errorf("RetryAfter() = %v, want 0", d)
		}
	})

	t.Run("seconds", func(t *testing.T) {
		h := http.Header{}
		h.Set("Retry-After", "5")
		e := &APIError{StatusCode: 429, Headers: h}
		if d := e.RetryAfter(); d != 5*time.Second {
			t.Errorf("RetryAfter() = %v, want 5s", d)
		}
	})

	t.Run("http date", func(t *testing.T) {
		future := time.Now().Add(10 * time.Second)
		h := http.Header{}
		h.Set("Retry-After", future.UTC().Format(http.TimeFormat))
		e := &APIError{StatusCode: 429, Headers: h}
		d := e.RetryAfter()
		if d < 8*time.Second || d > 12*time.Second {
			t.Errorf("RetryAfter() = %v, want ~10s", d)
		}
	})

	t.Run("past date", func(t *testing.T) {
		past := time.Now().Add(-10 * time.Second)
		h := http.Header{}
		h.Set("Retry-After", past.UTC().Format(http.TimeFormat))
		e := &APIError{StatusCode: 429, Headers: h}
		if d := e.RetryAfter(); d != 0 {
			t.Errorf("RetryAfter() = %v, want 0 for past date", d)
		}
	})

	t.Run("unparseable", func(t *testing.T) {
		h := http.Header{}
		h.Set("Retry-After", "not-a-number-or-date")
		e := &APIError{StatusCode: 429, Headers: h}
		if d := e.RetryAfter(); d != 0 {
			t.Errorf("RetryAfter() = %v, want 0", d)
		}
	})
}

func TestAPIError_ComposePrecondition(t *testing.T) {
	t.Run("non-465 returns false", func(t *testing.T) {
		e := &APIError{StatusCode: 400}
		if _, ok := e.ComposePrecondition(); ok {
			t.Fatal("expected false for non-465")
		}
	})

	t.Run("465 without required fields returns false", func(t *testing.T) {
		e := &APIError{StatusCode: 465, Message: "missing fields"}
		if _, ok := e.ComposePrecondition(); ok {
			t.Fatal("expected false when compose_hash/app_id missing")
		}
	})

	t.Run("465 with structured details", func(t *testing.T) {
		e := &APIError{
			StatusCode: 465,
			Message:    "Compose hash registration required",
			Details: []ErrorDetail{
				{Field: "compose_hash", Value: "0xhash123"},
				{Field: "app_id", Value: "0xapp456"},
				{Field: "device_id", Value: "0xdevice789"},
				{Field: "kms_info", Value: map[string]any{
					"id":                   "kms_test",
					"slug":                 "kms-base-prod9",
					"url":                  "https://kms.example.com",
					"version":              "v0.5.7",
					"chain_id":             8453,
					"kms_contract_address": "0xkms123",
					"gateway_app_id":       "0xgateway456",
				}},
			},
		}
		precond, ok := e.ComposePrecondition()
		if !ok {
			t.Fatal("expected true")
		}
		if precond.ComposeHash != "0xhash123" {
			t.Errorf("ComposeHash = %q, want 0xhash123", precond.ComposeHash)
		}
		if precond.AppID != "0xapp456" {
			t.Errorf("AppID = %q, want 0xapp456", precond.AppID)
		}
		if precond.DeviceID != "0xdevice789" {
			t.Errorf("DeviceID = %q, want 0xdevice789", precond.DeviceID)
		}
		if precond.KMSInfo == nil {
			t.Fatal("expected KMSInfo")
		}
		if precond.KMSInfo == nil {
			t.Fatal("expected KMSInfo")
		}
		if precond.KMSInfo.ID != "kms_test" {
			t.Errorf("KMSInfo.ID = %q, want kms_test", precond.KMSInfo.ID)
		}
		if precond.KMSInfo.KMSContractAddress == nil || *precond.KMSInfo.KMSContractAddress != "0xkms123" {
			t.Errorf("KMSInfo.KMSContractAddress = %v, want 0xkms123", precond.KMSInfo.KMSContractAddress)
		}
		if precond.KMSInfo.ChainID == nil || *precond.KMSInfo.ChainID != 8453 {
			t.Errorf("KMSInfo.ChainID = %v, want 8453", precond.KMSInfo.ChainID)
		}
	})
}
