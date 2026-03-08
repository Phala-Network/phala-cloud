package provider

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/hashicorp/terraform-plugin-framework/diag"
	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/booldefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/boolplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/int64default"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/listplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

var _ resource.Resource = &cvmResource{}
var _ resource.ResourceWithImportState = &cvmResource{}

type cvmResource struct {
	client *APIClient
}

type cvmResourceModel struct {
	ID                 types.String `tfsdk:"id"`
	Name               types.String `tfsdk:"name"`
	Region             types.String `tfsdk:"region"`
	Size               types.String `tfsdk:"size"`
	Image              types.String `tfsdk:"image"`
	PublicLogs         types.Bool   `tfsdk:"public_logs"`
	PublicSysinfo      types.Bool   `tfsdk:"public_sysinfo"`
	PublicTCBInfo      types.Bool   `tfsdk:"public_tcbinfo"`
	GatewayEnabled     types.Bool   `tfsdk:"gateway_enabled"`
	SecureTime         types.Bool   `tfsdk:"secure_time"`
	StorageFS          types.String `tfsdk:"storage_fs"`
	DiskSize           types.Int64  `tfsdk:"disk_size"`
	DockerCompose      types.String `tfsdk:"docker_compose"`
	PreLaunchScript    types.String `tfsdk:"pre_launch_script"`
	SSHAuthorizedKeys  types.List   `tfsdk:"ssh_authorized_keys"`
	Env                types.Map    `tfsdk:"env"`
	EncryptedEnv       types.String `tfsdk:"encrypted_env"`
	EnvKeys            types.List   `tfsdk:"env_keys"`
	EnvComposeHash     types.String `tfsdk:"env_compose_hash"`
	EnvTransactionHash types.String `tfsdk:"env_transaction_hash"`
	Listed             types.Bool   `tfsdk:"listed"`
	WaitForReady       types.Bool   `tfsdk:"wait_for_ready"`
	WaitTimeoutSecond  types.Int64  `tfsdk:"wait_timeout_seconds"`
	Status             types.String `tfsdk:"status"`
	AppID              types.String `tfsdk:"app_id"`
	VMUUID             types.String `tfsdk:"vm_uuid"`
	InstanceID         types.String `tfsdk:"instance_id"`
	Endpoint           types.String `tfsdk:"endpoint"`
}

type cvmAPIResponse struct {
	ID         json.RawMessage `json:"id"`
	Name       string          `json:"name"`
	Status     string          `json:"status"`
	InProgress bool            `json:"in_progress"`
	Listed     *bool           `json:"listed"`
	AppID      string          `json:"app_id"`
	VMUUID     string          `json:"vm_uuid"`
	InstanceID string          `json:"instance_id"`
	EnvPubkey  *string         `json:"encrypted_env_pubkey"`
	KMSInfo    *struct {
		EncryptedEnvPubkey string `json:"encrypted_env_pubkey"`
	} `json:"kms_info"`

	Resource *struct {
		InstanceType string `json:"instance_type"`
		DiskInGB     *int64 `json:"disk_in_gb"`
	} `json:"resource"`

	InstanceType string `json:"instance_type"`
	DiskSize     *int64 `json:"disk_size"`

	Progress *struct {
		Target string `json:"target"`
	} `json:"progress"`

	NodeInfo *struct {
		Region string `json:"region"`
	} `json:"node_info"`
	Node *struct {
		RegionIdentifier string `json:"region_identifier"`
	} `json:"node"`
	OS *struct {
		Name string `json:"name"`
	} `json:"os"`
	BaseImage      string `json:"base_image"`
	PublicLogs     *bool  `json:"public_logs"`
	PublicSysinfo  *bool  `json:"public_sysinfo"`
	PublicTCBInfo  *bool  `json:"public_tcbinfo"`
	GatewayEnabled *bool  `json:"gateway_enabled"`
	SecureTime     *bool  `json:"secure_time"`
	StorageFS      string `json:"storage_fs"`

	Endpoints []struct {
		App string `json:"app"`
	} `json:"endpoints"`
	PublicURLs []struct {
		App string `json:"app"`
	} `json:"public_urls"`
}

func NewCVMResource() resource.Resource {
	return &cvmResource{}
}

func (r *cvmResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_cvm"
}

func (r *cvmResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "Manages a Phala Cloud CVM.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "CVM identifier used by this provider (vm_uuid or app_id).",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				Required:            true,
				MarkdownDescription: "CVM name.",
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
				MarkdownDescription: "Instance type, similar to DigitalOcean droplet size (e.g. tdx.small).",
			},
			"image": schema.StringAttribute{
				Optional:            true,
				Computed:            true,
				MarkdownDescription: "OS image name.",
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
				MarkdownDescription: "Per-deployment SSH public keys injected at launch via CVM user_config. " +
					"Force-new because runtime mutation is not exposed in current public API.",
				PlanModifiers: []planmodifier.List{
					listplanmodifier.RequiresReplace(),
				},
			},
			"env": schema.MapAttribute{
				Optional:    true,
				Sensitive:   true,
				ElementType: types.StringType,
				MarkdownDescription: "Plaintext environment variables. Provider automatically derives env_keys and " +
					"encrypts values using CVM/KMS public key before API submission. " +
					"Note: plaintext values still exist in Terraform state (marked sensitive in CLI output).",
			},
			"encrypted_env": schema.StringAttribute{
				Optional:            true,
				Sensitive:           true,
				MarkdownDescription: "Hex-encoded encrypted environment blob. Passed through to CVM create/update APIs.",
			},
			"env_keys": schema.ListAttribute{
				Optional:    true,
				ElementType: types.StringType,
				MarkdownDescription: "Allowed environment variable keys. " +
					"When set with encrypted_env on create, these are also wired into compose_file.allowed_envs.",
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
				MarkdownDescription: "Whether CVM should be listed publicly. Force-new.",
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
			"app_id": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Phala app_id.",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"vm_uuid": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "VM UUID.",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"instance_id": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Runtime instance ID.",
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
		},
	}
}

