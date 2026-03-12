package provider

import (
	"context"
	"net/url"
	"strings"

	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

var _ resource.Resource = &sshKeyResource{}
var _ resource.ResourceWithImportState = &sshKeyResource{}

type sshKeyResource struct {
	client *APIClient
}

type sshKeyResourceModel struct {
	ID          types.String `tfsdk:"id"`
	Name        types.String `tfsdk:"name"`
	PublicKey   types.String `tfsdk:"public_key"`
	Fingerprint types.String `tfsdk:"fingerprint"`
	KeyType     types.String `tfsdk:"key_type"`
	Source      types.String `tfsdk:"source"`
	CreatedAt   types.String `tfsdk:"created_at"`
	UpdatedAt   types.String `tfsdk:"updated_at"`
}

type sshKeyAPI struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	PublicKey   string `json:"public_key"`
	Fingerprint string `json:"fingerprint"`
	KeyType     string `json:"key_type"`
	Source      string `json:"source"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

func NewSSHKeyResource() resource.Resource {
	return &sshKeyResource{}
}

func (r *sshKeyResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_ssh_key"
}

func (r *sshKeyResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "Manages a Phala Cloud SSH key.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "SSH key identifier.",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				Required:            true,
				MarkdownDescription: "Name of the SSH key.",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"public_key": schema.StringAttribute{
				Required:            true,
				MarkdownDescription: "SSH public key content.",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"fingerprint": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Computed key fingerprint.",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"key_type": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Key type (e.g. ssh-ed25519, ssh-rsa).",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"source": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Key source metadata reported by API.",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"created_at": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Creation timestamp.",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"updated_at": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Last update timestamp.",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
		},
	}
}

func (r *sshKeyResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}

	client, ok := req.ProviderData.(*APIClient)
	if !ok {
		resp.Diagnostics.AddError(
			"Unexpected provider data type",
			"Expected *APIClient while configuring ssh_key resource.",
		)
		return
	}

	r.client = client
}

func (r *sshKeyResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan sshKeyResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	payload := map[string]string{
		"name":       plan.Name.ValueString(),
		"public_key": plan.PublicKey.ValueString(),
	}

	var created sshKeyAPI
	if err := r.client.PostJSON(ctx, "/user/ssh-keys", payload, &created); err != nil {
		resp.Diagnostics.AddError("Failed to create SSH key", err.Error())
		return
	}

	state := plan
	state.mergeAPI(created)
	if state.ID.IsNull() || state.ID.IsUnknown() || state.ID.ValueString() == "" {
		resp.Diagnostics.AddError("Invalid create response", "Created SSH key response did not include id.")
		return
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}

func (r *sshKeyResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state sshKeyResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}
	if state.ID.IsNull() || state.ID.IsUnknown() {
		return
	}

	key, err := r.findSSHKey(ctx, state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Failed to read SSH key", err.Error())
		return
	}
	if key == nil {
		resp.State.RemoveResource(ctx)
		return
	}

	state.mergeAPI(*key)
	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}

func (r *sshKeyResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan sshKeyResourceModel
	var state sshKeyResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	key, err := r.findSSHKey(ctx, state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Failed to refresh SSH key", err.Error())
		return
	}
	if key == nil {
		resp.State.RemoveResource(ctx)
		return
	}

	plan.ID = state.ID
	plan.mergeAPI(*key)
	resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *sshKeyResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state sshKeyResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	id := strings.TrimSpace(state.ID.ValueString())
	if id == "" {
		return
	}

	if err := r.client.Delete(ctx, "/user/ssh-keys/"+url.PathEscape(id)); err != nil && !isNotFound(err) {
		resp.Diagnostics.AddError("Failed to delete SSH key", err.Error())
	}
}

func (r *sshKeyResource) ImportState(
	ctx context.Context,
	req resource.ImportStateRequest,
	resp *resource.ImportStateResponse,
) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}

// findSSHKey fetches all SSH keys and scans for the given id.
// The Phala Cloud API does not expose a GET /user/ssh-keys/{id} endpoint,
// so a list-and-filter is the only option.
func (r *sshKeyResource) findSSHKey(ctx context.Context, id string) (*sshKeyAPI, error) {
	var keys []sshKeyAPI
	if err := r.client.GetJSON(ctx, "/user/ssh-keys", &keys); err != nil {
		return nil, err
	}

	for i := range keys {
		if keys[i].ID == id {
			return &keys[i], nil
		}
	}
	return nil, nil
}

func (m *sshKeyResourceModel) mergeAPI(api sshKeyAPI) {
	if v := strings.TrimSpace(api.ID); v != "" {
		m.ID = types.StringValue(v)
	}
	if v := strings.TrimSpace(api.Name); v != "" {
		m.Name = types.StringValue(v)
	}
	if v := strings.TrimSpace(api.PublicKey); v != "" {
		m.PublicKey = types.StringValue(v)
	}
	m.Fingerprint = nullableString(api.Fingerprint)
	m.KeyType = nullableString(api.KeyType)
	m.Source = nullableString(api.Source)
	m.CreatedAt = nullableString(api.CreatedAt)
	m.UpdatedAt = nullableString(api.UpdatedAt)
}
