package provider

import (
	"context"
	"sort"
	"strings"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/datasource/schema"
	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

var _ datasource.DataSource = &sizesDataSource{}

type sizesDataSource struct {
	client *APIClient
}

type sizesDataSourceModel struct {
	Family types.String        `tfsdk:"family"`
	Sizes  []sizeDataSourceRow `tfsdk:"sizes"`
}

type sizeDataSourceRow struct {
	Slug              types.String `tfsdk:"slug"`
	Name              types.String `tfsdk:"name"`
	Description       types.String `tfsdk:"description"`
	Family            types.String `tfsdk:"family"`
	VCPU              types.Int64  `tfsdk:"vcpu"`
	MemoryMB          types.Int64  `tfsdk:"memory_mb"`
	HourlyRate        types.String `tfsdk:"hourly_rate"`
	RequiresGPU       types.Bool   `tfsdk:"requires_gpu"`
	DefaultDiskSizeGB types.Int64  `tfsdk:"default_disk_size_gb"`
}

func NewSizesDataSource() datasource.DataSource {
	return &sizesDataSource{}
}

func (d *sizesDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_sizes"
}

func (d *sizesDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "Lists available CVM sizes (instance types), similar to DigitalOcean sizes.",
		Attributes: map[string]schema.Attribute{
			"family": schema.StringAttribute{
				Optional:            true,
				MarkdownDescription: "Optional instance family filter (for example: cpu, gpu, tdx).",
			},
			"sizes": schema.ListNestedAttribute{
				Computed:            true,
				MarkdownDescription: "Available instance sizes.",
				NestedObject: schema.NestedAttributeObject{
					Attributes: map[string]schema.Attribute{
						"slug":                 schema.StringAttribute{Computed: true},
						"name":                 schema.StringAttribute{Computed: true},
						"description":          schema.StringAttribute{Computed: true},
						"family":               schema.StringAttribute{Computed: true},
						"vcpu":                 schema.Int64Attribute{Computed: true},
						"memory_mb":            schema.Int64Attribute{Computed: true},
						"hourly_rate":          schema.StringAttribute{Computed: true},
						"requires_gpu":         schema.BoolAttribute{Computed: true},
						"default_disk_size_gb": schema.Int64Attribute{Computed: true},
					},
				},
			},
		},
	}
}

func (d *sizesDataSource) Configure(_ context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}

	client, ok := req.ProviderData.(*APIClient)
	if !ok {
		resp.Diagnostics.AddError(
			"Unexpected provider data type",
			"Expected *APIClient while configuring sizes data source.",
		)
		return
	}

	d.client = client
}

func (d *sizesDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {
	var config sizesDataSourceModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &config)...)
	if resp.Diagnostics.HasError() {
		return
	}

	if config.Family.IsUnknown() {
		resp.Diagnostics.AddAttributeError(
			path.Root("family"),
			"Unknown family filter",
			"Set family to a known value or remove the filter.",
		)
		return
	}

	var payload struct {
		Result []struct {
			Name  string `json:"name"`
			Items []struct {
				ID                string  `json:"id"`
				Name              string  `json:"name"`
				Description       string  `json:"description"`
				VCPU              float64 `json:"vcpu"`
				MemoryMB          float64 `json:"memory_mb"`
				HourlyRate        string  `json:"hourly_rate"`
				RequiresGPU       bool    `json:"requires_gpu"`
				DefaultDiskSizeGB float64 `json:"default_disk_size_gb"`
				Family            *string `json:"family"`
			} `json:"items"`
		} `json:"result"`
	}

	if err := d.client.GetJSON(ctx, "/instance-types", &payload); err != nil {
		resp.Diagnostics.AddError("Failed to list sizes", err.Error())
		return
	}

	familyFilter := strings.TrimSpace(stringFromTF(config.Family))
	rows := make([]sizeDataSourceRow, 0)
	for _, group := range payload.Result {
		for _, item := range group.Items {
			family := group.Name
			if item.Family != nil && strings.TrimSpace(*item.Family) != "" {
				family = strings.TrimSpace(*item.Family)
			}

			if familyFilter != "" && !strings.EqualFold(family, familyFilter) {
				continue
			}

			slug := strings.TrimSpace(item.ID)
			if slug == "" {
				slug = strings.TrimSpace(item.Name)
			}

			rows = append(rows, sizeDataSourceRow{
				Slug:              types.StringValue(slug),
				Name:              nullableString(item.Name),
				Description:       nullableString(item.Description),
				Family:            nullableString(family),
				VCPU:              types.Int64Value(int64(item.VCPU)),
				MemoryMB:          types.Int64Value(int64(item.MemoryMB)),
				HourlyRate:        nullableString(item.HourlyRate),
				RequiresGPU:       types.BoolValue(item.RequiresGPU),
				DefaultDiskSizeGB: types.Int64Value(int64(item.DefaultDiskSizeGB)),
			})
		}
	}

	sort.Slice(rows, func(i, j int) bool {
		left := rows[i].Slug.ValueString() + "/" + rows[i].Family.ValueString()
		right := rows[j].Slug.ValueString() + "/" + rows[j].Family.ValueString()
		return left < right
	})

	config.Sizes = rows
	resp.Diagnostics.Append(resp.State.Set(ctx, &config)...)
}
