package provider

import (
	"testing"

	"github.com/hashicorp/terraform-plugin-framework/types"
)

func TestResolveProvisionIdentity_DefaultPhala(t *testing.T) {
	id, diags := resolveProvisionIdentity(
		types.StringNull(),
		types.StringNull(),
		types.Int64Null(),
	)
	if diags.HasError() {
		t.Fatalf("expected no errors, got: %v", diags)
	}
	if id.KMSType != "phala" {
		t.Fatalf("expected kms phala, got %q", id.KMSType)
	}
	if id.CustomAppID != "" || id.HasCustomAppID {
		t.Fatalf("expected no custom app id, got %q / %v", id.CustomAppID, id.HasCustomAppID)
	}
	if id.Nonce != 0 || id.HasNonce {
		t.Fatalf("expected no nonce, got %d / %v", id.Nonce, id.HasNonce)
	}
}

func TestResolveProvisionIdentity_CustomAppIDRequiresNonceForPhala(t *testing.T) {
	_, diags := resolveProvisionIdentity(
		types.StringValue("phala"),
		types.StringValue("app_custom123"),
		types.Int64Null(),
	)
	if !diags.HasError() {
		t.Fatal("expected validation error for missing nonce")
	}
}

func TestResolveProvisionIdentity_NonceRequiresCustomAppID(t *testing.T) {
	_, diags := resolveProvisionIdentity(
		types.StringValue("phala"),
		types.StringNull(),
		types.Int64Value(1),
	)
	if !diags.HasError() {
		t.Fatal("expected validation error for nonce without custom_app_id")
	}
}

func TestResolveProvisionIdentity_CustomAppIDWithNonce(t *testing.T) {
	id, diags := resolveProvisionIdentity(
		types.StringValue("phala"),
		types.StringValue("app_custom123"),
		types.Int64Value(42),
	)
	if diags.HasError() {
		t.Fatalf("expected no errors, got: %v", diags)
	}
	if id.KMSType != "phala" {
		t.Fatalf("expected kms phala, got %q", id.KMSType)
	}
	if id.CustomAppID != "app_custom123" || !id.HasCustomAppID {
		t.Fatalf("expected custom app id app_custom123, got %q / %v", id.CustomAppID, id.HasCustomAppID)
	}
	if id.Nonce != 42 || !id.HasNonce {
		t.Fatalf("expected nonce 42, got %d / %v", id.Nonce, id.HasNonce)
	}
}

func TestResolveProvisionIdentity_EthereumUnsupported(t *testing.T) {
	_, diags := resolveProvisionIdentity(
		types.StringValue("ethereum"),
		types.StringNull(),
		types.Int64Null(),
	)
	if !diags.HasError() {
		t.Fatal("expected validation error for unsupported ethereum kms flow")
	}
}

func TestResolveProvisionIdentity_BaseUnsupported(t *testing.T) {
	_, diags := resolveProvisionIdentity(
		types.StringValue("base"),
		types.StringNull(),
		types.Int64Null(),
	)
	if !diags.HasError() {
		t.Fatal("expected validation error for unsupported base kms flow")
	}
}
