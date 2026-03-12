package provider

import (
	"context"
	"testing"
	"time"

	"github.com/hashicorp/terraform-plugin-framework/types"
)

func TestBuildComposeFile(t *testing.T) {
	t.Parallel()

	t.Run("minimal", func(t *testing.T) {
		cf := buildComposeFile(composeFileFields{
			Name:          "test-app",
			DockerCompose: "version: '3'\nservices:\n  app:\n    image: nginx",
		})
		if cf["name"] != "test-app" {
			t.Errorf("name = %v, want test-app", cf["name"])
		}
		if cf["docker_compose_file"] == nil {
			t.Error("docker_compose_file should be set")
		}
		if _, ok := cf["public_logs"]; ok {
			t.Error("public_logs should not be set when null")
		}
	})

	t.Run("all_fields", func(t *testing.T) {
		cf := buildComposeFile(composeFileFields{
			Name:            "test-app",
			DockerCompose:   "version: '3'",
			PreLaunchScript: types.StringValue("#!/bin/bash\necho hello"),
			PublicLogs:      types.BoolValue(true),
			PublicSysinfo:   types.BoolValue(false),
			PublicTCBInfo:   types.BoolValue(true),
			GatewayEnabled:  types.BoolValue(true),
			SecureTime:      types.BoolValue(false),
			StorageFS:       types.StringValue("zfs"),
			EnvKeys:         []string{"FOO", "BAR"},
		})
		if cf["pre_launch_script"] != "#!/bin/bash\necho hello" {
			t.Errorf("pre_launch_script = %v", cf["pre_launch_script"])
		}
		if cf["public_logs"] != true {
			t.Errorf("public_logs = %v", cf["public_logs"])
		}
		if cf["public_sysinfo"] != false {
			t.Errorf("public_sysinfo = %v", cf["public_sysinfo"])
		}
		if cf["storage_fs"] != "zfs" {
			t.Errorf("storage_fs = %v", cf["storage_fs"])
		}
		keys := cf["allowed_envs"].([]string)
		if len(keys) != 2 || keys[0] != "FOO" || keys[1] != "BAR" {
			t.Errorf("allowed_envs = %v", cf["allowed_envs"])
		}
	})
}

func TestBuildProvisionReq(t *testing.T) {
	t.Parallel()

	t.Run("minimal", func(t *testing.T) {
		req, err := buildProvisionReq(provisionFields{
			Name:        "test-cvm",
			Size:        "tdx.small",
			ComposeFile: map[string]any{"name": "test"},
			KMS:         "phala",
			Listed:      false,
			Region:      types.StringNull(),
			Image:       types.StringNull(),
			DiskSize:    types.Int64Null(),
		})
		if err != nil {
			t.Fatal(err)
		}
		if req["name"] != "test-cvm" {
			t.Errorf("name = %v", req["name"])
		}
		if req["instance_type"] != "tdx.small" {
			t.Errorf("instance_type = %v", req["instance_type"])
		}
		if req["kms"] != "PHALA" {
			t.Errorf("kms = %v", req["kms"])
		}
		if _, ok := req["region"]; ok {
			t.Error("region should not be set when null")
		}
		if _, ok := req["teepod_id"]; ok {
			t.Error("teepod_id should not be set when HasNodeID is false")
		}
	})

	t.Run("with_all_optional_fields", func(t *testing.T) {
		req, err := buildProvisionReq(provisionFields{
			Name:              "test-cvm",
			Size:              "tdx.large",
			ComposeFile:       map[string]any{"name": "test"},
			KMS:               "ethereum",
			Listed:            true,
			Region:            types.StringValue("us-east"),
			NodeID:            42,
			HasNodeID:         true,
			Image:             types.StringValue("dstack-v0.3.5"),
			CustomAppID:       "custom123",
			HasCustomAppID:    true,
			Nonce:             7,
			HasNonce:          true,
			DiskSize:          types.Int64Value(50),
			SSHAuthorizedKeys: []string{"ssh-ed25519 AAAA..."},
		})
		if err != nil {
			t.Fatal(err)
		}
		if req["region"] != "us-east" {
			t.Errorf("region = %v", req["region"])
		}
		if req["teepod_id"] != int64(42) {
			t.Errorf("teepod_id = %v", req["teepod_id"])
		}
		if req["kms"] != "ETHEREUM" {
			t.Errorf("kms = %v", req["kms"])
		}
		if req["image"] != "dstack-v0.3.5" {
			t.Errorf("image = %v", req["image"])
		}
		if req["app_id"] != "custom123" {
			t.Errorf("app_id = %v", req["app_id"])
		}
		if req["nonce"] != int64(7) {
			t.Errorf("nonce = %v", req["nonce"])
		}
		if req["disk_size"] != int64(50) {
			t.Errorf("disk_size = %v", req["disk_size"])
		}
		if req["user_config"] == nil {
			t.Error("user_config should be set")
		}
	})
}

