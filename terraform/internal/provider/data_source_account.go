package provider

import (
	"context"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/datasource/schema"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

var _ datasource.DataSource = &accountDataSource{}

type accountDataSource struct {
	client *APIClient
}

type accountDataSourceModel struct {
	ID types.String `tfsdk:"id"`

	Username types.String `tfsdk:"username"`
	Email    types.String `tfsdk:"email"`
	Role     types.String `tfsdk:"role"`
	Avatar   types.String `tfsdk:"avatar"`

	EmailVerified  types.Bool `tfsdk:"email_verified"`
	TotpEnabled    types.Bool `tfsdk:"totp_enabled"`
	HasBackupCodes types.Bool `tfsdk:"has_backup_codes"`
	HasPassword    types.Bool `tfsdk:"has_password"`

	WorkspaceID   types.String `tfsdk:"workspace_id"`
	WorkspaceName types.String `tfsdk:"workspace_name"`
	WorkspaceSlug types.String `tfsdk:"workspace_slug"`
	WorkspaceTier types.String `tfsdk:"workspace_tier"`
	WorkspaceRole types.String `tfsdk:"workspace_role"`

	CreditBalance           types.String `tfsdk:"credit_balance"`
	CreditGrantedBalance    types.String `tfsdk:"credit_granted_balance"`
	CreditIsPostPaid        types.Bool   `tfsdk:"credit_is_post_paid"`
	CreditOutstandingAmount types.String `tfsdk:"credit_outstanding_amount"`
}

func NewAccountDataSource() datasource.DataSource {
	return &accountDataSource{}
}

func (d *accountDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_account"
}

func (d *accountDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "Returns current account info (user profile + credits + active workspace linkage).",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Stable account identifier for this data source state.",
			},
			"username": schema.StringAttribute{
				Computed: true,
			},
			"email": schema.StringAttribute{
				Computed: true,
			},
			"role": schema.StringAttribute{
				Computed: true,
			},
			"avatar": schema.StringAttribute{
				Computed: true,
			},
			"email_verified": schema.BoolAttribute{
				Computed: true,
			},
			"totp_enabled": schema.BoolAttribute{
				Computed: true,
			},
			"has_backup_codes": schema.BoolAttribute{
				Computed: true,
			},
			"has_password": schema.BoolAttribute{
				Computed: true,
			},
			"workspace_id": schema.StringAttribute{
				Computed: true,
			},
			"workspace_name": schema.StringAttribute{
				Computed: true,
			},
			"workspace_slug": schema.StringAttribute{
				Computed: true,
			},
			"workspace_tier": schema.StringAttribute{
				Computed: true,
			},
			"workspace_role": schema.StringAttribute{
				Computed: true,
			},
			"credit_balance": schema.StringAttribute{
				Computed: true,
			},
			"credit_granted_balance": schema.StringAttribute{
				Computed: true,
			},
			"credit_is_post_paid": schema.BoolAttribute{
				Computed: true,
			},
			"credit_outstanding_amount": schema.StringAttribute{
				Computed: true,
			},
		},
	}
}

func (d *accountDataSource) Configure(_ context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}

	client, ok := req.ProviderData.(*APIClient)
	if !ok {
		resp.Diagnostics.AddError(
			"Unexpected provider data type",
			"Expected *APIClient while configuring account data source.",
		)
		return
	}

	d.client = client
}

func (d *accountDataSource) Read(ctx context.Context, _ datasource.ReadRequest, resp *datasource.ReadResponse) {
	me, err := fetchAuthMe(ctx, d.client)
	if err != nil {
		resp.Diagnostics.AddError("Failed to read account info", err.Error())
		return
	}

	// Use a stable identifier that won't change when the user updates
	// their profile (email, username). "current" represents "whoever
	// the API key belongs to" — the same semantic every refresh.
	state := accountDataSourceModel{
		ID:       types.StringValue("current"),
		Username: nullableString(me.User.Username),
		Email:    nullableString(me.User.Email),
		Role:     nullableString(me.User.Role),
		Avatar:   nullableStringPtr(me.User.Avatar),

		EmailVerified:  nullableBool(me.User.EmailVerified),
		TotpEnabled:    nullableBool(me.User.TotpEnabled),
		HasBackupCodes: nullableBool(me.User.HasBackupCodes),
		HasPassword:    nullableBool(me.User.FlagHasPassword),

		WorkspaceID:   nullableString(me.Workspace.ID),
		WorkspaceName: nullableString(me.Workspace.Name),
		WorkspaceSlug: nullableString(me.Workspace.Slug),
		WorkspaceTier: nullableString(me.Workspace.Tier),
		WorkspaceRole: nullableString(me.Workspace.Role),

		CreditBalance:           nullableString(me.Credits.Balance),
		CreditGrantedBalance:    nullableString(me.Credits.GrantedBalance),
		CreditIsPostPaid:        nullableBool(me.Credits.IsPostPaid),
		CreditOutstandingAmount: nullableStringPtr(me.Credits.OutstandingAmount),
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}
