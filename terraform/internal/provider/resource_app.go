package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
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

var _ resource.Resource = &appResource{}
var _ resource.ResourceWithImportState = &appResource{}

type appResource struct {
	client *APIClient
}

type appResourceModel struct {
	ID                 types.String `tfsdk:"id"`
	AppID              types.String `tfsdk:"app_id"`
	Name               types.String `tfsdk:"name"`
	Region             types.String `tfsdk:"region"`
	Size               types.String `tfsdk:"size"`
	Image              types.String `tfsdk:"image"`
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
	Replicas           types.Int64  `tfsdk:"replicas"`
	WaitForReady       types.Bool   `tfsdk:"wait_for_ready"`
	WaitTimeoutSecond  types.Int64  `tfsdk:"wait_timeout_seconds"`
	Status             types.String `tfsdk:"status"`
	PrimaryCVMID       types.String `tfsdk:"primary_cvm_id"`
	CVMIDs             types.List   `tfsdk:"cvm_ids"`
	Endpoint           types.String `tfsdk:"endpoint"`
}

type appAPIResponse struct {
	ID         json.RawMessage  `json:"id"`
	Name       string           `json:"name"`
	AppID      string           `json:"app_id"`
	CurrentCVM *cvmAPIResponse  `json:"current_cvm"`
	CVMs       []cvmAPIResponse `json:"cvms"`
	CVMCount   *int64           `json:"cvm_count"`
}

func NewAppResource() resource.Resource {
	return &appResource{}
}

func (r *appResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_app"
}

func (r *appResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "Manages a Phala Cloud App (app_id + shared compose/env + replica count).",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Terraform ID (same as app_id).",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"app_id": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Phala app identifier.",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				Required:            true,
				MarkdownDescription: "App name. Force-new.",
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
				MarkdownDescription: "Instance type for CVMs under this app.",
			},
			"image": schema.StringAttribute{
				Optional:            true,
				Computed:            true,
				MarkdownDescription: "OS image name.",
			},
			"disk_size": schema.Int64Attribute{
				Optional:            true,
				Computed:            true,
				MarkdownDescription: "Disk size in GB.",
			},
			"docker_compose": schema.StringAttribute{
				Required:            true,
				MarkdownDescription: "Shared app docker compose YAML.",
			},
			"pre_launch_script": schema.StringAttribute{
				Optional:            true,
				MarkdownDescription: "Optional pre-launch script content.",
			},
			"ssh_authorized_keys": schema.ListAttribute{
				Optional:    true,
				ElementType: types.StringType,
				MarkdownDescription: "Per-deployment SSH public keys injected at first CVM launch via user_config. " +
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
				MarkdownDescription: "Whether the app should be publicly listed. Force-new.",
				PlanModifiers: []planmodifier.Bool{
					boolplanmodifier.RequiresReplace(),
				},
			},
			"replicas": schema.Int64Attribute{
				Optional:            true,
				Computed:            true,
				Default:             int64default.StaticInt64(1),
				MarkdownDescription: "Desired number of CVMs under this app.",
			},
			"wait_for_ready": schema.BoolAttribute{
				Optional:            true,
				Computed:            true,
				Default:             booldefault.StaticBool(true),
				MarkdownDescription: "Wait until desired replicas are running after create/update.",
			},
			"wait_timeout_seconds": schema.Int64Attribute{
				Optional:            true,
				Computed:            true,
				Default:             int64default.StaticInt64(600),
				MarkdownDescription: "Wait timeout for async operations.",
			},
			"status": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Status of primary CVM in the app.",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"primary_cvm_id": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Primary CVM identifier used for app-level patch operations.",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"cvm_ids": schema.ListAttribute{
				Computed:            true,
				ElementType:         types.StringType,
				MarkdownDescription: "Identifiers of CVMs currently attached to this app.",
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

func (r *appResource) Configure(_ context.Context, req resource.ConfigureRequest, _ *resource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}
	if client, ok := req.ProviderData.(*APIClient); ok {
		r.client = client
	}
}

