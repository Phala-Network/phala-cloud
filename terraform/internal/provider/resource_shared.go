package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/hashicorp/terraform-plugin-framework/diag"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/booldefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/boolplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/int64default"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/int64planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/listplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringdefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

// ---------------------------------------------------------------------------
// Shared schema attributes
// ---------------------------------------------------------------------------

// sharedCVMSchemaAttrs returns schema attributes for the phala_app resource.
// Callers may override individual attributes after merging the returned map
// into their own.
func sharedCVMSchemaAttrs() map[string]schema.Attribute {
	return map[string]schema.Attribute{
		"name": schema.StringAttribute{
			Required:            true,
			MarkdownDescription: "Resource name. Force-new.",
			PlanModifiers: []planmodifier.String{
				stringplanmodifier.RequiresReplace(),
			},
		},
		"region": schema.StringAttribute{
			Optional:            true,
			MarkdownDescription: "Preferred region identifier. Force-new.",
			PlanModifiers: []planmodifier.String{
				stringplanmodifier.RequiresReplace(),
			},
		},
		"size": schema.StringAttribute{
			Required:            true,
			MarkdownDescription: "Instance type (e.g. tdx.small).",
		},
		"image": schema.StringAttribute{
			Optional:            true,
			Computed:            true,
			MarkdownDescription: "OS image name.",
		},
		"kms": schema.StringAttribute{
			Optional: true,
			Computed: true,
			Default:  stringdefault.StaticString("phala"),
			MarkdownDescription: "KMS type for app provisioning (`phala`, `ethereum`, `base`). " +
				"Changing this forces replacement.",
			PlanModifiers: []planmodifier.String{
				stringplanmodifier.RequiresReplace(),
			},
		},
		"node_id": schema.Int64Attribute{
			Optional: true,
			MarkdownDescription: "Optional target node (teepod) ID for initial placement. " +
				"Changing this forces replacement.",
			PlanModifiers: []planmodifier.Int64{
				int64planmodifier.RequiresReplace(),
			},
		},
		"custom_app_id": schema.StringAttribute{
			Optional: true,
			MarkdownDescription: "Optional custom app_id for deterministic identity flow. " +
				"Changing this forces replacement.",
			PlanModifiers: []planmodifier.String{
				stringplanmodifier.RequiresReplace(),
			},
		},
		"nonce": schema.Int64Attribute{
			Optional: true,
			MarkdownDescription: "Optional nonce paired with custom_app_id for PHALA KMS deterministic app_id flow. " +
				"Changing this forces replacement.",
			PlanModifiers: []planmodifier.Int64{
				int64planmodifier.RequiresReplace(),
			},
		},
		"public_logs": schema.BoolAttribute{
			Optional:            true,
			Computed:            true,
			MarkdownDescription: "Expose container logs publicly (compose file setting). Changing this triggers compose update/restart.",
		},
		"public_sysinfo": schema.BoolAttribute{
			Optional:            true,
			Computed:            true,
			MarkdownDescription: "Expose system info publicly (compose file setting). Changing this triggers compose update/restart.",
		},
		"public_tcbinfo": schema.BoolAttribute{
			Optional:            true,
			Computed:            true,
			MarkdownDescription: "Expose TCB attestation info publicly (compose file setting). Changing this triggers compose update/restart.",
		},
		"gateway_enabled": schema.BoolAttribute{
			Optional:            true,
			Computed:            true,
			MarkdownDescription: "Enable public gateway routing (compose file setting). Changing this triggers compose update/restart.",
		},
		"secure_time": schema.BoolAttribute{
			Optional:            true,
			Computed:            true,
			MarkdownDescription: "Enable secure time mode (compose file setting). Changing this triggers compose update/restart.",
		},
		"storage_fs": schema.StringAttribute{
			Optional:            true,
			Computed:            true,
			MarkdownDescription: "Storage filesystem for deployment (`zfs` or `ext4`). Immutable after initial deployment.",
			PlanModifiers: []planmodifier.String{
				stringplanmodifier.RequiresReplace(),
			},
		},
		"disk_size": schema.Int64Attribute{
			Optional:            true,
			Computed:            true,
			MarkdownDescription: "Disk size in GB.",
		},
		"docker_compose": schema.StringAttribute{
			Required:            true,
			MarkdownDescription: "Docker Compose YAML content.",
		},
		"pre_launch_script": schema.StringAttribute{
			Optional:            true,
			MarkdownDescription: "Optional pre-launch script content.",
		},
		"ssh_authorized_keys": schema.ListAttribute{
			Optional:    true,
			ElementType: types.StringType,
			MarkdownDescription: "Per-deployment SSH public keys injected at launch via user_config. " +
				"Force-new because runtime mutation is not exposed in current public API.",
			PlanModifiers: []planmodifier.List{
				listplanmodifier.RequiresReplace(),
			},
		},
		"env": schema.MapAttribute{
			Optional:    true,
			Sensitive:   true,
			ElementType: types.StringType,
			MarkdownDescription: "Plaintext env vars. Provider auto-derives env_keys and encrypts values " +
				"before API submission. Plaintext still exists in Terraform state.",
		},
		"encrypted_env": schema.StringAttribute{
			Optional:            true,
			Sensitive:           true,
			MarkdownDescription: "Hex-encoded encrypted env payload (manual mode).",
		},
		"env_keys": schema.ListAttribute{
			Optional:            true,
			ElementType:         types.StringType,
			MarkdownDescription: "Allowed environment variable keys used with encrypted_env/manual mode.",
		},
		"env_compose_hash": schema.StringAttribute{
			Optional: true,
			MarkdownDescription: "Optional compose hash for phase-2 encrypted env update flow " +
				"(contract-owned KMS; used with env_transaction_hash).",
		},
		"env_transaction_hash": schema.StringAttribute{
			Optional: true,
			MarkdownDescription: "Optional on-chain transaction hash for phase-2 encrypted env update flow " +
				"(contract-owned KMS; used with env_compose_hash).",
		},
		"listed": schema.BoolAttribute{
			Optional:            true,
			Computed:            true,
			Default:             booldefault.StaticBool(false),
			MarkdownDescription: "Whether the resource should be publicly listed. Force-new.",
			PlanModifiers: []planmodifier.Bool{
				boolplanmodifier.RequiresReplace(),
			},
		},
		"wait_for_ready": schema.BoolAttribute{
			Optional:            true,
			Computed:            true,
			Default:             booldefault.StaticBool(true),
			MarkdownDescription: "Wait until status is running after create/update.",
		},
		"wait_timeout_seconds": schema.Int64Attribute{
			Optional:            true,
			Computed:            true,
			Default:             int64default.StaticInt64(600),
			MarkdownDescription: "Wait timeout for async operations.",
		},
		"status": schema.StringAttribute{
			Computed:            true,
			MarkdownDescription: "Current CVM status.",
			PlanModifiers: []planmodifier.String{
				stringplanmodifier.UseStateForUnknown(),
			},
		},
		"endpoint": schema.StringAttribute{
			Computed:            true,
			MarkdownDescription: "Primary public endpoint URL.",
			PlanModifiers: []planmodifier.String{
				stringplanmodifier.UseStateForUnknown(),
			},
		},
	}
}

