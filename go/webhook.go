package phala

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"
)

// WebhookEvent represents the envelope of a webhook payload.
type WebhookEvent struct {
	ID        string           `json:"id"`
	Event     string           `json:"event"`
	Version   string           `json:"version"`
	CreatedAt string           `json:"created_at"`
	Workspace WebhookWorkspace `json:"workspace"`
	Data      json.RawMessage  `json:"data"`
}

// WebhookWorkspace identifies the workspace that triggered the event.
type WebhookWorkspace struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// VerifyWebhookSignature verifies an HMAC-SHA256 webhook signature.
// The signature format is "sha256=<hex>".
func VerifyWebhookSignature(secret, timestamp, body, signature string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%s.%s", timestamp, body)))
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

// ParseWebhookEvent verifies the signature and parses a webhook event.
// Default tolerance is 300 seconds (5 minutes).
func ParseWebhookEvent(headers http.Header, body []byte, secret string, toleranceSeconds ...int) (*WebhookEvent, error) {
	tolerance := 300
	if len(toleranceSeconds) > 0 && toleranceSeconds[0] > 0 {
		tolerance = toleranceSeconds[0]
	}

	timestamp := headers.Get("X-Webhook-Timestamp")
	signature := headers.Get("X-Webhook-Signature")
	if timestamp == "" || signature == "" {
		return nil, fmt.Errorf("missing required webhook headers: X-Webhook-Timestamp and X-Webhook-Signature")
	}

	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid timestamp: %w", err)
	}

	now := time.Now().Unix()
	if math.Abs(float64(now-ts)) > float64(tolerance) {
		return nil, fmt.Errorf("webhook timestamp expired")
	}

	if !VerifyWebhookSignature(secret, timestamp, string(body), signature) {
		return nil, fmt.Errorf("invalid webhook signature")
	}

	var event WebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		return nil, fmt.Errorf("failed to parse webhook event: %w", err)
	}
	return &event, nil
}
