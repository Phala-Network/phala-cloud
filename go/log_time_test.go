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

func TestParseLogTimeCeilsFractionExactly(t *testing.T) {
	got, err := parseLogTime("2026-11-10T00:00:00.000000001Z", time.Now(), true)
	if err != nil || got != 1794268801 {
		t.Fatalf("got %d, %v", got, err)
	}
	got, err = parseLogTime("2026-11-10T00:00:00Z", time.Now(), true)
	if err != nil || got != 1794268800 {
		t.Fatalf("got %d, %v", got, err)
	}
}