// ---------------------------------------------------------------------------
// Shared compose file / provision request builders
// ---------------------------------------------------------------------------

// composeFileFields holds the inputs needed to build a compose_file map for
// the /cvms/provision API.
type composeFileFields struct {
	Name            string
	DockerCompose   string
	PreLaunchScript types.String
	PublicLogs      types.Bool
	PublicSysinfo   types.Bool
	PublicTCBInfo   types.Bool
	GatewayEnabled  types.Bool
	SecureTime      types.Bool
	StorageFS       types.String
	EnvKeys         []string
}

func buildComposeFile(f composeFileFields) map[string]any {
	cf := map[string]any{
		"name":                f.Name,
		"docker_compose_file": f.DockerCompose,
	}
	if !f.PreLaunchScript.IsNull() && !f.PreLaunchScript.IsUnknown() {
		cf["pre_launch_script"] = f.PreLaunchScript.ValueString()
	}
	if !f.PublicLogs.IsNull() && !f.PublicLogs.IsUnknown() {
		cf["public_logs"] = f.PublicLogs.ValueBool()
	}
	if !f.PublicSysinfo.IsNull() && !f.PublicSysinfo.IsUnknown() {
		cf["public_sysinfo"] = f.PublicSysinfo.ValueBool()
	}
	if !f.PublicTCBInfo.IsNull() && !f.PublicTCBInfo.IsUnknown() {
		cf["public_tcbinfo"] = f.PublicTCBInfo.ValueBool()
	}
	if !f.GatewayEnabled.IsNull() && !f.GatewayEnabled.IsUnknown() {
		cf["gateway_enabled"] = f.GatewayEnabled.ValueBool()
	}
	if !f.SecureTime.IsNull() && !f.SecureTime.IsUnknown() {
		cf["secure_time"] = f.SecureTime.ValueBool()
	}
	if !f.StorageFS.IsNull() && !f.StorageFS.IsUnknown() {
		cf["storage_fs"] = f.StorageFS.ValueString()
	}
	if len(f.EnvKeys) > 0 {
		cf["allowed_envs"] = f.EnvKeys
	}
	return cf
}

