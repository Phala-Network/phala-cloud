package provider

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/booldefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/int64default"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

var _ resource.Resource = &cvmPowerResource{}

type cvmPowerResource struct {
	client *APIClient
}

type cvmPowerResourceModel struct {
	ID                types.String `tfsdk:"id"`
	CVMID             types.String `tfsdk:"cvm_id"`
	State             types.String `tfsdk:"state"`
	WaitForState      types.Bool   `tfsdk:"wait_for_state"`
	WaitTimeoutSecond types.Int64  `tfsdk:"wait_timeout_seconds"`
	Status            types.String `tfsdk:"status"`
}

func NewCVMPowerResource() resource.Resource {
	return &cvmPowerResource{}
}

func (r *cvmPowerResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_cvm_power"
}

func (r *cvmPowerResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "Manages CVM power state (running/stopped).",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Power state resource ID (same as cvm_id).",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"cvm_id": schema.StringAttribute{
				Required:            true,
				MarkdownDescription: "Target CVM ID.",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"state": schema.StringAttribute{
				Required:            true,
				MarkdownDescription: "Desired power state: running or stopped.",
			},
			"wait_for_state": schema.BoolAttribute{
				Optional:            true,
				Computed:            true,
				Default:             booldefault.StaticBool(true),
				MarkdownDescription: "Wait until the target state is reached after start/stop.",
			},
			"wait_timeout_seconds": schema.Int64Attribute{
				Optional:            true,
				Computed:            true,
				Default:             int64default.StaticInt64(600),
				MarkdownDescription: "Timeout for wait_for_state.",
			},
			"status": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Current CVM status from API.",
			},
		},
	}
}

func (r *cvmPowerResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}

	client, ok := req.ProviderData.(*APIClient)
	if !ok {
		resp.Diagnostics.AddError(
			"Unexpected provider data type",
			"Expected *APIClient while configuring cvm_power resource.",
		)
		return
	}
	r.client = client
}

func (r *cvmPowerResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan cvmPowerResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	if !isValidDesiredPowerState(plan.State.ValueString()) {
		resp.Diagnostics.AddError(
			"Invalid state",
			`state must be exactly "running" or "stopped".`,
		)
		return
	}

	cvmID := strings.TrimSpace(plan.CVMID.ValueString())
	if cvmID == "" {
		resp.Diagnostics.AddError("Invalid cvm_id", "cvm_id cannot be empty.")
		return
	}
	plan.ID = types.StringValue(cvmID)

	current, err := r.ensureDesiredPowerState(ctx, cvmID, plan.State.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Failed to set CVM power state", err.Error())
		return
	}

	if shouldWait(plan.WaitForState) {
		if err := r.waitForPowerState(ctx, cvmID, plan.State.ValueString(), waitTimeout(plan.WaitTimeoutSecond)); err != nil {
			resp.Diagnostics.AddError("CVM did not reach desired power state", err.Error())
			return
		}
		current, err = r.fetchPowerTarget(ctx, cvmID)
		if err != nil {
			resp.Diagnostics.AddError("Failed to read CVM after power update", err.Error())
			return
		}
	}

	plan.Status = nullableString(current.Status)
	resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *cvmPowerResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state cvmPowerResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}
	if state.CVMID.IsNull() || state.CVMID.IsUnknown() {
		return
	}

	cvmID := strings.TrimSpace(state.CVMID.ValueString())
	if cvmID == "" {
		resp.State.RemoveResource(ctx)
		return
	}

	current, err := r.fetchPowerTarget(ctx, cvmID)
	if err != nil {
		if isNotFound(err) {
			resp.State.RemoveResource(ctx)
			return
		}
		resp.Diagnostics.AddError("Failed to read CVM power state", err.Error())
		return
	}

	state.ID = types.StringValue(cvmID)
	state.Status = nullableString(current.Status)
	if stable := stablePowerState(current.Status); stable != "" {
		state.State = types.StringValue(stable)
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}