func (r *cvmResource) Configure(_ context.Context, req resource.ConfigureRequest, _ *resource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}
	if client, ok := req.ProviderData.(*APIClient); ok {
		r.client = client
	}
}

func (r *cvmResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan cvmResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	sshAuthorizedKeys, diags := listValueAsStrings(ctx, plan.SSHAuthorizedKeys, "ssh_authorized_keys")
	resp.Diagnostics.Append(diags...)
	envVars, diags := mapValueAsStrings(ctx, plan.Env, "env")
	resp.Diagnostics.Append(diags...)
	manualEnvKeys, diags := listValueAsStrings(ctx, plan.EnvKeys, "env_keys")
	resp.Diagnostics.Append(diags...)
	manualEncryptedEnv, hasManualEncryptedEnv, diags := knownOptionalString(plan.EncryptedEnv, "encrypted_env")
	resp.Diagnostics.Append(diags...)
	envComposeHash, _, diags := knownOptionalString(plan.EnvComposeHash, "env_compose_hash")
	resp.Diagnostics.Append(diags...)
	envTransactionHash, _, diags := knownOptionalString(plan.EnvTransactionHash, "env_transaction_hash")
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	if strings.TrimSpace(envComposeHash) != "" || strings.TrimSpace(envTransactionHash) != "" {
		resp.Diagnostics.AddError(
			"Invalid create configuration",
			"env_compose_hash and env_transaction_hash are update-only fields.",
		)
		return
	}

	hasAutoEnv := !plan.Env.IsNull()
	if hasAutoEnv && (hasManualEncryptedEnv || len(manualEnvKeys) > 0) {
		resp.Diagnostics.AddError(
			"Conflicting env configuration",
			"Use either env (auto encryption) or encrypted_env/env_keys (manual mode), not both.",
		)
		return
	}
	resp.Diagnostics.Append(validateEncryptedEnvConfig(hasManualEncryptedEnv, len(manualEnvKeys) > 0, "", "")...)
	if resp.Diagnostics.HasError() {
		return
	}

	effectiveEnvKeys := manualEnvKeys
	effectiveEncryptedEnv := manualEncryptedEnv
	hasEffectiveEncryptedEnv := hasManualEncryptedEnv
	if hasAutoEnv {
		effectiveEnvKeys = sortedEnvKeys(envVars)
	}

	composeFile := map[string]any{
		"name":                plan.Name.ValueString(),
		"docker_compose_file": plan.DockerCompose.ValueString(),
	}
	if !plan.PreLaunchScript.IsNull() && !plan.PreLaunchScript.IsUnknown() {
		composeFile["pre_launch_script"] = plan.PreLaunchScript.ValueString()
	}
	if !plan.PublicLogs.IsNull() && !plan.PublicLogs.IsUnknown() {
		composeFile["public_logs"] = plan.PublicLogs.ValueBool()
	}
	if !plan.PublicSysinfo.IsNull() && !plan.PublicSysinfo.IsUnknown() {
		composeFile["public_sysinfo"] = plan.PublicSysinfo.ValueBool()
	}
	if !plan.PublicTCBInfo.IsNull() && !plan.PublicTCBInfo.IsUnknown() {
		composeFile["public_tcbinfo"] = plan.PublicTCBInfo.ValueBool()
	}
	if !plan.GatewayEnabled.IsNull() && !plan.GatewayEnabled.IsUnknown() {
		composeFile["gateway_enabled"] = plan.GatewayEnabled.ValueBool()
	}
	if !plan.SecureTime.IsNull() && !plan.SecureTime.IsUnknown() {
		composeFile["secure_time"] = plan.SecureTime.ValueBool()
	}
	if !plan.StorageFS.IsNull() && !plan.StorageFS.IsUnknown() {
		composeFile["storage_fs"] = plan.StorageFS.ValueString()
	}
	if len(effectiveEnvKeys) > 0 {
		composeFile["allowed_envs"] = effectiveEnvKeys
	}

	provisionReq := map[string]any{
		"name":          plan.Name.ValueString(),
		"instance_type": plan.Size.ValueString(),
		"compose_file":  composeFile,
		"kms":           "PHALA",
		"listed":        plan.Listed.ValueBool(),
	}
	if !plan.Region.IsNull() && !plan.Region.IsUnknown() {
		provisionReq["region"] = plan.Region.ValueString()
	}
	if !plan.Image.IsNull() && !plan.Image.IsUnknown() {
		provisionReq["image"] = plan.Image.ValueString()
	}
	if !plan.DiskSize.IsNull() && !plan.DiskSize.IsUnknown() {
		provisionReq["disk_size"] = plan.DiskSize.ValueInt64()
	}
	if len(sshAuthorizedKeys) > 0 {
		userConfig, err := json.Marshal(map[string]any{
			"ssh_authorized_keys": sshAuthorizedKeys,
		})
		if err != nil {
			resp.Diagnostics.AddError("Invalid ssh_authorized_keys", fmt.Sprintf("Failed to build user_config JSON: %v", err))
			return
		}
		provisionReq["user_config"] = string(userConfig)
	}

	var provisionResp struct {
		AppID               string `json:"app_id"`
		ComposeHash         string `json:"compose_hash"`
		AppEnvEncryptPubkey string `json:"app_env_encrypt_pubkey"`
	}
	if err := r.client.PostJSON(ctx, "/cvms/provision", provisionReq, &provisionResp); err != nil {
		resp.Diagnostics.AddError("Failed to provision CVM", err.Error())
		return
	}
	if provisionResp.ComposeHash == "" {
		resp.Diagnostics.AddError("Invalid provision response", "compose_hash was empty.")
		return
	}
	if strings.TrimSpace(provisionResp.AppID) == "" {
		resp.Diagnostics.AddError(
			"Unsupported KMS flow",
			"Provision did not return app_id. This usually means onchain KMS flow is required and is not yet supported by this provider.",
		)
		return
	}
	if hasAutoEnv {
		if strings.TrimSpace(provisionResp.AppEnvEncryptPubkey) == "" {
			resp.Diagnostics.AddError(
				"Missing encryption public key",
				"Provision response did not include app_env_encrypt_pubkey required for env auto-encryption.",
			)
			return
		}
		encryptedEnv, err := encryptEnvMap(envVars, provisionResp.AppEnvEncryptPubkey)
		if err != nil {
			resp.Diagnostics.AddError("Failed to encrypt env", err.Error())
			return
		}
		effectiveEncryptedEnv = encryptedEnv
		hasEffectiveEncryptedEnv = true
	}

	var createResp cvmAPIResponse
	commitReq := map[string]any{
		"app_id":       provisionResp.AppID,
		"compose_hash": provisionResp.ComposeHash,
	}
	if hasEffectiveEncryptedEnv {
		commitReq["encrypted_env"] = effectiveEncryptedEnv
	}
	if len(effectiveEnvKeys) > 0 {
		commitReq["env_keys"] = effectiveEnvKeys
	}
	if err := r.client.PostJSON(ctx, "/cvms", commitReq, &createResp); err != nil {
		resp.Diagnostics.AddError("Failed to create CVM", err.Error())
		return
	}

	id := selectCVMIdentifier(createResp, provisionResp.AppID)
	if id == "" {
		resp.Diagnostics.AddError(
			"Invalid create response",
			"Unable to derive a stable CVM identifier from create/provision response.",
		)
		return
	}
	plan.ID = types.StringValue(id)
	if shouldWait(plan.WaitForReady) {
		if err := r.waitForReady(ctx, plan.ID.ValueString(), waitTimeout(plan.WaitTimeoutSecond)); err != nil {
			resp.Diagnostics.AddError("CVM did not become ready", err.Error())
			return
		}
	}

	current, err := r.fetchCVM(ctx, plan.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Failed to read CVM after create", err.Error())
		return
	}

	resp.Diagnostics.Append(r.populateState(ctx, &plan, current)...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, plan)...)
}