// provisionFields holds the inputs needed to build a /cvms/provision request.
type provisionFields struct {
	Name              string
	Size              string
	ComposeFile       map[string]any
	KMS               string
	Listed            bool
	Region            types.String
	NodeID            int64
	HasNodeID         bool
	Image             types.String
	CustomAppID       string
	HasCustomAppID    bool
	Nonce             int64
	HasNonce          bool
	DiskSize          types.Int64
	SSHAuthorizedKeys []string
}

func buildProvisionReq(f provisionFields) (map[string]any, error) {
	req := map[string]any{
		"name":          f.Name,
		"instance_type": f.Size,
		"compose_file":  f.ComposeFile,
		"kms":           kmsPayloadValue(f.KMS),
		"listed":        f.Listed,
	}
	if !f.Region.IsNull() && !f.Region.IsUnknown() {
		req["region"] = f.Region.ValueString()
	}
	if f.HasNodeID {
		req["teepod_id"] = f.NodeID
	}
	if !f.Image.IsNull() && !f.Image.IsUnknown() {
		req["image"] = f.Image.ValueString()
	}
	if f.HasCustomAppID {
		req["app_id"] = f.CustomAppID
	}
	if f.HasNonce {
		req["nonce"] = f.Nonce
	}
	if !f.DiskSize.IsNull() && !f.DiskSize.IsUnknown() {
		req["disk_size"] = f.DiskSize.ValueInt64()
	}
	if len(f.SSHAuthorizedKeys) > 0 {
		userConfig, err := json.Marshal(map[string]any{
			"ssh_authorized_keys": f.SSHAuthorizedKeys,
		})
		if err != nil {
			return nil, fmt.Errorf("build user_config JSON: %w", err)
		}
		req["user_config"] = string(userConfig)
	}
	return req, nil
}

// provisionResponse holds the common fields returned from /cvms/provision.
type provisionResponse struct {
	AppID               string `json:"app_id"`
	ComposeHash         string `json:"compose_hash"`
	AppEnvEncryptPubkey string `json:"app_env_encrypt_pubkey"`
}

// commitAndCreate calls POST /cvms to finalize a provision request.
// Returns the CVM API response from the commit.
func commitAndCreate(
	ctx context.Context,
	client *APIClient,
	provResp provisionResponse,
	encryptedEnv string,
	hasEncryptedEnv bool,
	envKeys []string,
) (*cvmAPIResponse, error) {
	commitReq := map[string]any{
		"app_id":       provResp.AppID,
		"compose_hash": provResp.ComposeHash,
	}
	if hasEncryptedEnv {
		commitReq["encrypted_env"] = encryptedEnv
	}
	if len(envKeys) > 0 {
		commitReq["env_keys"] = envKeys
	}

	var createResp cvmAPIResponse
	if err := client.PostJSON(ctx, "/cvms", commitReq, &createResp); err != nil {
		return nil, err
	}
	return &createResp, nil
}

// ---------------------------------------------------------------------------
// Shared env encryption validation & preparation
// ---------------------------------------------------------------------------