func (r *appResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan appResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	replicas, diags := desiredReplicaCount(plan.Replicas)
	resp.Diagnostics.Append(diags...)
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
		resp.Diagnostics.AddError("Failed to provision app", err.Error())
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
		resp.Diagnostics.AddError("Failed to create initial app CVM", err.Error())
		return
	}

	appID := ensureAppPrefix(nonEmpty(createResp.AppID, provisionResp.AppID))
	if strings.TrimSpace(appID) == "" {
		resp.Diagnostics.AddError("Invalid create response", "Missing app_id in create/provision response.")
		return
	}

	sourceVMUUID := strings.TrimSpace(createResp.VMUUID)
	if replicas > 1 {
		if err := r.reconcileReplicas(ctx, appID, replicas, sourceVMUUID, waitTimeout(plan.WaitTimeoutSecond)); err != nil {
			resp.Diagnostics.AddError("Failed to scale app replicas", err.Error())
			return
		}
	}

	if shouldWait(plan.WaitForReady) {
		if err := r.waitForAppReady(ctx, appID, replicas, waitTimeout(plan.WaitTimeoutSecond)); err != nil {
			resp.Diagnostics.AddError("App did not become ready", err.Error())
			return
		}
	}

	plan.ID = types.StringValue(appID)
	plan.AppID = types.StringValue(appID)

	app, cvms, err := r.fetchAppAndCVMs(ctx, appID)
	if err != nil {
		resp.Diagnostics.AddError("Failed to read app after create", err.Error())
		return
	}
	resp.Diagnostics.Append(r.populateState(ctx, &plan, app, cvms)...)
	if resp.Diagnostics.HasError() {
		return
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, plan)...)
}

func (r *appResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state appResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	appID := appIDFromState(state)
	if appID == "" {
		resp.State.RemoveResource(ctx)
		return
	}

	app, cvms, err := r.fetchAppAndCVMs(ctx, appID)
	if err != nil {
		if isNotFound(err) {
			resp.State.RemoveResource(ctx)
			return
		}
		resp.Diagnostics.AddError("Failed to read app", err.Error())
		return
	}

	resp.Diagnostics.Append(r.populateState(ctx, &state, app, cvms)...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, state)...)
}