func (r *cvmResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state cvmResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}
	if state.ID.IsNull() || state.ID.IsUnknown() {
		return
	}

	current, err := r.fetchCVM(ctx, state.ID.ValueString())
	if err != nil {
		if isNotFound(err) {
			resp.State.RemoveResource(ctx)
			return
		}
		resp.Diagnostics.AddError("Failed to read CVM", err.Error())
		return
	}

	resp.Diagnostics.Append(r.populateState(ctx, &state, current)...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, state)...)
}

func (r *cvmResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan cvmResourceModel
	var state cvmResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	id := state.ID.ValueString()
	plan.ID = state.ID
	if plan.Image.IsNull() || plan.Image.IsUnknown() {
		plan.Image = state.Image
	}
	if plan.PublicLogs.IsNull() || plan.PublicLogs.IsUnknown() {
		plan.PublicLogs = state.PublicLogs
	}
	if plan.PublicSysinfo.IsNull() || plan.PublicSysinfo.IsUnknown() {
		plan.PublicSysinfo = state.PublicSysinfo
	}
	if plan.PublicTCBInfo.IsNull() || plan.PublicTCBInfo.IsUnknown() {
		plan.PublicTCBInfo = state.PublicTCBInfo
	}
	if plan.GatewayEnabled.IsNull() || plan.GatewayEnabled.IsUnknown() {
		plan.GatewayEnabled = state.GatewayEnabled
	}
	if plan.SecureTime.IsNull() || plan.SecureTime.IsUnknown() {
		plan.SecureTime = state.SecureTime
	}
	if plan.StorageFS.IsNull() || plan.StorageFS.IsUnknown() {
		plan.StorageFS = state.StorageFS
	}
	desiredSize := plan.Size
	desiredDiskSize := plan.DiskSize
	desiredImage := plan.Image
	desiredPublicLogs := plan.PublicLogs
	desiredPublicSysinfo := plan.PublicSysinfo
	desiredPublicTCBInfo := plan.PublicTCBInfo
	desiredGatewayEnabled := plan.GatewayEnabled
	desiredSecureTime := plan.SecureTime
	desiredDockerCompose := plan.DockerCompose
	desiredPreLaunchScript := plan.PreLaunchScript
	diskSizeChanged := !plan.DiskSize.IsNull() && !plan.DiskSize.IsUnknown() && !plan.DiskSize.Equal(state.DiskSize)
	imageChanged := !plan.Image.Equal(state.Image)
	composeSettingsChanged := !plan.PublicLogs.Equal(state.PublicLogs) ||
		!plan.PublicSysinfo.Equal(state.PublicSysinfo) ||
		!plan.PublicTCBInfo.Equal(state.PublicTCBInfo) ||
		!plan.GatewayEnabled.Equal(state.GatewayEnabled) ||
		!plan.SecureTime.Equal(state.SecureTime)

	if diskSizeChanged &&
		!state.DiskSize.IsNull() && !state.DiskSize.IsUnknown() &&
		plan.DiskSize.ValueInt64() < state.DiskSize.ValueInt64() {
		resp.Diagnostics.AddError(
			"Invalid disk_size update",
			fmt.Sprintf("disk_size can only grow (current=%d, requested=%d).", state.DiskSize.ValueInt64(), plan.DiskSize.ValueInt64()),
		)
		return
	}

	envVars, diags := mapValueAsStrings(ctx, plan.Env, "env")
	resp.Diagnostics.Append(diags...)
	manualEnvKeys, diags := listValueAsStrings(ctx, plan.EnvKeys, "env_keys")
	resp.Diagnostics.Append(diags...)
	manualEncryptedEnv, hasManualEncryptedEnv, diags := knownOptionalString(plan.EncryptedEnv, "encrypted_env")
	resp.Diagnostics.Append(diags...)
	envComposeHash, _, diags := knownOptionalString(plan.EnvComposeHash, "env_compose_hash")
	resp.Diagnostics.Append(diags...)
	envTransactionHash, _, diags := knownOptionalString(plan.EnvTransactionHash, "env_transaction_hash")
	resp.Diagnostics.Append(diags...)
	hasAutoEnv := !plan.Env.IsNull()
	if hasAutoEnv && (hasManualEncryptedEnv || len(manualEnvKeys) > 0) {
		resp.Diagnostics.AddError(
			"Conflicting env configuration",
			"Use either env (auto encryption) or encrypted_env/env_keys (manual mode), not both.",
		)
		return
	}
	if hasAutoEnv {
		resp.Diagnostics.Append(validateEncryptedEnvConfig(true, true, envComposeHash, envTransactionHash)...)
	} else {
		resp.Diagnostics.Append(validateEncryptedEnvConfig(hasManualEncryptedEnv, len(manualEnvKeys) > 0, envComposeHash, envTransactionHash)...)
	}
	if resp.Diagnostics.HasError() {
		return
	}

	if !plan.Size.Equal(state.Size) || diskSizeChanged {
		resourceReq := map[string]any{
			"allow_restart": true,
		}
		if !plan.Size.Equal(state.Size) {
			resourceReq["instance_type"] = plan.Size.ValueString()
		}
		if diskSizeChanged {
			resourceReq["disk_size"] = plan.DiskSize.ValueInt64()
		}

		if err := r.client.PatchJSON(ctx, cvmPath(id)+"/resources", resourceReq, nil); err != nil {
			resp.Diagnostics.AddError("Failed to resize/update resources", err.Error())
			return
		}
	}

	if imageChanged {
		if plan.Image.IsNull() || plan.Image.IsUnknown() || strings.TrimSpace(plan.Image.ValueString()) == "" {
			resp.Diagnostics.AddError(
				"Invalid image update",
				"image must be set to a target OS image name when updating.",
			)
			return
		}

		imageReq := map[string]any{
			"os_image_name": plan.Image.ValueString(),
		}
		if err := r.client.PatchJSON(ctx, cvmPath(id)+"/os-image", imageReq, nil); err != nil {
			resp.Diagnostics.AddError("Failed to update OS image", err.Error())
			return
		}
	}

	if composeSettingsChanged {
		composeReq := map[string]any{
			"name": plan.Name.ValueString(),
		}
		if !plan.PublicLogs.IsNull() && !plan.PublicLogs.IsUnknown() {
			composeReq["public_logs"] = plan.PublicLogs.ValueBool()
		}
		if !plan.PublicSysinfo.IsNull() && !plan.PublicSysinfo.IsUnknown() {
			composeReq["public_sysinfo"] = plan.PublicSysinfo.ValueBool()
		}
		if !plan.PublicTCBInfo.IsNull() && !plan.PublicTCBInfo.IsUnknown() {
			composeReq["public_tcbinfo"] = plan.PublicTCBInfo.ValueBool()
		}
		if !plan.GatewayEnabled.IsNull() && !plan.GatewayEnabled.IsUnknown() {
			composeReq["gateway_enabled"] = plan.GatewayEnabled.ValueBool()
		}
		if !plan.SecureTime.IsNull() && !plan.SecureTime.IsUnknown() {
			composeReq["secure_time"] = plan.SecureTime.ValueBool()
		}

		if err := provisionAndApplyComposeFileUpdate(ctx, r.client, id, composeReq); err != nil {
			resp.Diagnostics.AddError("Failed to update compose settings", err.Error())
			return
		}
	}

	if !plan.DockerCompose.Equal(state.DockerCompose) {
		if err := r.client.PatchText(
			ctx,
			cvmPath(id)+"/docker-compose",
			plan.DockerCompose.ValueString(),
			map[string]string{"Content-Type": "text/yaml"},
			nil,
		); err != nil {
			resp.Diagnostics.AddError("Failed to update docker compose", err.Error())
			return
		}
	}

	if !plan.PreLaunchScript.Equal(state.PreLaunchScript) {
		script := ""
		if !plan.PreLaunchScript.IsNull() && !plan.PreLaunchScript.IsUnknown() {
			script = plan.PreLaunchScript.ValueString()
		}
		if err := r.client.PatchText(
			ctx,
			cvmPath(id)+"/pre-launch-script",
			script,
			map[string]string{"Content-Type": "text/plain"},
			nil,
		); err != nil {
			resp.Diagnostics.AddError("Failed to update pre-launch script", err.Error())
			return
		}
	}

	if !plan.Env.Equal(state.Env) ||
		!plan.EncryptedEnv.Equal(state.EncryptedEnv) ||
		!plan.EnvKeys.Equal(state.EnvKeys) ||
		!plan.EnvComposeHash.Equal(state.EnvComposeHash) ||
		!plan.EnvTransactionHash.Equal(state.EnvTransactionHash) {
		envReq := map[string]any{}
		if hasAutoEnv {
			current, err := r.fetchCVM(ctx, id)
			if err != nil {
				resp.Diagnostics.AddError("Failed to load CVM encryption key", err.Error())
				return
			}
			pubkey := current.envEncryptionPubkey()
			if pubkey == "" {
				resp.Diagnostics.AddError(
					"Missing encryption public key",
					"CVM response did not include encrypted_env_pubkey. Use manual encrypted_env/env_keys mode for this CVM.",
				)
				return
			}

			encryptedEnv, err := encryptEnvMap(envVars, pubkey)
			if err != nil {
				resp.Diagnostics.AddError("Failed to encrypt env", err.Error())
				return
			}
			envReq["encrypted_env"] = encryptedEnv
			envReq["env_keys"] = sortedEnvKeys(envVars)
		} else {
			if !hasManualEncryptedEnv {
				resp.Diagnostics.AddError(
					"Missing encrypted_env",
					"Updating env_keys or phase-2 fields requires encrypted_env to be set.",
				)
				return
			}
			envReq["encrypted_env"] = manualEncryptedEnv
			if !plan.EnvKeys.IsNull() && !plan.EnvKeys.IsUnknown() {
				envReq["env_keys"] = manualEnvKeys
			}
		}
		if envComposeHash != "" {
			envReq["compose_hash"] = envComposeHash
		}
		if envTransactionHash != "" {
			envReq["transaction_hash"] = envTransactionHash
		}

		if err := r.client.PatchJSON(ctx, cvmPath(id)+"/envs", envReq, nil); err != nil {
			if apiErr, ok := err.(*APIError); ok && apiErr.StatusCode == 465 {
				resp.Diagnostics.AddError(
					"Encrypted env update requires on-chain verification",
					"API returned HTTP 465 (compose hash registration required). Register compose_hash on-chain and retry with env_compose_hash and env_transaction_hash.",
				)
				return
			}
			resp.Diagnostics.AddError("Failed to update encrypted env", err.Error())
			return
		}
	}

	if shouldWait(plan.WaitForReady) {
		if err := r.waitForReady(ctx, id, waitTimeout(plan.WaitTimeoutSecond)); err != nil {
			resp.Diagnostics.AddError("CVM did not become ready", err.Error())
			return
		}
	}

	current, err := r.fetchCVM(ctx, id)
	if err != nil {
		resp.Diagnostics.AddError("Failed to read CVM after update", err.Error())
		return
	}

	resp.Diagnostics.Append(r.populateState(ctx, &plan, current)...)
	if resp.Diagnostics.HasError() {
		return
	}
	if !shouldWait(plan.WaitForReady) {
		// Async operations may still report old/transitional values right after PATCH.
		// Keep planned values for changed fields to avoid post-apply state inconsistencies.
		if !desiredSize.Equal(state.Size) {
			plan.Size = desiredSize
		}
		if diskSizeChanged {
			plan.DiskSize = desiredDiskSize
		} else if plan.DiskSize.IsUnknown() {
			plan.DiskSize = state.DiskSize
		}
		if !desiredDockerCompose.Equal(state.DockerCompose) {
			plan.DockerCompose = desiredDockerCompose
		}
		if !desiredPreLaunchScript.Equal(state.PreLaunchScript) {
			plan.PreLaunchScript = desiredPreLaunchScript
		}
		if imageChanged {
			plan.Image = desiredImage
		}
		if composeSettingsChanged {
			plan.PublicLogs = desiredPublicLogs
			plan.PublicSysinfo = desiredPublicSysinfo
			plan.PublicTCBInfo = desiredPublicTCBInfo
			plan.GatewayEnabled = desiredGatewayEnabled
			plan.SecureTime = desiredSecureTime
		}
		plan.Status = state.Status
	}
	if plan.DiskSize.IsUnknown() {
		plan.DiskSize = state.DiskSize
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, plan)...)
}