// envConfig holds parsed environment variable configuration shared between
// Create and Update for both resource types.
type envConfig struct {
	EnvVars               map[string]string
	ManualEnvKeys         []string
	ManualEncryptedEnv    string
	HasManualEncrypted    bool
	EnvComposeHash        string
	EnvTransactionHash    string
	HasAutoEnv            bool
	EffectiveEnvKeys      []string
	EffectiveEncrypted    string
	HasEffectiveEncrypted bool
}

// parseEnvConfig extracts and validates environment variable configuration
// from plan attributes. It is shared between resource_app and resource_cvm.
func parseEnvConfig(
	ctx context.Context,
	env types.Map,
	encryptedEnv types.String,
	envKeys types.List,
	envComposeHash types.String,
	envTransactionHash types.String,
	forCreate bool,
) (*envConfig, diag.Diagnostics) {
	var diags diag.Diagnostics

	envVars, d := mapValueAsStrings(ctx, env, "env")
	diags.Append(d...)
	manualKeys, d := listValueAsStrings(ctx, envKeys, "env_keys")
	diags.Append(d...)
	manualEncrypted, hasManualEncrypted, d := knownOptionalString(encryptedEnv, "encrypted_env")
	diags.Append(d...)
	composeHash, _, d := knownOptionalString(envComposeHash, "env_compose_hash")
	diags.Append(d...)
	txHash, _, d := knownOptionalString(envTransactionHash, "env_transaction_hash")
	diags.Append(d...)
	if diags.HasError() {
		return nil, diags
	}

	if forCreate && (strings.TrimSpace(composeHash) != "" || strings.TrimSpace(txHash) != "") {
		diags.AddError(
			"Invalid create configuration",
			"env_compose_hash and env_transaction_hash are update-only fields.",
		)
		return nil, diags
	}

	hasAutoEnv := !env.IsNull()
	if hasAutoEnv && (hasManualEncrypted || len(manualKeys) > 0) {
		diags.AddError(
			"Conflicting env configuration",
			"Use either env (auto encryption) or encrypted_env/env_keys (manual mode), not both.",
		)
		return nil, diags
	}

	if hasAutoEnv && !forCreate {
		diags.Append(validateEncryptedEnvConfig(true, true, composeHash, txHash)...)
	} else {
		diags.Append(validateEncryptedEnvConfig(hasManualEncrypted, len(manualKeys) > 0, composeHash, txHash)...)
	}
	if diags.HasError() {
		return nil, diags
	}

	cfg := &envConfig{
		EnvVars:               envVars,
		ManualEnvKeys:         manualKeys,
		ManualEncryptedEnv:    manualEncrypted,
		HasManualEncrypted:    hasManualEncrypted,
		EnvComposeHash:        composeHash,
		EnvTransactionHash:    txHash,
		HasAutoEnv:            hasAutoEnv,
		EffectiveEnvKeys:      manualKeys,
		EffectiveEncrypted:    manualEncrypted,
		HasEffectiveEncrypted: hasManualEncrypted,
	}
	if hasAutoEnv {
		cfg.EffectiveEnvKeys = sortedEnvKeys(envVars)
	}
	return cfg, diags
}

// encryptAutoEnv encrypts the plaintext env vars using the given public key
// and updates the envConfig's effective fields in-place.
func (cfg *envConfig) encryptAutoEnv(pubkey string) error {
	if !cfg.HasAutoEnv {
		return nil
	}
	encrypted, err := encryptEnvMap(cfg.EnvVars, pubkey)
	if err != nil {
		return err
	}
	cfg.EffectiveEncrypted = encrypted
	cfg.HasEffectiveEncrypted = true
	return nil
}

// buildEnvUpdateReq constructs the payload for PATCH /cvms/{id}/envs.
func (cfg *envConfig) buildEnvUpdateReq(envKeysList types.List) (map[string]any, error) {
	envReq := map[string]any{}
	if cfg.HasAutoEnv {
		envReq["encrypted_env"] = cfg.EffectiveEncrypted
		envReq["env_keys"] = cfg.EffectiveEnvKeys
	} else {
		if !cfg.HasManualEncrypted {
			return nil, fmt.Errorf("updating env_keys or phase-2 fields requires encrypted_env to be set")
		}
		envReq["encrypted_env"] = cfg.ManualEncryptedEnv
		if !envKeysList.IsNull() && !envKeysList.IsUnknown() {
			envReq["env_keys"] = cfg.ManualEnvKeys
		}
	}
	if strings.TrimSpace(cfg.EnvComposeHash) != "" {
		envReq["compose_hash"] = cfg.EnvComposeHash
	}
	if strings.TrimSpace(cfg.EnvTransactionHash) != "" {
		envReq["transaction_hash"] = cfg.EnvTransactionHash
	}
	return envReq, nil
}

