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
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/int64default"
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
	KMS                types.String `tfsdk:"kms"`
	NodeID             types.Int64  `tfsdk:"node_id"`
	CustomAppID        types.String `tfsdk:"custom_app_id"`
	Nonce              types.Int64  `tfsdk:"nonce"`
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

type appFetchResult struct {
	App                *appAPIResponse
	CVMs               []cvmAPIResponse
	ReplicaListWarning error
}

func NewAppResource() resource.Resource {
	return &appResource{}
}

func (r *appResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_app"
}

func (r *appResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	attrs := sharedCVMSchemaAttrs()
	// App-specific overrides and additions.
	attrs["id"] = schema.StringAttribute{
		Computed:            true,
		MarkdownDescription: "Terraform ID (same as app_id).",
		PlanModifiers: []planmodifier.String{
			stringplanmodifier.UseStateForUnknown(),
		},
	}
	attrs["app_id"] = schema.StringAttribute{
		Computed:            true,
		MarkdownDescription: "Phala app identifier.",
		PlanModifiers: []planmodifier.String{
			stringplanmodifier.UseStateForUnknown(),
		},
	}
	attrs["replicas"] = schema.Int64Attribute{
		Optional:            true,
		Computed:            true,
		Default:             int64default.StaticInt64(1),
		MarkdownDescription: "Desired number of CVMs under this app.",
	}
	attrs["primary_cvm_id"] = schema.StringAttribute{
		Computed:            true,
		MarkdownDescription: "Primary CVM identifier used for app-level patch operations.",
		PlanModifiers: []planmodifier.String{
			stringplanmodifier.UseStateForUnknown(),
		},
	}
	attrs["cvm_ids"] = schema.ListAttribute{
		Computed:            true,
		ElementType:         types.StringType,
		MarkdownDescription: "Identifiers of CVMs currently attached to this app.",
	}
	resp.Schema = schema.Schema{
		MarkdownDescription: "Manages a Phala Cloud App (app_id + shared compose/env + replica count).",
		Attributes:          attrs,
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

	identity, diags := resolveProvisionIdentity(plan.KMS, plan.CustomAppID, plan.Nonce)
	resp.Diagnostics.Append(diags...)
	nodeID, hasNodeID, diags := knownOptionalInt64(plan.NodeID, "node_id")
	resp.Diagnostics.Append(diags...)
	if hasNodeID && nodeID <= 0 {
		resp.Diagnostics.AddError("Invalid node_id", "node_id must be greater than 0.")
	}
	if resp.Diagnostics.HasError() {
		return
	}

	replicas, diags := desiredReplicaCount(plan.Replicas)
	resp.Diagnostics.Append(diags...)
	sshAuthorizedKeys, diags := listValueAsStrings(ctx, plan.SSHAuthorizedKeys, "ssh_authorized_keys")
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	envCfg, envDiags := parseEnvConfig(ctx, plan.Env, plan.EncryptedEnv, plan.EnvKeys, plan.EnvComposeHash, plan.EnvTransactionHash, true)
	resp.Diagnostics.Append(envDiags...)
	if resp.Diagnostics.HasError() {
		return
	}

	composeFile := buildComposeFile(composeFileFields{
		Name:            plan.Name.ValueString(),
		DockerCompose:   plan.DockerCompose.ValueString(),
		PreLaunchScript: plan.PreLaunchScript,
		PublicLogs:      plan.PublicLogs,
		PublicSysinfo:   plan.PublicSysinfo,
		PublicTCBInfo:   plan.PublicTCBInfo,
		GatewayEnabled:  plan.GatewayEnabled,
		SecureTime:      plan.SecureTime,
		StorageFS:       plan.StorageFS,
		EnvKeys:         envCfg.EffectiveEnvKeys,
		HasEnvKeys:      len(envCfg.EffectiveEnvKeys) > 0,
	})

	provReq, err := buildProvisionReq(provisionFields{
		Name:              plan.Name.ValueString(),
		Size:              plan.Size.ValueString(),
		ComposeFile:       composeFile,
		KMS:               identity.KMSType,
		Listed:            plan.Listed.ValueBool(),
		Region:            plan.Region,
		NodeID:            nodeID,
		HasNodeID:         hasNodeID,
		Image:             plan.Image,
		CustomAppID:       identity.CustomAppID,
		HasCustomAppID:    identity.HasCustomAppID,
		Nonce:             identity.Nonce,
		HasNonce:          identity.HasNonce,
		DiskSize:          plan.DiskSize,
		SSHAuthorizedKeys: sshAuthorizedKeys,
	})
	if err != nil {
		resp.Diagnostics.AddError("Invalid provision parameters", err.Error())
		return
	}

	var provResp provisionResponse
	if err := r.client.PostJSON(ctx, "/cvms/provision", provReq, &provResp); err != nil {
		resp.Diagnostics.AddError("Failed to provision app", err.Error())
		return
	}
	if provResp.ComposeHash == "" {
		resp.Diagnostics.AddError("Invalid provision response", "compose_hash was empty.")
		return
	}
	if strings.TrimSpace(provResp.AppID) == "" {
		resp.Diagnostics.AddError(
			"Unsupported KMS flow",
			"Provision did not return app_id. This usually means onchain KMS flow is required and is not yet supported by this provider.",
		)
		return
	}
	if envCfg.HasAutoEnv {
		if strings.TrimSpace(provResp.AppEnvEncryptPubkey) == "" {
			resp.Diagnostics.AddError(
				"Missing encryption public key",
				"Provision response did not include app_env_encrypt_pubkey required for env auto-encryption.",
			)
			return
		}
		if err := envCfg.encryptAutoEnv(provResp.AppEnvEncryptPubkey); err != nil {
			resp.Diagnostics.AddError("Failed to encrypt env", err.Error())
			return
		}
	}

	createResp, err := commitAndCreate(ctx, r.client, provResp, envCfg.EffectiveEncrypted, envCfg.HasEffectiveEncrypted, envCfg.EffectiveEnvKeys)
	if err != nil {
		resp.Diagnostics.AddError("Failed to create initial app CVM", err.Error())
		return
	}

	appID := ensureAppPrefix(nonEmpty(createResp.AppID, provResp.AppID))
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

	fetched, err := r.fetchAppAndCVMs(ctx, appID)
	if err != nil {
		resp.Diagnostics.AddError("Failed to read app after create", err.Error())
		return
	}
	appendReplicaListWarning(&resp.Diagnostics, fetched.ReplicaListWarning)
	resp.Diagnostics.Append(r.populateState(ctx, &plan, fetched.App, fetched.CVMs)...)
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

	fetched, err := r.fetchAppAndCVMs(ctx, appID)
	if err != nil {
		if isNotFound(err) {
			resp.State.RemoveResource(ctx)
			return
		}
		resp.Diagnostics.AddError("Failed to read app", err.Error())
		return
	}
	appendReplicaListWarning(&resp.Diagnostics, fetched.ReplicaListWarning)
	resp.Diagnostics.Append(r.populateState(ctx, &state, fetched.App, fetched.CVMs)...)
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
	plan.Image = inheritOptionalString(plan.Image, state.Image)
	plan.PublicLogs = inheritOptionalBool(plan.PublicLogs, state.PublicLogs)
	plan.PublicSysinfo = inheritOptionalBool(plan.PublicSysinfo, state.PublicSysinfo)
	plan.PublicTCBInfo = inheritOptionalBool(plan.PublicTCBInfo, state.PublicTCBInfo)
	plan.GatewayEnabled = inheritOptionalBool(plan.GatewayEnabled, state.GatewayEnabled)
	plan.SecureTime = inheritOptionalBool(plan.SecureTime, state.SecureTime)
	plan.StorageFS = inheritOptionalString(plan.StorageFS, state.StorageFS)

	desiredReplicas, diags := desiredReplicaCount(plan.Replicas)
	resp.Diagnostics.Append(diags...)

	desiredImage := plan.Image
	imageChanged := !plan.Image.Equal(state.Image)
	planSettings := composeSettingsValues{plan.PublicLogs, plan.PublicSysinfo, plan.PublicTCBInfo, plan.GatewayEnabled, plan.SecureTime}
	stateSettings := composeSettingsValues{state.PublicLogs, state.PublicSysinfo, state.PublicTCBInfo, state.GatewayEnabled, state.SecureTime}
	settingsChanged := planSettings.changed(stateSettings)

	diskSizeChanged, diskDiags := diskSizeValidation(plan.DiskSize, state.DiskSize)
	resp.Diagnostics.Append(diskDiags...)

	envCfg, envDiags := parseEnvConfig(ctx, plan.Env, plan.EncryptedEnv, plan.EnvKeys, plan.EnvComposeHash, plan.EnvTransactionHash, false)
	resp.Diagnostics.Append(envDiags...)
	if resp.Diagnostics.HasError() {
		return
	}

	desiredComposeEnvKeys, desiredComposeEnvKeysKnown, envKeyDiags := composeEnvKeysFromAttrs(ctx, plan.Env, plan.EnvKeys)
	resp.Diagnostics.Append(envKeyDiags...)
	currentComposeEnvKeys, currentComposeEnvKeysKnown, envKeyDiags := composeEnvKeysFromAttrs(ctx, state.Env, state.EnvKeys)
	resp.Diagnostics.Append(envKeyDiags...)
	if resp.Diagnostics.HasError() {
		return
	}
	composeEnvKeys := currentComposeEnvKeys
	composeHasEnvKeys := currentComposeEnvKeysKnown
	if desiredComposeEnvKeysKnown {
		composeEnvKeys = desiredComposeEnvKeys
		composeHasEnvKeys = true
	}
	updateComposeEnvKeys := desiredComposeEnvKeysKnown && !equalStringSlices(desiredComposeEnvKeys, currentComposeEnvKeys)

	cvms, err := r.fetchAppCVMs(ctx, appID)
	if err != nil {
		resp.Diagnostics.AddError("Failed to fetch current app replicas", err.Error())
		return
	}
	primaryCVMID := selectPrimaryIdentifier(plan.PrimaryCVMID, state.PrimaryCVMID, cvms)
	if primaryCVMID == "" {
		resp.Diagnostics.AddError("No app replicas found", "App has no CVMs available for update operations.")
		return
	}

	if !plan.Size.Equal(state.Size) || diskSizeChanged {
		resourceReq := map[string]any{"allow_restart": true}
		if !plan.Size.Equal(state.Size) {
			resourceReq["instance_type"] = plan.Size.ValueString()
		}
		if diskSizeChanged {
			resourceReq["disk_size"] = plan.DiskSize.ValueInt64()
		}
		if err := r.client.PatchJSON(ctx, cvmPath(primaryCVMID)+"/resources", resourceReq, nil); err != nil {
			resp.Diagnostics.AddError("Failed to update app resources", err.Error())
			return
		}
	}

	if settingsChanged {
		composeReq := buildComposeFileUpdateRequest(composeFileFields{
			Name:            plan.Name.ValueString(),
			DockerCompose:   plan.DockerCompose.ValueString(),
			PreLaunchScript: plan.PreLaunchScript,
			PublicLogs:      plan.PublicLogs,
			PublicSysinfo:   plan.PublicSysinfo,
			PublicTCBInfo:   plan.PublicTCBInfo,
			GatewayEnabled:  plan.GatewayEnabled,
			SecureTime:      plan.SecureTime,
			StorageFS:       plan.StorageFS,
			EnvKeys:         composeEnvKeys,
			HasEnvKeys:      composeHasEnvKeys,
		}, updateComposeEnvKeys)
		if err := r.provisionAndApplyComposeSettingsAcrossReplicas(ctx, cvms, primaryCVMID, composeReq); err != nil {
			resp.Diagnostics.AddError("Failed to update app compose settings", err.Error())
			return
		}
	}

	if imageChanged {
		if plan.Image.IsNull() || plan.Image.IsUnknown() || strings.TrimSpace(plan.Image.ValueString()) == "" {
			resp.Diagnostics.AddError("Invalid image update", "image must be set to a target OS image name when updating.")
			return
		}
		if err := r.patchOSImageAcrossReplicas(ctx, cvms, primaryCVMID, plan.Image.ValueString()); err != nil {
			resp.Diagnostics.AddError("Failed to update app OS image", err.Error())
			return
		}
	}

	if !plan.DockerCompose.Equal(state.DockerCompose) {
		if err := r.patchTextAcrossReplicas(ctx, cvms, primaryCVMID, "/docker-compose", plan.DockerCompose.ValueString(), map[string]string{"Content-Type": "text/yaml"}); err != nil {
			resp.Diagnostics.AddError("Failed to update app docker compose", err.Error())
			return
		}
	}

	if !plan.PreLaunchScript.Equal(state.PreLaunchScript) {
		script := ""
		if !plan.PreLaunchScript.IsNull() && !plan.PreLaunchScript.IsUnknown() {
			script = plan.PreLaunchScript.ValueString()
		}
		if err := r.patchTextAcrossReplicas(ctx, cvms, primaryCVMID, "/pre-launch-script", script, map[string]string{"Content-Type": "text/plain"}); err != nil {
			resp.Diagnostics.AddError("Failed to update app pre-launch script", err.Error())
			return
		}
	}

	if !plan.Env.Equal(state.Env) ||
		!plan.EncryptedEnv.Equal(state.EncryptedEnv) ||
		!plan.EnvKeys.Equal(state.EnvKeys) ||
		!plan.EnvComposeHash.Equal(state.EnvComposeHash) ||
		!plan.EnvTransactionHash.Equal(state.EnvTransactionHash) {
		if envCfg.HasAutoEnv {
			current, err := r.fetchCVM(ctx, primaryCVMID)
			if err != nil {
				resp.Diagnostics.AddError("Failed to load app encryption key", err.Error())
				return
			}
			pubkey := current.envEncryptionPubkey()
			if pubkey == "" {
				resp.Diagnostics.AddError("Missing encryption public key", "Primary CVM response did not include encrypted_env_pubkey. Use manual encrypted_env/env_keys mode.")
				return
			}
			if err := envCfg.encryptAutoEnv(pubkey); err != nil {
				resp.Diagnostics.AddError("Failed to encrypt env", err.Error())
				return
			}
		}
		envReq, err := envCfg.buildEnvUpdateReq(plan.EnvKeys)
		if err != nil {
			resp.Diagnostics.AddError("Missing encrypted_env", err.Error())
			return
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

	fetched, err := r.fetchAppAndCVMs(ctx, appID)
	if err != nil {
		resp.Diagnostics.AddError("Failed to read app after update", err.Error())
		return
	}
	appendReplicaListWarning(&resp.Diagnostics, fetched.ReplicaListWarning)
	resp.Diagnostics.Append(r.populateState(ctx, &plan, fetched.App, fetched.CVMs)...)
	if resp.Diagnostics.HasError() {
		return
	}

	if !shouldWait(plan.WaitForReady) {
		plan.Status = state.Status
		if imageChanged {
			plan.Image = desiredImage
		}
		if settingsChanged {
			plan.PublicLogs = planSettings.PublicLogs
			plan.PublicSysinfo = planSettings.PublicSysinfo
			plan.PublicTCBInfo = planSettings.PublicTCBInfo
			plan.GatewayEnabled = planSettings.GatewayEnabled
			plan.SecureTime = planSettings.SecureTime
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
		resp.Diagnostics.AddError("Failed to list app CVMs before delete", fmt.Sprintf("Cannot safely delete app without knowing its CVMs: %v. Retry or delete manually.", err))
		return
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

	deleteTimeout := waitTimeout(state.WaitTimeoutSecond)
	deadline := time.Now().Add(deleteTimeout)
	for time.Now().Before(deadline) {
		refreshed, err := r.fetchAppCVMs(ctx, appID)
		if err != nil {
			if isNotFound(err) {
				return
			}
			if !isRetryable(err) {
				resp.Diagnostics.AddError("Delete verification failed", err.Error())
				return
			}
		}
		if len(refreshed) == 0 {
			return
		}
		select {
		case <-ctx.Done():
			resp.Diagnostics.AddError("Delete wait interrupted", ctx.Err().Error())
			return
		case <-time.After(pollInterval(2 * time.Second)):
		}
	}

	resp.Diagnostics.AddError(
		"App deletion not confirmed",
		fmt.Sprintf("Delete requests succeeded but app replicas still exist after %s. Resources may be orphaned — verify manually and run terraform import if needed.", deleteTimeout),
	)
}

func (r *appResource) ImportState(
	ctx context.Context,
	req resource.ImportStateRequest,
	resp *resource.ImportStateResponse,
) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}

func (r *appResource) fetchAppAndCVMs(ctx context.Context, appID string) (*appFetchResult, error) {
	app := &appAPIResponse{}
	if err := r.client.GetJSON(ctx, appPath(appID), app); err != nil {
		return nil, err
	}
	if strings.TrimSpace(app.AppID) == "" {
		app.AppID = ensureAppPrefix(appID)
	}
	cvms := normalizeCVMInfos(app.CVMs)
	var replicaListWarning error
	if len(cvms) == 0 {
		listed, err := r.fetchAppCVMs(ctx, app.AppID)
		if err != nil {
			if isRetryable(err) {
				replicaListWarning = err
			} else {
				return nil, err
			}
		} else {
			cvms = listed
		}
	}
	return &appFetchResult{
		App:                app,
		CVMs:               cvms,
		ReplicaListWarning: replicaListWarning,
	}, nil
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
						case <-time.After(pollInterval(2 * time.Second)):
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
				case <-time.After(pollInterval(2 * time.Second)):
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
				case <-time.After(pollInterval(2 * time.Second)):
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
		case <-time.After(pollInterval(2 * time.Second)):
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
				case <-time.After(pollInterval(3 * time.Second)):
					continue
				}
			}
			return err
		}

		if len(cvms) < replicas {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(pollInterval(3 * time.Second)):
			}
			continue
		}

		if failed, summary := stoppedReplicaFailure(cvms); failed {
			return fmt.Errorf("app %q failed to become ready: %s", appID, summary)
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
		case <-time.After(pollInterval(3 * time.Second)):
		}
	}
	return fmt.Errorf("timeout after %s waiting for app %q replicas to become running", timeout, appID)
}