func (r *cvmResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state cvmResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}
	id := state.ID.ValueString()

	if err := r.client.Delete(ctx, cvmPath(id)); err != nil && !isNotFound(err) {
		resp.Diagnostics.AddError("Failed to delete CVM", err.Error())
		return
	}

	deadline := time.Now().Add(90 * time.Second)
	for time.Now().Before(deadline) {
		_, err := r.fetchCVM(ctx, id)
		if err != nil {
			if isNotFound(err) {
				return
			}
			if !isRetryable(err) {
				resp.Diagnostics.AddWarning("Delete verification skipped", err.Error())
				return
			}
		}

		select {
		case <-ctx.Done():
			resp.Diagnostics.AddWarning("Delete wait interrupted", ctx.Err().Error())
			return
		case <-time.After(2 * time.Second):
		}
	}

	resp.Diagnostics.AddWarning(
		"CVM deletion not fully confirmed",
		"Delete request succeeded but final 404 confirmation timed out.",
	)
}

func (r *cvmResource) ImportState(
	ctx context.Context,
	req resource.ImportStateRequest,
	resp *resource.ImportStateResponse,
) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}

func (r *cvmResource) fetchCVM(ctx context.Context, id string) (*cvmAPIResponse, error) {
	var out cvmAPIResponse
	if err := r.client.GetJSON(ctx, cvmPath(id), &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r *cvmResource) waitForReady(ctx context.Context, id string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		cvm, err := r.fetchCVM(ctx, id)
		if err != nil {
			if isRetryable(err) || isNotFound(err) {
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(3 * time.Second):
					continue
				}
			}
			return err
		}

		if strings.EqualFold(cvm.Status, "running") && !cvm.inProgress() {
			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(3 * time.Second):
		}
	}

	return fmt.Errorf("timeout after %s waiting for CVM %q to become ready", timeout, id)
}