// ---------------------------------------------------------------------------
// Shared compose settings change detection
// ---------------------------------------------------------------------------

// composeSettingsValues bundles the bool fields that control compose runtime
// settings, used for change detection between plan and state.
type composeSettingsValues struct {
	PublicLogs     types.Bool
	PublicSysinfo  types.Bool
	PublicTCBInfo  types.Bool
	GatewayEnabled types.Bool
	SecureTime     types.Bool
}

func (v composeSettingsValues) changed(other composeSettingsValues) bool {
	return !v.PublicLogs.Equal(other.PublicLogs) ||
		!v.PublicSysinfo.Equal(other.PublicSysinfo) ||
		!v.PublicTCBInfo.Equal(other.PublicTCBInfo) ||
		!v.GatewayEnabled.Equal(other.GatewayEnabled) ||
		!v.SecureTime.Equal(other.SecureTime)
}

func (v composeSettingsValues) buildProvisionReq(name string) map[string]any {
	req := map[string]any{"name": name}
	if !v.PublicLogs.IsNull() && !v.PublicLogs.IsUnknown() {
		req["public_logs"] = v.PublicLogs.ValueBool()
	}
	if !v.PublicSysinfo.IsNull() && !v.PublicSysinfo.IsUnknown() {
		req["public_sysinfo"] = v.PublicSysinfo.ValueBool()
	}
	if !v.PublicTCBInfo.IsNull() && !v.PublicTCBInfo.IsUnknown() {
		req["public_tcbinfo"] = v.PublicTCBInfo.ValueBool()
	}
	if !v.GatewayEnabled.IsNull() && !v.GatewayEnabled.IsUnknown() {
		req["gateway_enabled"] = v.GatewayEnabled.ValueBool()
	}
	if !v.SecureTime.IsNull() && !v.SecureTime.IsUnknown() {
		req["secure_time"] = v.SecureTime.ValueBool()
	}
	return req
}

// ---------------------------------------------------------------------------
// Shared polling with jitter
// ---------------------------------------------------------------------------

// pollInterval returns a base duration with added jitter (±25%) to avoid
// thundering-herd effects when multiple resources poll concurrently.
func pollInterval(base time.Duration) time.Duration {
	jitter := time.Duration(rand.Int63n(int64(base) / 2)) //nolint:gosec // jitter doesn't need crypto rand
	return base - base/4 + jitter
}

// ---------------------------------------------------------------------------
// Shared plan-to-state fallback helpers
// ---------------------------------------------------------------------------

// inheritOptionalString copies the state value into plan when plan is
// null/unknown. Used for optional+computed fields in Update.
func inheritOptionalString(plan, state types.String) types.String {
	if plan.IsNull() || plan.IsUnknown() {
		return state
	}
	return plan
}

// inheritOptionalBool copies the state value into plan when plan is
// null/unknown.
func inheritOptionalBool(plan, state types.Bool) types.Bool {
	if plan.IsNull() || plan.IsUnknown() {
		return state
	}
	return plan
}

// diskSizeValidation checks whether a disk_size update is valid (can only
// grow). Returns changed bool and any diagnostics.
func diskSizeValidation(plan, state types.Int64) (bool, diag.Diagnostics) {
	var diags diag.Diagnostics
	changed := !plan.IsNull() && !plan.IsUnknown() && !plan.Equal(state)
	if changed &&
		!state.IsNull() && !state.IsUnknown() &&
		plan.ValueInt64() < state.ValueInt64() {
		diags.AddError(
			"Invalid disk_size update",
			fmt.Sprintf("disk_size can only grow (current=%d, requested=%d).",
				state.ValueInt64(), plan.ValueInt64()),
		)
	}
	return changed, diags
}
