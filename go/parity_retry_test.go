package phala

import "testing"

func TestNegativeClientRetriesRejected(t *testing.T) {
	_, err := NewClient(WithAPIKey("key"), WithMaxRetries(-1))
	if err == nil {
		t.Fatal("negative retries must be rejected")
	}
}
