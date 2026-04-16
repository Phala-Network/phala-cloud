package phala

import "testing"

func TestCvmKmsInfo_ChainName(t *testing.T) {
	tests := []struct {
		name    string
		chainID *int
		want    string
	}{
		{"base", intPtr(8453), "Base"},
		{"mainnet", intPtr(1), "Ethereum"},
		{"anvil", intPtr(31337), "Anvil"},
		{"unknown", intPtr(99999), ""},
		{"nil", nil, ""},
		{"nil receiver", nil, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var k *CvmKmsInfo
			if tt.name != "nil receiver" {
				k = &CvmKmsInfo{ChainID: tt.chainID}
			}
			if got := k.ChainName(); got != tt.want {
				t.Errorf("ChainName() = %q, want %q", got, tt.want)
			}
		})
	}
}

func intPtr(v int) *int {
	return &v
}