func (r *cvmResource) populateState(
	ctx context.Context,
	state *cvmResourceModel,
	current *cvmAPIResponse,
) diag.Diagnostics {
	var diags diag.Diagnostics

	if current.Name != "" {
		state.Name = types.StringValue(current.Name)
	}
	if v := current.instanceType(); v != "" {
		state.Size = types.StringValue(v)
	}
	if current.DiskSize != nil {
		state.DiskSize = types.Int64Value(*current.DiskSize)
	}
	if current.Resource != nil && current.Resource.DiskInGB != nil {
		state.DiskSize = types.Int64Value(*current.Resource.DiskInGB)
	}

	if region := current.region(); region != "" {
		state.Region = types.StringValue(region)
	}
	if image := current.osImageName(); image != "" {
		state.Image = types.StringValue(image)
	}
	state.PublicLogs = nullableBool(current.PublicLogs)
	state.PublicSysinfo = nullableBool(current.PublicSysinfo)
	state.PublicTCBInfo = nullableBool(current.PublicTCBInfo)
	state.GatewayEnabled = nullableBool(current.GatewayEnabled)
	state.SecureTime = nullableBool(current.SecureTime)
	state.StorageFS = nullableString(current.StorageFS)

	state.Status = nullableString(current.Status)
	state.AppID = nullableString(current.AppID)
	state.VMUUID = nullableString(current.VMUUID)
	state.InstanceID = nullableString(current.InstanceID)
	state.Endpoint = nullableString(current.endpoint())

	if current.Listed != nil {
		state.Listed = types.BoolValue(*current.Listed)
	}

	compose, err := r.client.GetText(ctx, cvmPath(state.ID.ValueString())+"/docker-compose.yml")
	if err == nil {
		state.DockerCompose = types.StringValue(normalizeTextBody(compose))
	}

	if !state.PreLaunchScript.IsNull() && !state.PreLaunchScript.IsUnknown() {
		preLaunchScript, err := r.client.GetText(ctx, cvmPath(state.ID.ValueString())+"/pre-launch-script")
		if err == nil {
			state.PreLaunchScript = types.StringValue(normalizeTextBody(preLaunchScript))
		}
	}

	return diags
}

