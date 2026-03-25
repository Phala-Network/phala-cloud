package phala

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"testing"
	"time"
)

func computeTestSignature(secret, timestamp, body string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%s.%s", timestamp, body)))
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

const testSecret = "whsec_test_secret_123"
const testBody = `{"id":"evt_abc","event":"cvm.created","version":"1","created_at":"2026-01-01T00:00:00Z","workspace":{"id":"ws1","name":"test"},"data":{}}`

func TestVerifyWebhookSignature_Valid(t *testing.T) {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	sig := computeTestSignature(testSecret, ts, testBody)
	if !VerifyWebhookSignature(testSecret, ts, testBody, sig) {
		t.Fatal("expected valid signature")
	}
}

func TestVerifyWebhookSignature_WrongSecret(t *testing.T) {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	sig := computeTestSignature("wrong", ts, testBody)
	if VerifyWebhookSignature(testSecret, ts, testBody, sig) {
		t.Fatal("expected invalid signature")
	}
}

func TestVerifyWebhookSignature_TamperedBody(t *testing.T) {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	sig := computeTestSignature(testSecret, ts, testBody)
	if VerifyWebhookSignature(testSecret, ts, "tampered", sig) {
		t.Fatal("expected invalid for tampered body")
	}
}

func TestVerifyWebhookSignature_InvalidFormat(t *testing.T) {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	if VerifyWebhookSignature(testSecret, ts, testBody, "invalid") {
		t.Fatal("expected invalid for bad format")
	}
}

func TestParseWebhookEvent_Valid(t *testing.T) {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	sig := computeTestSignature(testSecret, ts, testBody)
	headers := http.Header{}
	headers.Set("X-Webhook-Timestamp", ts)
	headers.Set("X-Webhook-Signature", sig)
	event, err := ParseWebhookEvent(headers, []byte(testBody), testSecret)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if event.ID != "evt_abc" || event.Event != "cvm.created" {
		t.Fatalf("unexpected event: %+v", event)
	}
}

func TestParseWebhookEvent_ExpiredTimestamp(t *testing.T) {
	ts := strconv.FormatInt(time.Now().Unix()-600, 10)
	sig := computeTestSignature(testSecret, ts, testBody)
	headers := http.Header{}
	headers.Set("X-Webhook-Timestamp", ts)
	headers.Set("X-Webhook-Signature", sig)
	_, err := ParseWebhookEvent(headers, []byte(testBody), testSecret)
	if err == nil {
		t.Fatal("expected error for expired timestamp")
	}
}

func TestParseWebhookEvent_BoundaryTimestamp(t *testing.T) {
	ts := strconv.FormatInt(time.Now().Unix()-300, 10)
	sig := computeTestSignature(testSecret, ts, testBody)
	headers := http.Header{}
	headers.Set("X-Webhook-Timestamp", ts)
	headers.Set("X-Webhook-Signature", sig)
	_, err := ParseWebhookEvent(headers, []byte(testBody), testSecret)
	if err != nil {
		t.Fatalf("expected valid at boundary: %v", err)
	}
}

func TestParseWebhookEvent_MissingHeaders(t *testing.T) {
	_, err := ParseWebhookEvent(http.Header{}, []byte(testBody), testSecret)
	if err == nil {
		t.Fatal("expected error for missing headers")
	}
}

func TestParseWebhookEvent_InvalidSignature(t *testing.T) {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	headers := http.Header{}
	headers.Set("X-Webhook-Timestamp", ts)
	headers.Set("X-Webhook-Signature", "sha256=invalid")
	_, err := ParseWebhookEvent(headers, []byte(testBody), testSecret)
	if err == nil {
		t.Fatal("expected error for invalid signature")
	}
}

func TestParseWebhookEvent_CustomTolerance(t *testing.T) {
	ts := strconv.FormatInt(time.Now().Unix()-400, 10)
	sig := computeTestSignature(testSecret, ts, testBody)
	headers := http.Header{}
	headers.Set("X-Webhook-Timestamp", ts)
	headers.Set("X-Webhook-Signature", sig)
	_, err := ParseWebhookEvent(headers, []byte(testBody), testSecret, 500)
	if err != nil {
		t.Fatalf("expected valid with custom tolerance: %v", err)
	}
}
