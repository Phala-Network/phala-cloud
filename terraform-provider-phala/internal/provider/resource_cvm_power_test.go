package provider

import "testing"

func TestPowerStateHelpers(t *testing.T) {
	t.Run("valid desired power states", func(t *testing.T) {
		if !isValidDesiredPowerState("running") {
			t.Fatal("expected running to be valid")
		}
		if !isValidDesiredPowerState("stopped") {
			t.Fatal("expected stopped to be valid")
		}
		if isValidDesiredPowerState("starting") {
			t.Fatal("expected starting to be invalid")
		}
	})

	t.Run("stable power state mapping", func(t *testing.T) {
		if got := stablePowerState("running"); got != "running" {
			t.Fatalf("unexpected stable state: %q", got)
		}
		if got := stablePowerState("stopped"); got != "stopped" {
			t.Fatalf("unexpected stable state: %q", got)
		}
		if got := stablePowerState("starting"); got != "" {
			t.Fatalf("expected empty stable state for transitional status, got: %q", got)
		}
	})

	t.Run("start decision", func(t *testing.T) {
		if shouldStart("running") {
			t.Fatal("should not start when already running")
		}
		if shouldStart("starting") {
			t.Fatal("should not start when already starting")
		}
		if !shouldStart("stopped") {
			t.Fatal("should start when stopped")
		}
	})

	t.Run("stop decision", func(t *testing.T) {
		if shouldStop("stopped") {
			t.Fatal("should not stop when already stopped")
		}
		if shouldStop("stopping") {
			t.Fatal("should not stop when already stopping")
		}
		if shouldStop("shutdown") {
			t.Fatal("should not stop when already shutting down")
		}
		if !shouldStop("running") {
			t.Fatal("should stop when running")
		}
	})
}
