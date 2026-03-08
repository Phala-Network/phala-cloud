package provider

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/datasource/schema"
	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

var _ datasource.DataSource = &attestationDataSource{}

type attestationDataSource struct {
	client *APIClient
}

type attestationDataSourceModel struct {
	ID               types.String `tfsdk:"id"`
	CVMID            types.String `tfsdk:"cvm_id"`
	IsOnline         types.Bool   `tfsdk:"is_online"`
	IsPublic         types.Bool   `tfsdk:"is_public"`
	Error            types.String `tfsdk:"error"`
	ComposeFile      types.String `tfsdk:"compose_file"`
	TCBInfoJSON      types.String `tfsdk:"tcb_info_json"`
	CertificatesJSON types.String `tfsdk:"app_certificates_json"`
	RawJSON          types.String `tfsdk:"raw_json"`
}

type attestationAPIResponse struct {
	IsOnline        bool            `json:"is_online"`
	IsPublic        bool            `json:"is_public"`
	Error           *string         `json:"error"`
	AppCertificates json.RawMessage `json:"app_certificates"`
	TCBInfo         json.RawMessage `json:"tcb_info"`
	ComposeFile     *string         `json:"compose_file"`
}

func NewAttestationDataSource() datasource.DataSource {
	return &attestationDataSource{}
}

func (d *attestationDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_attestation"
}

func (d *attestationDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "Fetches CVM attestation data on demand.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Stable state ID (same as cvm_id).",
			},
			"cvm_id": schema.StringAttribute{
				Required:            true,
				MarkdownDescription: "CVM/App identifier used for attestation lookup.",
			},
			"is_online": schema.BoolAttribute{
				Computed: true,
			},
			"is_public": schema.BoolAttribute{
				Computed: true,
			},
			"error": schema.StringAttribute{
				Computed: true,
			},
			"compose_file": schema.StringAttribute{
				Computed: true,
			},
			"tcb_info_json": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Raw `tcb_info` object as JSON.",
			},
			"app_certificates_json": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Raw `app_certificates` array as JSON.",
			},
			"raw_json": schema.StringAttribute{
				Computed:            true,
				MarkdownDescription: "Full attestation response as JSON.",
			},
		},
	}
}

func (d *attestationDataSource) Configure(_ context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}

	client, ok := req.ProviderData.(*APIClient)
	if !ok {
		resp.Diagnostics.AddError(
			"Unexpected provider data type",
			"Expected *APIClient while configuring attestation data source.",
		)
		return
	}

	d.client = client
}

func (d *attestationDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {
	var config attestationDataSourceModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &config)...)
	if resp.Diagnostics.HasError() {
		return
	}

	if config.CVMID.IsUnknown() {
		resp.Diagnostics.AddAttributeError(
			path.Root("cvm_id"),
			"Unknown cvm_id",
			"cvm_id must be known at plan time.",
		)
		return
	}

	cvmID := strings.TrimSpace(config.CVMID.ValueString())
	if cvmID == "" {
		resp.Diagnostics.AddAttributeError(
			path.Root("cvm_id"),
			"Invalid cvm_id",
			"cvm_id cannot be empty.",
		)
		return
	}

	var payload attestationAPIResponse
	if err := d.client.GetJSON(ctx, cvmPath(cvmID)+"/attestation", &payload); err != nil {
		resp.Diagnostics.AddError("Failed to fetch attestation", err.Error())
		return
	}

	state := attestationDataSourceModel{
		ID:               types.StringValue(cvmID),
		CVMID:            types.StringValue(cvmID),
		IsOnline:         types.BoolValue(payload.IsOnline),
		IsPublic:         types.BoolValue(payload.IsPublic),
		Error:            nullableStringPtr(payload.Error),
		ComposeFile:      nullableStringPtr(payload.ComposeFile),
		TCBInfoJSON:      nullableJSON(payload.TCBInfo),
		CertificatesJSON: nullableJSON(payload.AppCertificates),
	}

	rawJSON, err := json.Marshal(payload)
	if err != nil {
		resp.Diagnostics.AddError("Failed to encode attestation response", err.Error())
		return
	}
	state.RawJSON = types.StringValue(string(rawJSON))

	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}

func nullableJSON(raw json.RawMessage) types.String {
	if len(raw) == 0 || string(raw) == "null" {
		return types.StringNull()
	}
	return types.StringValue(string(raw))
}