func cvmPath(id string) string {
	return "/cvms/" + url.PathEscape(id)
}

func selectCVMIdentifier(resp cvmAPIResponse, provisionAppID string) string {
	if id := resp.idString(); id != "" {
		return id
	}
	if strings.TrimSpace(resp.VMUUID) != "" {
		return resp.VMUUID
	}
	if strings.TrimSpace(resp.AppID) != "" {
		return ensureAppPrefix(resp.AppID)
	}
	if strings.TrimSpace(provisionAppID) != "" {
		return ensureAppPrefix(provisionAppID)
	}
	return ""
}

func ensureAppPrefix(v string) string {
	trimmed := strings.TrimSpace(v)
	if trimmed == "" {
		return ""
	}
	if strings.HasPrefix(trimmed, "app_") || strings.HasPrefix(trimmed, "0x") {
		return trimmed
	}
	if len(trimmed) == 40 {
		return "app_" + trimmed
	}
	return trimmed
}

func (r cvmAPIResponse) idString() string {
	if len(r.ID) == 0 {
		return ""
	}

	var asString string
	if err := json.Unmarshal(r.ID, &asString); err == nil {
		return strings.TrimSpace(asString)
	}

	var asInt int64
	if err := json.Unmarshal(r.ID, &asInt); err == nil {
		return strconv.FormatInt(asInt, 10)
	}

	var asFloat float64
	if err := json.Unmarshal(r.ID, &asFloat); err == nil {
		return strconv.FormatInt(int64(asFloat), 10)
	}

	return ""
}

