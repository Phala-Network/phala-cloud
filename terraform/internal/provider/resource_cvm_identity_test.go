package provider

import (
	"testing"

	"github.com/hashicorp/terraform-plugin-framework/types"
)

func TestResolveProvisionIdentity_DefaultPhala(t *testing.T) {
	kms, customAppID, hasCustomAppID, nonce, hasNonce, diags := resolveProvisionIdentity(
		types.StringNull(),
		types.StringNull(),
		types.Int64Null(),
	)
	if diags.HasError() {
		t.Fatalf("expected no errors, got: %v", diags)
	}
	if kms != "phala" {
		t.Fatalf("expected kms phala, got %q", kms)
	}
	if customAppID != "" || hasCustomAppID {
		t.Fatalf("expected no custom app id, got %q / %v", customAppID, hasCustomAppID)
	}
	if nonce != 0 || hasNonce {
		t.Fatalf("expected no nonce, got %d / %v", nonce, hasNonce)
	}
}

func TestResolveProvisionIdentity_CustomAppIDRequiresNonceForPhala(t *testing.T) {
	_, _, _, _, _, diags := resolveProvisionIdentity(
		types.StringValue("phala"),
		types.StringValue("app_custom123"),
		types.Int64Null(),
	)
	if !diags.HasError() {
		t.Fatal("expected validation error for missing nonce")
	}
}

func TestResolveProvisionIdentity_NonceRequiresCustomAppID(t *testing.T) {
	_, _, _, _, _, diags := resolveProvisionIdentity(
		types.StringValue("phala"),
		types.StringNull(),
		types.Int64Value(1),
	)
	if !diags.HasError() {
		t.Fatal("expected validation error for nonce without custom_app_id")
	}
}

func TestResolveProvisionIdentity_NonPhalaUnsupportedForNow(t *testing.T) {
	_, _, _, _, _, diags := resolveProvisionIdentity(
		types.StringValue("ethereum"),
		types.StringNull(),
		types.Int64Null(),
	)
	if !diags.HasError() {
		t.Fatal("expected validation error for unsupported kms flow")
	}
}
