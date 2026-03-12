package provider

import (
	"context"
	"strings"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/datasource/schema"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

var _ datasource.DataSource = &workspaceDataSource{}

type workspaceDataSource struct {
	client *APIClient
}

type workspaceDataSourceModel struct {
	ID types.String `tfsdk:"id"`

	Name   types.String `tfsdk:"name"`
	Slug   types.String `tfsdk:"slug"`
	Tier   types.String `tfsdk:"tier"`
	Role   types.String `tfsdk:"role"`
	Avatar types.String `tfsdk:"avatar"`
}

func NewWorkspaceDataSource() datasource.DataSource {
	return &workspaceDataSource{}
}

func (d *workspaceDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_workspace"
}

func (d *workspaceDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "Returns the active workspace info for the current API key.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Workspace ID.",
			},
			"name": schema.StringAttribute{
				Computed: true,
			},
			"slug": schema.StringAttribute{
				Computed: true,
			},
			"tier": schema.StringAttribute{
				Computed: true,
			},
			"role": schema.StringAttribute{
				Computed: true,
			},
			"avatar": schema.StringAttribute{
				Computed: true,
			},
		},
	}
}

func (d *workspaceDataSource) Configure(_ context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}

	client, ok := req.ProviderData.(*APIClient)
	if !ok {
		resp.Diagnostics.AddError(
			"Unexpected provider data type",
			"Expected *APIClient while configuring workspace data source.",
		)
		return
	}

	d.client = client
}

func (d *workspaceDataSource) Read(ctx context.Context, _ datasource.ReadRequest, resp *datasource.ReadResponse) {
	me, err := fetchAuthMe(ctx, d.client)
	if err != nil {
		resp.Diagnostics.AddError("Failed to read workspace info", err.Error())
		return
	}

	// Prefer workspace ID (immutable) for a stable data source identity.
	// Fall back to "current" if the API doesn't return one.
	wsID := strings.TrimSpace(me.Workspace.ID)
	if wsID == "" {
		wsID = "current"
	}

	state := workspaceDataSourceModel{
		ID:     types.StringValue(wsID),
		Name:   nullableString(me.Workspace.Name),
		Slug:   nullableString(me.Workspace.Slug),
		Tier:   nullableString(me.Workspace.Tier),
		Role:   nullableString(me.Workspace.Role),
		Avatar: nullableStringPtr(me.Workspace.Avatar),
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}