func (r *appResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan appResourceModel
	var state appResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	appID := appIDFromState(state)
	if appID == "" {
		resp.Diagnostics.AddError("Missing app ID", "Cannot update app without a persisted app_id.")
		return
	}
	if plan.Image.IsNull() || plan.Image.IsUnknown() {
		plan.Image = state.Image
	}

	desiredReplicas, diags := desiredReplicaCount(plan.Replicas)
	resp.Diagnostics.Append(diags...)
	desiredImage := plan.Image
	imageChanged := !plan.Image.Equal(state.Image)
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

	_, cvms, err := r.fetchAppAndCVMs(ctx, appID)
	if err != nil {
		resp.Diagnostics.AddError("Failed to fetch current app replicas", err.Error())
		return
	}
	primaryCVMID := selectPrimaryIdentifier(plan.PrimaryCVMID, state.PrimaryCVMID, cvms)
	if primaryCVMID == "" {
		resp.Diagnostics.AddError("No app replicas found", "App has no CVMs available for update operations.")
		return
	}

	if !plan.Size.Equal(state.Size) || (!plan.DiskSize.IsNull() && !plan.DiskSize.IsUnknown() && !plan.DiskSize.Equal(state.DiskSize)) {
		resourceReq := map[string]any{"allow_restart": true}
		if !plan.Size.Equal(state.Size) {
			resourceReq["instance_type"] = plan.Size.ValueString()
		}
		if !plan.DiskSize.IsNull() && !plan.DiskSize.IsUnknown() && !plan.DiskSize.Equal(state.DiskSize) {
			resourceReq["disk_size"] = plan.DiskSize.ValueInt64()
		}
		if err := r.client.PatchJSON(ctx, cvmPath(primaryCVMID)+"/resources", resourceReq, nil); err != nil {
			resp.Diagnostics.AddError("Failed to update app resources", err.Error())
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
		if err := r.patchOSImageAcrossReplicas(ctx, cvms, primaryCVMID, plan.Image.ValueString()); err != nil {
			resp.Diagnostics.AddError("Failed to update app OS image", err.Error())
			return
		}
	}

	if !plan.DockerCompose.Equal(state.DockerCompose) {
		if err := r.patchTextAcrossReplicas(
			ctx,
			cvms,
			primaryCVMID,
			"/docker-compose",
			plan.DockerCompose.ValueString(),
			map[string]string{"Content-Type": "text/yaml"},
		); err != nil {
			resp.Diagnostics.AddError("Failed to update app docker compose", err.Error())
			return
		}
	}

	if !plan.PreLaunchScript.Equal(state.PreLaunchScript) {
		script := ""
		if !plan.PreLaunchScript.IsNull() && !plan.PreLaunchScript.IsUnknown() {
			script = plan.PreLaunchScript.ValueString()
		}
		if err := r.patchTextAcrossReplicas(
			ctx,
			cvms,
			primaryCVMID,
			"/pre-launch-script",
			script,
			map[string]string{"Content-Type": "text/plain"},
		); err != nil {
			resp.Diagnostics.AddError("Failed to update app pre-launch script", err.Error())
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
			current, err := r.fetchCVM(ctx, primaryCVMID)
			if err != nil {
				resp.Diagnostics.AddError("Failed to load app encryption key", err.Error())
				return
			}
			pubkey := current.envEncryptionPubkey()
			if pubkey == "" {
				resp.Diagnostics.AddError(
					"Missing encryption public key",
					"Primary CVM response did not include encrypted_env_pubkey. Use manual encrypted_env/env_keys mode.",
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
		if strings.TrimSpace(envComposeHash) != "" {
			envReq["compose_hash"] = envComposeHash
		}
		if strings.TrimSpace(envTransactionHash) != "" {
			envReq["transaction_hash"] = envTransactionHash
		}

		if err := r.patchJSONAcrossReplicas(ctx, cvms, primaryCVMID, "/envs", envReq); err != nil {
			if apiErr, ok := err.(*APIError); ok && apiErr.StatusCode == 465 {
				resp.Diagnostics.AddError(
					"Encrypted env update requires on-chain verification",
					"API returned HTTP 465 (compose hash registration required). Register compose_hash on-chain and retry with env_compose_hash and env_transaction_hash.",
				)
				return
			}
			resp.Diagnostics.AddError("Failed to update app encrypted env", err.Error())
			return
		}
	}

	if err := r.reconcileReplicas(ctx, appID, desiredReplicas, "", waitTimeout(plan.WaitTimeoutSecond)); err != nil {
		resp.Diagnostics.AddError("Failed to reconcile app replicas", err.Error())
		return
	}

	if shouldWait(plan.WaitForReady) {
		if err := r.waitForAppReady(ctx, appID, desiredReplicas, waitTimeout(plan.WaitTimeoutSecond)); err != nil {
			resp.Diagnostics.AddError("App did not become ready", err.Error())
			return
		}
	}

	app, cvms, err := r.fetchAppAndCVMs(ctx, appID)
	if err != nil {
		resp.Diagnostics.AddError("Failed to read app after update", err.Error())
		return
	}
	resp.Diagnostics.Append(r.populateState(ctx, &plan, app, cvms)...)
	if resp.Diagnostics.HasError() {
		return
	}

	if !shouldWait(plan.WaitForReady) {
		plan.Status = state.Status
		if imageChanged {
			plan.Image = desiredImage
		}
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, plan)...)
}

func (r *appResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state appResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	appID := appIDFromState(state)
	if appID == "" {
		return
	}

	cvms, err := r.fetchAppCVMs(ctx, appID)
	if err != nil && !isNotFound(err) {
		resp.Diagnostics.AddWarning("Delete fallback", fmt.Sprintf("Failed to list app CVMs before delete: %v", err))
	}
	for _, cvm := range cvms {
		identifier := selectReplicaIdentifier(cvm)
		if identifier == "" {
			continue
		}
		if err := r.client.Delete(ctx, cvmPath(identifier)); err != nil && !isNotFound(err) {
			resp.Diagnostics.AddError("Failed to delete app replica", err.Error())
			return
		}
	}

	deadline := time.Now().Add(120 * time.Second)
	for time.Now().Before(deadline) {
		refreshed, err := r.fetchAppCVMs(ctx, appID)
		if err != nil {
			if isNotFound(err) {
				return
			}
			if !isRetryable(err) {
				resp.Diagnostics.AddWarning("Delete verification skipped", err.Error())
				return
			}
		}
		if len(refreshed) == 0 {
			return
		}
		select {
		case <-ctx.Done():
			resp.Diagnostics.AddWarning("Delete wait interrupted", ctx.Err().Error())
			return
		case <-time.After(2 * time.Second):
		}
	}

	resp.Diagnostics.AddWarning(
		"App deletion not fully confirmed",
		"Delete requests succeeded but final empty-replica confirmation timed out.",
	)
}

func (r *appResource) ImportState(
	ctx context.Context,
	req resource.ImportStateRequest,
	resp *resource.ImportStateResponse,
) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}

func (r *appResource) fetchAppAndCVMs(ctx context.Context, appID string) (*appAPIResponse, []cvmAPIResponse, error) {
	app := &appAPIResponse{}
	if err := r.client.GetJSON(ctx, appPath(appID), app); err != nil {
		return nil, nil, err
	}
	if strings.TrimSpace(app.AppID) == "" {
		app.AppID = ensureAppPrefix(appID)
	}
	cvms := normalizeCVMInfos(app.CVMs)
	if len(cvms) == 0 {
		listed, err := r.fetchAppCVMs(ctx, app.AppID)
		if err == nil {
			cvms = listed
		}
	}
	return app, cvms, nil
}

func (r *appResource) fetchAppCVMs(ctx context.Context, appID string) ([]cvmAPIResponse, error) {
	var rawItems []map[string]any
	if err := r.client.GetJSON(ctx, appPath(appID)+"/cvms", &rawItems); err != nil {
		return nil, err
	}
	items := make([]cvmAPIResponse, 0, len(rawItems))
	for _, raw := range rawItems {
		items = append(items, normalizeCVMFromAny(raw))
	}
	return normalizeCVMInfos(items), nil
}

func (r *appResource) fetchCVM(ctx context.Context, id string) (*cvmAPIResponse, error) {
	var out cvmAPIResponse
	if err := r.client.GetJSON(ctx, cvmPath(id), &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r *appResource) reconcileReplicas(
	ctx context.Context,
	appID string,
	desired int,
	preferredSourceVMUUID string,
	timeout time.Duration,
) error {
	if desired < 1 {
		return fmt.Errorf("replicas must be >= 1")
	}

	cvms, err := r.fetchAppCVMs(ctx, appID)
	if err != nil {
		return err
	}

	deadline := time.Now().Add(timeout)
	if len(cvms) == 0 {
		if strings.TrimSpace(preferredSourceVMUUID) != "" {
			// Freshly created apps may not immediately show CVMs in list endpoint.
			cvms = append(cvms, cvmAPIResponse{
				VMUUID: strings.TrimSpace(preferredSourceVMUUID),
				Status: "starting",
			})
		} else {
			for time.Now().Before(deadline) {
				cvms, err = r.fetchAppCVMs(ctx, appID)
				if err != nil {
					if isRetryable(err) || isNotFound(err) {
						select {
						case <-ctx.Done():
							return ctx.Err()
						case <-time.After(2 * time.Second):
							continue
						}
					}
					return err
				}
				if len(cvms) > 0 {
					break
				}
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(2 * time.Second):
				}
			}
			if len(cvms) == 0 {
				return fmt.Errorf("app %q has no source CVM to scale", appID)
			}
		}
	}

	for len(cvms) < desired {
		if time.Now().After(deadline) {
			return fmt.Errorf("timeout waiting to scale app %q to %d replicas", appID, desired)
		}

		source := selectReplicaSource(cvms, preferredSourceVMUUID)
		if source == "" {
			return fmt.Errorf("unable to determine source vm_uuid for app replica creation")
		}

		replicatePath := appPath(appID) + "/cvms/" + url.PathEscape(source) + "/replicas"
		if err := r.client.PostJSON(ctx, replicatePath, map[string]any{}, nil); err != nil {
			return err
		}

		target := len(cvms) + 1
		if err := r.waitForReplicaCount(ctx, appID, target, deadline); err != nil {
			return err
		}
		cvms, err = r.fetchAppCVMs(ctx, appID)
		if err != nil {
			return err
		}
	}

	for len(cvms) > desired {
		if time.Now().After(deadline) {
			return fmt.Errorf("timeout waiting to scale app %q down to %d replicas", appID, desired)
		}

		removable := selectReplicaForRemoval(cvms, preferredSourceVMUUID)
		if removable == "" {
			return fmt.Errorf("unable to determine removable replica for app %q", appID)
		}

		if err := r.client.Delete(ctx, cvmPath(removable)); err != nil && !isNotFound(err) {
			return err
		}

		target := len(cvms) - 1
		if err := r.waitForReplicaCount(ctx, appID, target, deadline); err != nil {
			return err
		}
		cvms, err = r.fetchAppCVMs(ctx, appID)
		if err != nil {
			return err
		}
	}

	return nil
}

func (r *appResource) waitForReplicaCount(ctx context.Context, appID string, target int, deadline time.Time) error {
	for time.Now().Before(deadline) {
		cvms, err := r.fetchAppCVMs(ctx, appID)
		if err != nil {
			if isRetryable(err) || isNotFound(err) {
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(2 * time.Second):
					continue
				}
			}
			return err
		}
		if len(cvms) == target {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
	return fmt.Errorf("timeout waiting for app %q to reach %d replicas", appID, target)
}

func (r *appResource) waitForAppReady(ctx context.Context, appID string, replicas int, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		cvms, err := r.fetchAppCVMs(ctx, appID)
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

		if len(cvms) < replicas {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(3 * time.Second):
			}
			continue
		}

		allRunning := true
		for _, cvm := range cvms {
			if !strings.EqualFold(strings.TrimSpace(cvm.Status), "running") || cvm.inProgress() {
				allRunning = false
				break
			}
		}
		if allRunning {
			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(3 * time.Second):
		}
	}
	return fmt.Errorf("timeout after %s waiting for app %q replicas to become running", timeout, appID)
}

func (r *appResource) populateState(
	ctx context.Context,
	state *appResourceModel,
	app *appAPIResponse,
	cvms []cvmAPIResponse,
) diag.Diagnostics {
	var diags diag.Diagnostics

	// Ensure computed fields are always known after apply/read.
	state.DiskSize = types.Int64Null()
	state.Status = types.StringNull()
	state.Endpoint = types.StringNull()
	state.PrimaryCVMID = types.StringNull()
	emptyIDs, listDiags := types.ListValueFrom(ctx, types.StringType, []string{})
	diags.Append(listDiags...)
	if !diags.HasError() {
		state.CVMIDs = emptyIDs
	}

	appID := ensureAppPrefix(nonEmpty(app.AppID, stringFromRawJSON(app.ID), state.ID.ValueString()))
	if appID != "" {
		state.ID = types.StringValue(appID)
		state.AppID = types.StringValue(appID)
	}

	if app.Name != "" {
		state.Name = types.StringValue(app.Name)
	}

	primary := selectPrimaryCVM(cvms, "")
	if primary != nil {
		if v := primary.instanceType(); v != "" {
			state.Size = types.StringValue(v)
		}
		if primary.DiskSize != nil {
			state.DiskSize = types.Int64Value(*primary.DiskSize)
		}
		if primary.Resource != nil && primary.Resource.DiskInGB != nil {
			state.DiskSize = types.Int64Value(*primary.Resource.DiskInGB)
		}
		if region := primary.region(); region != "" {
			state.Region = types.StringValue(region)
		}
		if image := primary.osImageName(); image != "" {
			state.Image = types.StringValue(image)
		}
		state.Status = nullableString(primary.Status)
		state.Endpoint = nullableString(primary.endpoint())
		if primary.Listed != nil {
			state.Listed = types.BoolValue(*primary.Listed)
		}
		primaryID := selectReplicaIdentifier(*primary)
		if primaryID != "" {
			state.PrimaryCVMID = types.StringValue(primaryID)
			if state.DockerCompose.IsNull() || state.DockerCompose.IsUnknown() {
				compose, err := r.client.GetText(ctx, cvmPath(primaryID)+"/docker-compose.yml")
				if err == nil {
					state.DockerCompose = types.StringValue(normalizeTextBody(compose))
				}
			}
			preLaunchScript, err := r.client.GetText(ctx, cvmPath(primaryID)+"/pre-launch-script")
			if err == nil && !state.PreLaunchScript.IsNull() && !state.PreLaunchScript.IsUnknown() {
				state.PreLaunchScript = types.StringValue(normalizeTextBody(preLaunchScript))
			}
		}
	}

	replicaIDs := make([]string, 0, len(cvms))
	for _, cvm := range cvms {
		if id := selectReplicaIdentifier(cvm); id != "" {
			replicaIDs = append(replicaIDs, id)
		}
	}
	sort.Strings(replicaIDs)
	replicaCount := len(cvms)
	if replicaCount == 0 && !state.Replicas.IsNull() && !state.Replicas.IsUnknown() && state.Replicas.ValueInt64() > 0 {
		// Async create/update can temporarily return no replicas immediately after submit.
		replicaCount = int(state.Replicas.ValueInt64())
	}
	state.Replicas = types.Int64Value(int64(replicaCount))
	listValue, listDiags := types.ListValueFrom(ctx, types.StringType, replicaIDs)
	diags.Append(listDiags...)
	if !diags.HasError() {
		state.CVMIDs = listValue
	}

	return diags
}

func desiredReplicaCount(v types.Int64) (int, diag.Diagnostics) {
	var diags diag.Diagnostics
	if v.IsNull() {
		return 1, diags
	}
	if v.IsUnknown() {
		diags.AddError("Unknown replicas value", "replicas must be known at apply time.")
		return 0, diags
	}
	value := v.ValueInt64()
	if value < 1 {
		diags.AddError("Invalid replicas value", "replicas must be >= 1.")
		return 0, diags
	}
	return int(value), diags
}

func appIDFromState(state appResourceModel) string {
	if !state.AppID.IsNull() && !state.AppID.IsUnknown() && strings.TrimSpace(state.AppID.ValueString()) != "" {
		return ensureAppPrefix(state.AppID.ValueString())
	}
	if !state.ID.IsNull() && !state.ID.IsUnknown() && strings.TrimSpace(state.ID.ValueString()) != "" {
		return ensureAppPrefix(state.ID.ValueString())
	}
	return ""
}

func selectPrimaryIdentifier(planPrimary, statePrimary types.String, cvms []cvmAPIResponse) string {
	if !planPrimary.IsNull() && !planPrimary.IsUnknown() && strings.TrimSpace(planPrimary.ValueString()) != "" {
		return planPrimary.ValueString()
	}
	if !statePrimary.IsNull() && !statePrimary.IsUnknown() && strings.TrimSpace(statePrimary.ValueString()) != "" {
		return statePrimary.ValueString()
	}
	primary := selectPrimaryCVM(cvms, "")
	if primary == nil {
		return ""
	}
	return selectReplicaIdentifier(*primary)
}

func selectPrimaryCVM(cvms []cvmAPIResponse, preferredSourceVMUUID string) *cvmAPIResponse {
	if preferredSourceVMUUID != "" {
		for i := range cvms {
			if strings.EqualFold(strings.TrimSpace(cvms[i].VMUUID), strings.TrimSpace(preferredSourceVMUUID)) {
				return &cvms[i]
			}
		}
	}
	for i := range cvms {
		if strings.EqualFold(strings.TrimSpace(cvms[i].Status), "running") {
			return &cvms[i]
		}
	}
	if len(cvms) == 0 {
		return nil
	}
	return &cvms[0]
}

func selectReplicaIdentifier(cvm cvmAPIResponse) string {
	if strings.TrimSpace(cvm.VMUUID) != "" {
		return strings.TrimSpace(cvm.VMUUID)
	}
	if id := cvm.idString(); strings.TrimSpace(id) != "" {
		return strings.TrimSpace(id)
	}
	if strings.TrimSpace(cvm.InstanceID) != "" {
		return strings.TrimSpace(cvm.InstanceID)
	}
	return ""
}

func selectReplicaSource(cvms []cvmAPIResponse, preferredSourceVMUUID string) string {
	if preferredSourceVMUUID != "" {
		for _, cvm := range cvms {
			if strings.EqualFold(strings.TrimSpace(cvm.VMUUID), strings.TrimSpace(preferredSourceVMUUID)) {
				return strings.TrimSpace(cvm.VMUUID)
			}
		}
	}
	for _, cvm := range cvms {
		if strings.TrimSpace(cvm.VMUUID) != "" && strings.EqualFold(strings.TrimSpace(cvm.Status), "running") {
			return strings.TrimSpace(cvm.VMUUID)
		}
	}
	for _, cvm := range cvms {
		if strings.TrimSpace(cvm.VMUUID) != "" {
			return strings.TrimSpace(cvm.VMUUID)
		}
	}
	return ""
}

func selectReplicaForRemoval(cvms []cvmAPIResponse, preserveVMUUID string) string {
	for i := len(cvms) - 1; i >= 0; i-- {
		candidate := cvms[i]
		if preserveVMUUID != "" && strings.EqualFold(strings.TrimSpace(candidate.VMUUID), strings.TrimSpace(preserveVMUUID)) {
			continue
		}
		if id := selectReplicaIdentifier(candidate); id != "" {
			return id
		}
	}
	for i := len(cvms) - 1; i >= 0; i-- {
		if id := selectReplicaIdentifier(cvms[i]); id != "" {
			return id
		}
	}
	return ""
}

func orderedReplicaIDs(cvms []cvmAPIResponse, preferred string) []string {
	ids := make([]string, 0, len(cvms)+1)
	seen := map[string]struct{}{}
	add := func(id string) {
		trimmed := strings.TrimSpace(id)
		if trimmed == "" {
			return
		}
		if _, ok := seen[trimmed]; ok {
			return
		}
		seen[trimmed] = struct{}{}
		ids = append(ids, trimmed)
	}
	add(preferred)
	for _, cvm := range cvms {
		add(selectReplicaIdentifier(cvm))
	}
	return ids
}

func (r *appResource) patchTextAcrossReplicas(
	ctx context.Context,
	cvms []cvmAPIResponse,
	preferredID string,
	pathSuffix string,
	body string,
	headers map[string]string,
) error {
	ids := orderedReplicaIDs(cvms, preferredID)
	if len(ids) == 0 {
		return fmt.Errorf("no app replicas available for patch operation")
	}

	var lastErr error
	for i, id := range ids {
		err := r.client.PatchText(ctx, cvmPath(id)+pathSuffix, body, headers, nil)
		if err == nil {
			return nil
		}
		apiErr, ok := err.(*APIError)
		if ok && apiErr.StatusCode == http.StatusConflict && i < len(ids)-1 {
			lastErr = err
			continue
		}
		return err
	}

	if lastErr != nil {
		return lastErr
	}
	return fmt.Errorf("patch operation failed on all app replicas")
}

func (r *appResource) patchJSONAcrossReplicas(
	ctx context.Context,
	cvms []cvmAPIResponse,
	preferredID string,
	pathSuffix string,
	payload any,
) error {
	ids := orderedReplicaIDs(cvms, preferredID)
	if len(ids) == 0 {
		return fmt.Errorf("no app replicas available for patch operation")
	}

	var lastErr error
	for i, id := range ids {
		err := r.client.PatchJSON(ctx, cvmPath(id)+pathSuffix, payload, nil)
		if err == nil {
			return nil
		}
		apiErr, ok := err.(*APIError)
		if ok && apiErr.StatusCode == http.StatusConflict && i < len(ids)-1 {
			lastErr = err
			continue
		}
		return err
	}

	if lastErr != nil {
		return lastErr
	}
	return fmt.Errorf("patch operation failed on all app replicas")
}

func (r *appResource) patchOSImageAcrossReplicas(
	ctx context.Context,
	cvms []cvmAPIResponse,
	preferredID string,
	imageName string,
) error {
	ids := orderedReplicaIDs(cvms, preferredID)
	if len(ids) == 0 {
		return fmt.Errorf("no app replicas available for OS image update")
	}

	payload := map[string]any{
		"os_image_name": imageName,
	}

	for _, id := range ids {
		if err := r.client.PatchJSON(ctx, cvmPath(id)+"/os-image", payload, nil); err != nil {
			return fmt.Errorf("replica %q OS image update failed: %w", id, err)
		}
	}

	return nil
}

func normalizeCVMInfos(cvms []cvmAPIResponse) []cvmAPIResponse {
	out := make([]cvmAPIResponse, 0, len(cvms))
	for _, cvm := range cvms {
		if strings.TrimSpace(cvm.AppID) == "" &&
			strings.TrimSpace(cvm.VMUUID) == "" &&
			strings.TrimSpace(cvm.Name) == "" &&
			strings.TrimSpace(cvm.Status) == "" &&
			len(cvm.ID) == 0 {
			continue
		}
		out = append(out, cvm)
	}
	return out
}

func normalizeCVMFromAny(raw map[string]any) cvmAPIResponse {
	out := cvmAPIResponse{
		Name:       stringFromAny(raw["name"]),
		Status:     stringFromAny(raw["status"]),
		AppID:      ensureAppPrefix(stringFromAny(raw["app_id"])),
		VMUUID:     stringFromAny(raw["vm_uuid"]),
		InstanceID: stringFromAny(raw["instance_id"]),
	}
	if osRaw, ok := raw["os"].(map[string]any); ok {
		if name := stringFromAny(osRaw["name"]); name != "" {
			out.OS = &struct {
				Name string `json:"name"`
			}{Name: name}
		}
	}
	if b, ok := boolFromAny(raw["in_progress"]); ok {
		out.InProgress = b
	}
	if b, ok := boolFromAny(raw["listed"]); ok {
		out.Listed = &b
	}
	if idJSON, err := marshalJSONRaw(raw["id"]); err == nil && len(idJSON) > 0 {
		out.ID = idJSON
	}

	if hostedRaw, ok := raw["hosted"].(map[string]any); ok {
		if out.Name == "" {
			out.Name = stringFromAny(hostedRaw["name"])
		}
		if out.Status == "" {
			out.Status = stringFromAny(hostedRaw["status"])
		}
		if out.AppID == "" {
			out.AppID = ensureAppPrefix(stringFromAny(hostedRaw["app_id"]))
		}
		if out.InstanceID == "" {
			out.InstanceID = stringFromAny(hostedRaw["instance_id"])
		}
		if out.VMUUID == "" {
			out.VMUUID = stringFromAny(hostedRaw["id"])
		}
		if len(out.ID) == 0 {
			if idJSON, err := marshalJSONRaw(hostedRaw["id"]); err == nil && len(idJSON) > 0 {
				out.ID = idJSON
			}
		}
		if appURL := stringFromAny(hostedRaw["app_url"]); appURL != "" {
			out.Endpoints = append(out.Endpoints, struct {
				App string `json:"app"`
			}{App: appURL})
		}
	}

	if publicURLs, ok := raw["public_urls"].([]any); ok {
		out.PublicURLs = make([]struct {
			App string `json:"app"`
		}, 0, len(publicURLs))
		for _, item := range publicURLs {
			if obj, ok := item.(map[string]any); ok {
				if app := stringFromAny(obj["app"]); app != "" {
					out.PublicURLs = append(out.PublicURLs, struct {
						App string `json:"app"`
					}{App: app})
				}
			}
		}
	}

	if nodeInfo, ok := raw["node_info"].(map[string]any); ok {
		region := stringFromAny(nodeInfo["region"])
		if region != "" {
			out.NodeInfo = &struct {
				Region string `json:"region"`
			}{Region: region}
		}
	}

	return out
}

func appPath(id string) string {
	trimmed := strings.TrimSpace(id)
	if strings.HasPrefix(trimmed, "app_") {
		trimmed = strings.TrimPrefix(trimmed, "app_")
	}
	return "/apps/" + url.PathEscape(trimmed)
}

func stringFromRawJSON(v json.RawMessage) string {
	if len(v) == 0 {
		return ""
	}
	var s string
	if err := json.Unmarshal(v, &s); err == nil {
		return strings.TrimSpace(s)
	}
	return ""
}

func stringFromAny(v any) string {
	switch t := v.(type) {
	case string:
		return strings.TrimSpace(t)
	case fmt.Stringer:
		return strings.TrimSpace(t.String())
	default:
		return ""
	}
}

func boolFromAny(v any) (bool, bool) {
	switch t := v.(type) {
	case bool:
		return t, true
	default:
		return false, false
	}
}

func marshalJSONRaw(v any) (json.RawMessage, error) {
	if v == nil {
		return nil, nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(b), nil
}
