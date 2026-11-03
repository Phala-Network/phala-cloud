package phala

import (
	"strings"
	"testing"
)

func TestNegativeClientRetriesRejected(t *testing.T) {
	_, err := NewClient(WithAPIKey("key"), WithMaxRetries(-1))
	if err == nil || !strings.Contains(err.Error(), "max retries must be non-negative") {
		t.Fatalf("negative retries must be rejected with a max-retries error, got %v", err)
	}
	if _, err := NewClient(WithAPIKey("key"), WithMaxRetries(0)); err != nil {
		t.Fatalf("zero retries must be accepted: %v", err)
	}
}