func (r cvmAPIResponse) envEncryptionPubkey() string {
	if r.EnvPubkey != nil && strings.TrimSpace(*r.EnvPubkey) != "" {
		return strings.TrimSpace(*r.EnvPubkey)
	}
	if r.KMSInfo != nil && strings.TrimSpace(r.KMSInfo.EncryptedEnvPubkey) != "" {
		return strings.TrimSpace(r.KMSInfo.EncryptedEnvPubkey)
	}
	return ""
}

func (r cvmAPIResponse) osImageName() string {
	if r.OS != nil && strings.TrimSpace(r.OS.Name) != "" {
		return strings.TrimSpace(r.OS.Name)
	}
	if strings.TrimSpace(r.BaseImage) != "" {
		return strings.TrimSpace(r.BaseImage)
	}
	return ""
}

func provisionAndApplyComposeFileUpdate(
	ctx context.Context,
	client *APIClient,
	cvmID string,
	provisionReq map[string]any,
) error {
	if strings.TrimSpace(cvmID) == "" {
		return fmt.Errorf("missing cvm id for compose update")
	}
	if strings.TrimSpace(stringFromAny(provisionReq["name"])) == "" {
		return fmt.Errorf("compose update requires non-empty name")
	}

	var provisionResp struct {
		ComposeHash string `json:"compose_hash"`
	}
	if err := client.PostJSON(ctx, cvmPath(cvmID)+"/compose_file/provision", provisionReq, &provisionResp); err != nil {
		return err
	}
	if strings.TrimSpace(provisionResp.ComposeHash) == "" {
		return fmt.Errorf("compose update provision did not return compose_hash")
	}

	triggerReq := map[string]any{
		"compose_hash": provisionResp.ComposeHash,
	}
	if err := client.PatchJSON(ctx, cvmPath(cvmID)+"/compose_file", triggerReq, nil); err != nil {
		return err
	}
	return nil
}

func nullableString(v string) types.String {
	if strings.TrimSpace(v) == "" {
		return types.StringNull()
	}
	return types.StringValue(v)
}

func waitTimeout(v types.Int64) time.Duration {
	if v.IsNull() || v.IsUnknown() || v.ValueInt64() <= 0 {
		return 10 * time.Minute
	}
	return time.Duration(v.ValueInt64()) * time.Second
}

func shouldWait(v types.Bool) bool {
	if v.IsNull() || v.IsUnknown() {
		return true
	}
	return v.ValueBool()
}

func (r cvmAPIResponse) inProgress() bool {
	return r.InProgress || (r.Progress != nil && strings.TrimSpace(r.Progress.Target) != "")
}

func (r cvmAPIResponse) instanceType() string {
	if r.Resource != nil && strings.TrimSpace(r.Resource.InstanceType) != "" {
		return r.Resource.InstanceType
	}
	return r.InstanceType
}

func (r cvmAPIResponse) region() string {
	if r.NodeInfo != nil && strings.TrimSpace(r.NodeInfo.Region) != "" {
		return r.NodeInfo.Region
	}
	if r.Node != nil && strings.TrimSpace(r.Node.RegionIdentifier) != "" {
		return r.Node.RegionIdentifier
	}
	return ""
}

func (r cvmAPIResponse) endpoint() string {
	if len(r.Endpoints) > 0 && strings.TrimSpace(r.Endpoints[0].App) != "" {
		return r.Endpoints[0].App
	}
	if len(r.PublicURLs) > 0 && strings.TrimSpace(r.PublicURLs[0].App) != "" {
		return r.PublicURLs[0].App
	}
	return ""
}

func isNotFound(err error) bool {
	apiErr, ok := err.(*APIError)
	return ok && apiErr.StatusCode == 404
}

func isRetryable(err error) bool {
	apiErr, ok := err.(*APIError)
	if !ok {
		return false
	}
	return isRetryableStatus(apiErr.StatusCode)
}

func listValueAsStrings(ctx context.Context, value types.List, fieldName string) ([]string, diag.Diagnostics) {
	var diags diag.Diagnostics
	if value.IsNull() {
		return nil, diags
	}
	if value.IsUnknown() {
		diags.AddError("Unknown list value", fmt.Sprintf("%s must be known at apply time.", fieldName))
		return nil, diags
	}

	var out []string
	diags.Append(value.ElementsAs(ctx, &out, false)...)
	if diags.HasError() {
		return nil, diags
	}

	clean := make([]string, 0, len(out))
	for _, v := range out {
		trimmed := strings.TrimSpace(v)
		if trimmed != "" {
			clean = append(clean, trimmed)
		}
	}

	return clean, diags
}

