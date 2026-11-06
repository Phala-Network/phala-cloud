package phala

import (
	"encoding/json"
	"testing"
)

// The requirements key set is measured: an explicit default and an unset key
// hash differently, so only set fields may reach the wire.
func TestComposeRequirementsSendsOnlySetKeys(t *testing.T) {
	cases := []struct {
		name string
		req  ComposeRequirements
		want string
	}{
		{"unset", ComposeRequirements{}, `{}`},
		{"explicit_false", ComposeRequirements{EphemeralDataDisk: Bool(false)}, `{"ephemeral_data_disk":false}`},
		{"explicit_true", ComposeRequirements{EphemeralDataDisk: Bool(true), HealthCheck: Bool(false)},
			`{"ephemeral_data_disk":true,"health_check":false}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := json.Marshal(tc.req)
			if err != nil {
				t.Fatal(err)
			}
			if string(got) != tc.want {
				t.Fatalf("got %s, want %s", got, tc.want)
			}
			var back ComposeRequirements
			if err := json.Unmarshal(got, &back); err != nil {
				t.Fatal(err)
			}
			again, _ := json.Marshal(back)
			if string(again) != tc.want {
				t.Fatalf("round trip got %s, want %s", again, tc.want)
			}
		})
	}
}