func (r *cvmPowerResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan cvmPowerResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	if !isValidDesiredPowerState(plan.State.ValueString()) {
		resp.Diagnostics.AddError(
			"Invalid state",
			`state must be exactly "running" or "stopped".`,
		)
		return
	}

	cvmID := strings.TrimSpace(plan.CVMID.ValueString())
	if cvmID == "" {
		resp.Diagnostics.AddError("Invalid cvm_id", "cvm_id cannot be empty.")
		return
	}
	plan.ID = types.StringValue(cvmID)

	current, err := r.ensureDesiredPowerState(ctx, cvmID, plan.State.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Failed to set CVM power state", err.Error())
		return
	}

	if shouldWait(plan.WaitForState) {
		if err := r.waitForPowerState(ctx, cvmID, plan.State.ValueString(), waitTimeout(plan.WaitTimeoutSecond)); err != nil {
			resp.Diagnostics.AddError("CVM did not reach desired power state", err.Error())
			return
		}
		current, err = r.fetchPowerTarget(ctx, cvmID)
		if err != nil {
			resp.Diagnostics.AddError("Failed to read CVM after power update", err.Error())
			return
		}
	}

	plan.Status = nullableString(current.Status)
	resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *cvmPowerResource) Delete(_ context.Context, _ resource.DeleteRequest, _ *resource.DeleteResponse) {
	// Intentional no-op: removing this resource from state does not change CVM runtime.
}

func (r *cvmPowerResource) ensureDesiredPowerState(
	ctx context.Context,
	cvmID string,
	desired string,
) (*cvmAPIResponse, error) {
	current, err := r.fetchPowerTarget(ctx, cvmID)
	if err != nil {
		return nil, err
	}

	switch desired {
	case "running":
		if shouldStart(current.Status) {
			if err := r.client.PostJSON(ctx, cvmPath(cvmID)+"/start", map[string]any{"polling": "v1"}, nil); err != nil {
				return nil, err
			}
			return r.fetchPowerTarget(ctx, cvmID)
		}
	case "stopped":
		if shouldStop(current.Status) {
			if err := r.client.PostJSON(ctx, cvmPath(cvmID)+"/stop", map[string]any{"polling": "v1"}, nil); err != nil {
				return nil, err
			}
			return r.fetchPowerTarget(ctx, cvmID)
		}
	default:
		return nil, fmt.Errorf("unsupported desired power state %q", desired)
	}

	return current, nil
}

func (r *cvmPowerResource) fetchPowerTarget(ctx context.Context, id string) (*cvmAPIResponse, error) {
	var out cvmAPIResponse
	if err := r.client.GetJSON(ctx, cvmPath(id), &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r *cvmPowerResource) waitForPowerState(
	ctx context.Context,
	cvmID string,
	target string,
	timeout time.Duration,
) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		current, err := r.fetchPowerTarget(ctx, cvmID)
		if err != nil {
			if isRetryable(err) {
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(pollInterval(3 * time.Second)):
					continue
				}
			}
			return err
		}

		if stablePowerState(current.Status) == target && !current.inProgress() {
			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(pollInterval(3 * time.Second)):
		}
	}

	return fmt.Errorf("timeout after %s waiting for CVM %q to reach %q", timeout, cvmID, target)
}

func isValidDesiredPowerState(v string) bool {
	return v == "running" || v == "stopped"
}

func stablePowerState(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "running":
		return "running"
	case "stopped":
		return "stopped"
	default:
		return ""
	}
}

func shouldStart(status string) bool {
	lower := strings.ToLower(strings.TrimSpace(status))
	if lower == "running" || strings.HasPrefix(lower, "start") {
		return false
	}
	return true
}

func shouldStop(status string) bool {
	lower := strings.ToLower(strings.TrimSpace(status))
	if lower == "stopped" || strings.HasPrefix(lower, "stop") || strings.HasPrefix(lower, "shut") {
		return false
	}
	return true
}
