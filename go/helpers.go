package phala

import (
	"regexp"
	"strings"
)

var (
	// UUID v4 pattern (with or without dashes).
	uuidRegex = regexp.MustCompile(
		`(?i)^[0-9a-f]{8}-?[0-9a-f]{4}-?4[0-9a-f]{3}-?[89ab][0-9a-f]{3}-?[0-9a-f]{12}$`,
	)
	// 40-char hex string (unprefixed app_id).
	appIDRegex = regexp.MustCompile(`(?i)^[0-9a-f]{40}$`)
)

// ResolveCVMID normalizes a CVM identifier to the format expected by the API.
//
// Supported input formats:
//   - UUID (with or without dashes): dashes are removed
//   - 40-char hex app_id: "app_" prefix is added
//   - Integer ID, hashed ID, name, or already-prefixed ID: used as-is
func ResolveCVMID(id string) string {
	if id == "" {
		return ""
	}
	if uuidRegex.MatchString(id) {
		return strings.ReplaceAll(id, "-", "")
	}
	if appIDRegex.MatchString(id) {
		return "app_" + id
	}
	return id
}

// String returns a pointer to the given string value.
func String(v string) *string { return &v }

// Int returns a pointer to the given int value.
func Int(v int) *int { return &v }

// Int64 returns a pointer to the given int64 value.
func Int64(v int64) *int64 { return &v }

// Float64 returns a pointer to the given float64 value.
func Float64(v float64) *float64 { return &v }

// Bool returns a pointer to the given bool value.
func Bool(v bool) *bool { return &v }
