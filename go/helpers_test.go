package phala

import "testing"

func TestResolveCVMID(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"empty", "", ""},
		{"integer id", "123", "123"},
		{"name", "my-cvm", "my-cvm"},
		{"prefixed app_id", "app_abcdef1234567890abcdef1234567890abcdef12", "app_abcdef1234567890abcdef1234567890abcdef12"},

		// UUID with dashes → dashes removed
		{"uuid with dashes", "550e8400-e29b-41d4-a716-446655440000", "550e8400e29b41d4a716446655440000"},
		// UUID without dashes → unchanged
		{"uuid without dashes", "550e8400e29b41d4a716446655440000", "550e8400e29b41d4a716446655440000"},
		// UUID uppercase
		{"uuid uppercase", "550E8400-E29B-41D4-A716-446655440000", "550E8400E29B41D4A716446655440000"},

		// 40-char hex app_id → add app_ prefix
		{"40 hex app_id", "abcdef1234567890abcdef1234567890abcdef12", "app_abcdef1234567890abcdef1234567890abcdef12"},
		{"40 hex uppercase", "ABCDEF1234567890ABCDEF1234567890ABCDEF12", "app_ABCDEF1234567890ABCDEF1234567890ABCDEF12"},

		// 39 chars — not a valid app_id, return as-is
		{"39 chars", "abcdef1234567890abcdef1234567890abcdef1", "abcdef1234567890abcdef1234567890abcdef1"},
		// 41 chars — not a valid app_id, return as-is
		{"41 chars", "abcdef1234567890abcdef1234567890abcdef123", "abcdef1234567890abcdef1234567890abcdef123"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ResolveCVMID(tt.input)
			if got != tt.want {
				t.Errorf("ResolveCVMID(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestPointerHelpers(t *testing.T) {
	s := String("hello")
	if *s != "hello" {
		t.Errorf("String() = %q, want %q", *s, "hello")
	}

	i := Int(42)
	if *i != 42 {
		t.Errorf("Int() = %d, want %d", *i, 42)
	}

	i64 := Int64(99)
	if *i64 != 99 {
		t.Errorf("Int64() = %d, want %d", *i64, 99)
	}

	f := Float64(3.14)
	if *f != 3.14 {
		t.Errorf("Float64() = %f, want %f", *f, 3.14)
	}

	b := Bool(true)
	if *b != true {
		t.Errorf("Bool() = %v, want %v", *b, true)
	}
}
