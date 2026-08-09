package phala

import (
	"encoding/json"
	"testing"
)

func TestWorkspaceDecodesBillingLifecycle(t *testing.T) {
	payload := `{
		"id": "wks_1",
		"name": "acme",
		"slug": "acme",
		"avatar_url": "https://example.test/a.png",
		"description": "Acme workspace",
		"tier": "pro",
		"role": "owner",
		"is_default": true,
		"created_at": "2026-01-01T00:00:00Z",
		"confidential_models_enabled": true,
		"billing_status": "suspended",
		"suspended_at": "2026-08-01T00:00:00Z"
	}`

	var ws Workspace
	if err := json.Unmarshal([]byte(payload), &ws); err != nil {
		t.Fatalf("unmarshal workspace: %v", err)
	}
	if ws.AvatarURL == nil || *ws.AvatarURL != "https://example.test/a.png" {
		t.Fatalf("AvatarURL = %v, want the avatar_url value", ws.AvatarURL)
	}
	if ws.Description == nil || *ws.Description != "Acme workspace" {
		t.Fatalf("Description = %v, want %q", ws.Description, "Acme workspace")
	}
	if ws.BillingStatus == nil || *ws.BillingStatus != "suspended" {
		t.Fatalf("BillingStatus = %v, want suspended", ws.BillingStatus)
	}
	if ws.SuspendedAt == nil || *ws.SuspendedAt != "2026-08-01T00:00:00Z" {
		t.Fatalf("SuspendedAt = %v, want the suspended_at value", ws.SuspendedAt)
	}
	if ws.IsDefault == nil || !*ws.IsDefault {
		t.Fatalf("IsDefault = %v, want true", ws.IsDefault)
	}
	if ws.Role == nil || *ws.Role != "owner" {
		t.Fatalf("Role = %v, want owner", ws.Role)
	}
}

func TestWorkspaceOmitsAbsentOptionalFields(t *testing.T) {
	var ws Workspace
	if err := json.Unmarshal([]byte(`{"id":"wks_1","name":"acme","tier":"free"}`), &ws); err != nil {
		t.Fatalf("unmarshal minimal workspace: %v", err)
	}
	if ws.BillingStatus != nil || ws.SuspendedAt != nil || ws.AvatarURL != nil {
		t.Fatal("optional workspace fields set when absent from the payload, want nil")
	}
}
