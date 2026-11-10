package phala

import (
	"strings"
	"testing"
	"time"
)

func TestParseLogTimeOverflow(t *testing.T) {
	_, err := parseLogTime("20000000000s", time.Unix(1234, 567000000), false)
	if err == nil || !strings.Contains(err.Error(), "overflow") {
		t.Fatalf("got %v, want overflow", err)
	}
}