func stoppedReplicaFailure(cvms []cvmAPIResponse) (bool, string) {
	failures := make([]string, 0, len(cvms))
	for _, cvm := range cvms {
		if stablePowerState(cvm.Status) != "stopped" || cvm.inProgress() {
			continue
		}
		failures = append(failures, describeReplicaState(cvm))
	}
	if len(failures) == 0 {
		return false, ""
	}
	sort.Strings(failures)
	return true, "replica entered terminal stopped state: " + strings.Join(failures, ", ")
}

func describeReplicaState(cvm cvmAPIResponse) string {
	id := strings.TrimSpace(cvm.VMUUID)
	if id == "" {
		id = strings.TrimSpace(cvm.InstanceID)
	}
	if id == "" {
		id = cvm.idString()
	}
	if id == "" {
		id = "<unknown>"
	}

	status := strings.TrimSpace(cvm.Status)
	if status == "" {
		status = "unknown"
	}

	if cvm.Progress != nil && strings.TrimSpace(cvm.Progress.Target) != "" {
		return fmt.Sprintf("%s(status=%s,target=%s)", id, status, strings.TrimSpace(cvm.Progress.Target))
	}
	return fmt.Sprintf("%s(status=%s)", id, status)
}

func (r *appResource) populateState(
	ctx context.Context,
	state *appResourceModel,
	app *appAPIResponse,
	cvms []cvmAPIResponse,
) diag.Diagnostics {
	var diags diag.Diagnostics

	if len(cvms) > 0 {
		// Reset computed replica-derived fields only when we have fresh CVM data.
		state.DiskSize = types.Int64Null()
		state.Status = types.StringNull()
		state.Endpoint = types.StringNull()
		state.PrimaryCVMID = types.StringNull()
		emptyIDs, listDiags := types.ListValueFrom(ctx, types.StringType, []string{})
		diags.Append(listDiags...)
		if !diags.HasError() {
			state.CVMIDs = emptyIDs
		}
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
		primaryID := selectReplicaIdentifier(*primary)
		if primaryID != "" && r.client != nil {
			if detailed, err := r.fetchCVM(ctx, primaryID); err == nil && detailed != nil {
				primary = detailed
			}
		}

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
		state.PublicLogs = nullableBool(primary.publicLogsValue())
		state.PublicSysinfo = nullableBool(primary.publicSysinfoValue())
		state.PublicTCBInfo = nullableBool(primary.publicTCBInfoValue())
		state.GatewayEnabled = nullableBool(primary.gatewayEnabledValue())
		state.SecureTime = nullableBool(primary.secureTimeValue())
		state.StorageFS = nullableString(primary.storageFSValue())
		state.Status = nullableString(primary.Status)
		state.Endpoint = nullableString(primary.endpoint())
		if primary.Listed != nil {
			state.Listed = types.BoolValue(*primary.Listed)
		}
		if primaryID != "" {
			state.PrimaryCVMID = types.StringValue(primaryID)
			if state.DockerCompose.IsNull() || state.DockerCompose.IsUnknown() {
				compose, err := r.client.GetText(ctx, cvmPath(primaryID)+"/docker-compose.yml")
				if err == nil {
					state.DockerCompose = types.StringValue(normalizeTextBody(compose))
				}
			}
			// The backend injects a default pre-launch script even when the user
			// did not set pre_launch_script. Keep null/unknown state null so an
			// optional unmanaged field does not become provider-managed drift.
			if !state.PreLaunchScript.IsNull() && !state.PreLaunchScript.IsUnknown() {
				preLaunchScript, err := r.client.GetText(ctx, cvmPath(primaryID)+"/pre-launch-script")
				if err == nil {
					state.PreLaunchScript = nullableString(normalizeTextBody(preLaunchScript))
				}
			}
		}
	}

	replicaIDs := make([]string, 0, len(cvms))
	for _, cvm := range cvms {
		if id := selectReplicaIdentifier(cvm); id != "" {
			replicaIDs = append(replicaIDs, id)
		}
	}
	if len(cvms) == 0 {
		if state.Replicas.IsNull() || state.Replicas.IsUnknown() || state.Replicas.ValueInt64() <= 0 {
			state.Replicas = types.Int64Value(0)
			emptyIDs, listDiags := types.ListValueFrom(ctx, types.StringType, []string{})
			diags.Append(listDiags...)
			if !diags.HasError() {
				state.CVMIDs = emptyIDs
			}
		}
		return diags
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

func appendReplicaListWarning(diags *diag.Diagnostics, err error) {
	if err == nil {
		return
	}

	diags.AddWarning(
		"App replica details temporarily unavailable",
		fmt.Sprintf("Using existing replica-derived state because listing app replicas failed: %v", err),
	)
}

func composeEnvKeysFromAttrs(ctx context.Context, env types.Map, envKeys types.List) ([]string, bool, diag.Diagnostics) {
	var diags diag.Diagnostics

	if !env.IsNull() && !env.IsUnknown() {
		envMap, mapDiags := mapValueAsStrings(ctx, env, "env")
		diags.Append(mapDiags...)
		if diags.HasError() {
			return nil, false, diags
		}
		return sortedEnvKeys(envMap), true, diags
	}

	if !envKeys.IsNull() && !envKeys.IsUnknown() {
		keys, listDiags := listValueAsStrings(ctx, envKeys, "env_keys")
		diags.Append(listDiags...)
		if diags.HasError() {
			return nil, false, diags
		}
		sort.Strings(keys)
		return keys, true, diags
	}

	return nil, false, diags
}

func equalStringSlices(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
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

	var lastErr error
	for i, id := range ids {
		err := r.client.PatchJSON(ctx, cvmPath(id)+"/os-image", payload, nil)
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
	return fmt.Errorf("OS image update failed on all app replicas")
}

func (r *appResource) provisionAndApplyComposeSettingsAcrossReplicas(
	ctx context.Context,
	cvms []cvmAPIResponse,
	preferredID string,
	provisionReq map[string]any,
) error {
	ids := orderedReplicaIDs(cvms, preferredID)
	if len(ids) == 0 {
		return fmt.Errorf("no app replicas available for compose settings update")
	}

	var lastErr error
	for i, id := range ids {
		err := provisionAndApplyComposeFileUpdate(ctx, r.client, id, provisionReq)
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
	return fmt.Errorf("compose settings update failed on all app replicas")
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
	b, err := json.Marshal(raw)
	if err != nil {
		return cvmAPIResponse{}
	}
	var out cvmAPIResponse
	if err := json.Unmarshal(b, &out); err != nil {
		return cvmAPIResponse{}
	}
	out.AppID = ensureAppPrefix(out.AppID)

	// The API sometimes nests CVM fields inside a "hosted" sub-object.
	// Unmarshal it separately and use as fallback for any empty top-level fields.
	hostedRaw, ok := raw["hosted"].(map[string]any)
	if !ok {
		return out
	}
	hb, err := json.Marshal(hostedRaw)
	if err != nil {
		return out
	}
	var hosted cvmAPIResponse
	if err := json.Unmarshal(hb, &hosted); err != nil {
		return out
	}

	if out.Name == "" {
		out.Name = hosted.Name
	}
	if out.Status == "" {
		out.Status = hosted.Status
	}
	if out.AppID == "" {
		out.AppID = ensureAppPrefix(hosted.AppID)
	}
	if out.InstanceID == "" {
		out.InstanceID = hosted.InstanceID
	}
	if out.VMUUID == "" {
		out.VMUUID = hosted.idString()
	}
	if out.BaseImage == "" {
		out.BaseImage = hosted.BaseImage
	}
	if out.StorageFS == "" {
		out.StorageFS = hosted.StorageFS
	}
	if out.PublicLogs == nil {
		out.PublicLogs = hosted.PublicLogs
	}
	if out.PublicSysinfo == nil {
		out.PublicSysinfo = hosted.PublicSysinfo
	}
	if out.PublicTCBInfo == nil {
		out.PublicTCBInfo = hosted.PublicTCBInfo
	}
	if out.GatewayEnabled == nil {
		out.GatewayEnabled = hosted.GatewayEnabled
	}
	if out.SecureTime == nil {
		out.SecureTime = hosted.SecureTime
	}
	if len(out.ID) == 0 {
		out.ID = hosted.ID
	}
	if appURL := stringFromAny(hostedRaw["app_url"]); appURL != "" && len(out.Endpoints) == 0 {
		out.Endpoints = append(out.Endpoints, struct {
			App string `json:"app"`
		}{App: appURL})
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