func mapValueAsStrings(ctx context.Context, value types.Map, fieldName string) (map[string]string, diag.Diagnostics) {
	var diags diag.Diagnostics
	if value.IsNull() {
		return nil, diags
	}
	if value.IsUnknown() {
		diags.AddError("Unknown map value", fmt.Sprintf("%s must be known at apply time.", fieldName))
		return nil, diags
	}

	var out map[string]string
	diags.Append(value.ElementsAs(ctx, &out, false)...)
	if diags.HasError() {
		return nil, diags
	}

	clean := make(map[string]string, len(out))
	for k, v := range out {
		key := strings.TrimSpace(k)
		if key == "" {
			diags.AddError("Invalid env key", "env map contains an empty key.")
			continue
		}
		clean[key] = v
	}
	if diags.HasError() {
		return nil, diags
	}

	return clean, diags
}

func sortedEnvKeys(env map[string]string) []string {
	keys := make([]string, 0, len(env))
	for k := range env {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func knownOptionalString(value types.String, fieldName string) (string, bool, diag.Diagnostics) {
	var diags diag.Diagnostics
	if value.IsNull() {
		return "", false, diags
	}
	if value.IsUnknown() {
		diags.AddError("Unknown string value", fmt.Sprintf("%s must be known at apply time.", fieldName))
		return "", false, diags
	}
	return value.ValueString(), true, diags
}

func validateEncryptedEnvConfig(
	hasEncryptedEnv bool,
	hasEnvKeys bool,
	envComposeHash string,
	envTransactionHash string,
) diag.Diagnostics {
	var diags diag.Diagnostics

	if hasEnvKeys && !hasEncryptedEnv {
		diags.AddError(
			"Invalid encrypted env configuration",
			"env_keys requires encrypted_env to be set.",
		)
	}

	hasCompose := strings.TrimSpace(envComposeHash) != ""
	hasTx := strings.TrimSpace(envTransactionHash) != ""
	if hasCompose != hasTx {
		diags.AddError(
			"Invalid phase-2 env update configuration",
			"env_compose_hash and env_transaction_hash must be set together.",
		)
	}
	if (hasCompose || hasTx) && !hasEncryptedEnv {
		diags.AddError(
			"Invalid phase-2 env update configuration",
			"env_compose_hash/env_transaction_hash requires encrypted_env to be set.",
		)
	}

	return diags
}

func encryptEnvMap(env map[string]string, publicKeyBase64 string) (string, error) {
	pubkeyBytes, err := decodeEnvPublicKey(publicKeyBase64)
	if err != nil {
		return "", fmt.Errorf("decode env encryption key: %w", err)
	}
	if len(pubkeyBytes) != 32 {
		return "", fmt.Errorf("invalid env encryption key length: expected 32 bytes, got %d", len(pubkeyBytes))
	}

	curve := ecdh.X25519()
	remotePub, err := curve.NewPublicKey(pubkeyBytes)
	if err != nil {
		return "", fmt.Errorf("parse env encryption key: %w", err)
	}
	ephemeralPriv, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		return "", fmt.Errorf("generate ephemeral key: %w", err)
	}

	sharedSecret, err := ephemeralPriv.ECDH(remotePub)
	if err != nil {
		return "", fmt.Errorf("derive shared secret: %w", err)
	}
	if len(sharedSecret) < 32 {
		return "", fmt.Errorf("invalid shared secret length: %d", len(sharedSecret))
	}

	block, err := aes.NewCipher(sharedSecret[:32])
	if err != nil {
		return "", fmt.Errorf("create AES cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create AES-GCM cipher: %w", err)
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}

	plaintext, err := json.Marshal(map[string]map[string]string{
		"env": env,
	})
	if err != nil {
		return "", fmt.Errorf("marshal env payload: %w", err)
	}

	ephemeralPub := ephemeralPriv.PublicKey().Bytes()
	ciphertext := aead.Seal(nil, nonce, plaintext, ephemeralPub)

	out := make([]byte, 0, len(ephemeralPub)+len(nonce)+len(ciphertext))
	out = append(out, ephemeralPub...)
	out = append(out, nonce...)
	out = append(out, ciphertext...)

	return hex.EncodeToString(out), nil
}

func decodeEnvPublicKey(v string) ([]byte, error) {
	trimmed := strings.TrimSpace(v)
	if trimmed == "" {
		return nil, fmt.Errorf("empty value")
	}

	// Newer API versions return a hex-encoded X25519 public key.
	if out, err := hex.DecodeString(trimmed); err == nil && len(out) == 32 {
		return out, nil
	}

	// Backward compatibility for legacy base64 responses.
	if out, err := base64.StdEncoding.DecodeString(trimmed); err == nil {
		return out, nil
	}
	if out, err := base64.RawStdEncoding.DecodeString(trimmed); err == nil {
		return out, nil
	}

	return nil, fmt.Errorf("invalid base64 encoding")
}

func normalizeTextBody(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	var asString string
	if err := json.Unmarshal([]byte(trimmed), &asString); err == nil {
		return asString
	}

	return raw
}