func TestParseEnvConfig(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	t.Run("null_env", func(t *testing.T) {
		cfg, diags := parseEnvConfig(ctx, types.MapNull(types.StringType), types.StringNull(), types.ListNull(types.StringType), types.StringNull(), types.StringNull(), true)
		if diags.HasError() {
			t.Fatalf("unexpected error: %v", diags)
		}
		if cfg.HasAutoEnv {
			t.Error("HasAutoEnv should be false")
		}
	})

	t.Run("auto_env_on_create", func(t *testing.T) {
		envMap, _ := types.MapValueFrom(ctx, types.StringType, map[string]string{"FOO": "bar", "BAZ": "qux"})
		cfg, diags := parseEnvConfig(ctx, envMap, types.StringNull(), types.ListNull(types.StringType), types.StringNull(), types.StringNull(), true)
		if diags.HasError() {
			t.Fatalf("unexpected error: %v", diags)
		}
		if !cfg.HasAutoEnv {
			t.Error("HasAutoEnv should be true")
		}
		if len(cfg.EffectiveEnvKeys) != 2 {
			t.Errorf("EffectiveEnvKeys = %v", cfg.EffectiveEnvKeys)
		}
		// Keys should be sorted
		if cfg.EffectiveEnvKeys[0] != "BAZ" || cfg.EffectiveEnvKeys[1] != "FOO" {
			t.Errorf("EffectiveEnvKeys not sorted: %v", cfg.EffectiveEnvKeys)
		}
	})

	t.Run("conflict_auto_and_manual", func(t *testing.T) {
		envMap, _ := types.MapValueFrom(ctx, types.StringType, map[string]string{"FOO": "bar"})
		_, diags := parseEnvConfig(ctx, envMap, types.StringValue("deadbeef"), types.ListNull(types.StringType), types.StringNull(), types.StringNull(), true)
		if !diags.HasError() {
			t.Error("expected conflict error")
		}
	})

	t.Run("phase2_on_create_rejected", func(t *testing.T) {
		_, diags := parseEnvConfig(ctx, types.MapNull(types.StringType), types.StringValue("encrypted"), types.ListNull(types.StringType), types.StringValue("hash"), types.StringValue("tx"), true)
		if !diags.HasError() {
			t.Error("expected create-time phase-2 rejection")
		}
	})
}

func TestComposeSettingsChanged(t *testing.T) {
	t.Parallel()

	a := composeSettingsValues{
		PublicLogs:     types.BoolValue(true),
		PublicSysinfo:  types.BoolValue(false),
		PublicTCBInfo:  types.BoolValue(true),
		GatewayEnabled: types.BoolValue(false),
		SecureTime:     types.BoolValue(false),
	}
	b := a // same values
	if a.changed(b) {
		t.Error("identical settings should not be changed")
	}

	c := a
	c.PublicLogs = types.BoolValue(false)
	if !a.changed(c) {
		t.Error("different PublicLogs should be changed")
	}
}

func TestDiskSizeValidation(t *testing.T) {
	t.Parallel()

	t.Run("grow_allowed", func(t *testing.T) {
		changed, diags := diskSizeValidation(types.Int64Value(50), types.Int64Value(20))
		if diags.HasError() {
			t.Errorf("unexpected error: %v", diags)
		}
		if !changed {
			t.Error("should be changed")
		}
	})

	t.Run("shrink_rejected", func(t *testing.T) {
		_, diags := diskSizeValidation(types.Int64Value(10), types.Int64Value(20))
		if !diags.HasError() {
			t.Error("shrink should be rejected")
		}
	})

	t.Run("null_unchanged", func(t *testing.T) {
		changed, diags := diskSizeValidation(types.Int64Null(), types.Int64Value(20))
		if diags.HasError() {
			t.Errorf("unexpected error: %v", diags)
		}
		if changed {
			t.Error("null should not be changed")
		}
	})
}

func TestPollInterval(t *testing.T) {
	t.Parallel()

	base := 4 * time.Second
	min := base - base/4
	max := base + base/4

	for i := 0; i < 100; i++ {
		d := pollInterval(base)
		if d < min || d > max {
			t.Errorf("pollInterval(%v) = %v, want [%v, %v]", base, d, min, max)
		}
	}
}

func TestInheritOptionalString(t *testing.T) {
	t.Parallel()

	result := inheritOptionalString(types.StringNull(), types.StringValue("fallback"))
	if result.ValueString() != "fallback" {
		t.Errorf("expected fallback, got %v", result)
	}

	result = inheritOptionalString(types.StringValue("override"), types.StringValue("fallback"))
	if result.ValueString() != "override" {
		t.Errorf("expected override, got %v", result)
	}
}

func TestInheritOptionalBool(t *testing.T) {
	t.Parallel()

	result := inheritOptionalBool(types.BoolNull(), types.BoolValue(true))
	if result.ValueBool() != true {
		t.Errorf("expected true, got %v", result)
	}

	result = inheritOptionalBool(types.BoolValue(false), types.BoolValue(true))
	if result.ValueBool() != false {
		t.Errorf("expected false, got %v", result)
	}
}

func TestEnvConfigBuildUpdateReq(t *testing.T) {
	t.Parallel()

	t.Run("auto_env", func(t *testing.T) {
		cfg := &envConfig{
			HasAutoEnv:         true,
			EffectiveEncrypted: "deadbeef",
			EffectiveEnvKeys:   []string{"FOO", "BAR"},
			EnvComposeHash:     "hash123",
			EnvTransactionHash: "tx456",
		}
		req, err := cfg.buildEnvUpdateReq(types.ListNull(types.StringType))
		if err != nil {
			t.Fatal(err)
		}
		if req["encrypted_env"] != "deadbeef" {
			t.Errorf("encrypted_env = %v", req["encrypted_env"])
		}
		if req["compose_hash"] != "hash123" {
			t.Errorf("compose_hash = %v", req["compose_hash"])
		}
		if req["transaction_hash"] != "tx456" {
			t.Errorf("transaction_hash = %v", req["transaction_hash"])
		}
	})

	t.Run("manual_without_encrypted_fails", func(t *testing.T) {
		cfg := &envConfig{
			HasAutoEnv:         false,
			HasManualEncrypted: false,
		}
		_, err := cfg.buildEnvUpdateReq(types.ListNull(types.StringType))
		if err == nil {
			t.Error("expected error for missing encrypted_env")
		}
	})
}
