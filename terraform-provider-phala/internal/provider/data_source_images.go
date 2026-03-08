package provider

import (
	"context"
	"sort"
	"strconv"
	"strings"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/datasource/schema"
	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

var _ datasource.DataSource = &imagesDataSource{}

type imagesDataSource struct {
	client *APIClient
}

type imagesDataSourceModel struct {
	Region types.String         `tfsdk:"region"`
	Images []imageDataSourceRow `tfsdk:"images"`
}

type imageDataSourceRow struct {
	Slug        types.String `tfsdk:"slug"`
	Name        types.String `tfsdk:"name"`
	Version     types.String `tfsdk:"version"`
	IsDev       types.Bool   `tfsdk:"is_dev"`
	OSImageHash types.String `tfsdk:"os_image_hash"`
	Regions     types.List   `tfsdk:"regions"`
}

type imageAggregate struct {
	Name        string
	Version     string
	IsDev       bool
	OSImageHash string
	Regions     map[string]struct{}
}

func NewImagesDataSource() datasource.DataSource {
	return &imagesDataSource{}
}

func (d *imagesDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_images"
}

func (d *imagesDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "Lists available OS images for CVMs, similar to DigitalOcean images.",
		Attributes: map[string]schema.Attribute{
			"region": schema.StringAttribute{
				Optional:            true,
				MarkdownDescription: "Optional region filter.",
			},
			"images": schema.ListNestedAttribute{
				Computed:            true,
				MarkdownDescription: "Image catalog.",
				NestedObject: schema.NestedAttributeObject{
					Attributes: map[string]schema.Attribute{
						"slug":          schema.StringAttribute{Computed: true},
						"name":          schema.StringAttribute{Computed: true},
						"version":       schema.StringAttribute{Computed: true},
						"is_dev":        schema.BoolAttribute{Computed: true},
						"os_image_hash": schema.StringAttribute{Computed: true},
						"regions": schema.ListAttribute{
							Computed:    true,
							ElementType: types.StringType,
						},
					},
				},
			},
		},
	}
}

func (d *imagesDataSource) Configure(_ context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}

	client, ok := req.ProviderData.(*APIClient)
	if !ok {
		resp.Diagnostics.AddError(
			"Unexpected provider data type",
			"Expected *APIClient while configuring images data source.",
		)
		return
	}

	d.client = client
}

func (d *imagesDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {
	var config imagesDataSourceModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &config)...)
	if resp.Diagnostics.HasError() {
		return
	}

	if config.Region.IsUnknown() {
		resp.Diagnostics.AddAttributeError(
			path.Root("region"),
			"Unknown region filter",
			"Set region to a known value or remove the filter.",
		)
		return
	}
	regionFilter := strings.TrimSpace(stringFromTF(config.Region))

	var payload struct {
		Nodes []struct {
			RegionIdentifier string `json:"region_identifier"`
			Images           []struct {
				Name        string  `json:"name"`
				IsDev       bool    `json:"is_dev"`
				Version     []int64 `json:"version"`
				OSImageHash *string `json:"os_image_hash"`
			} `json:"images"`
		} `json:"nodes"`
	}

	if err := d.client.GetJSON(ctx, "/teepods/available", &payload); err != nil {
		resp.Diagnostics.AddError("Failed to list images", err.Error())
		return
	}

	aggregates := map[string]*imageAggregate{}
	for _, node := range payload.Nodes {
		region := strings.TrimSpace(node.RegionIdentifier)
		if regionFilter != "" && !strings.EqualFold(region, regionFilter) {
			continue
		}

		for _, image := range node.Images {
			slug := strings.TrimSpace(image.Name)
			if slug == "" {
				continue
			}

			agg, exists := aggregates[slug]
			if !exists {
				agg = &imageAggregate{
					Name:        slug,
					Version:     formatVersionTuple(image.Version),
					IsDev:       image.IsDev,
					OSImageHash: stringValueOrEmpty(image.OSImageHash),
					Regions:     map[string]struct{}{},
				}
				aggregates[slug] = agg
			}

			if agg.Version == "" {
				agg.Version = formatVersionTuple(image.Version)
			}
			if agg.OSImageHash == "" {
				agg.OSImageHash = stringValueOrEmpty(image.OSImageHash)
			}
			if region != "" {
				agg.Regions[region] = struct{}{}
			}
		}
	}

	slugs := make([]string, 0, len(aggregates))
	for slug := range aggregates {
		slugs = append(slugs, slug)
	}
	sort.Strings(slugs)

	rows := make([]imageDataSourceRow, 0, len(slugs))
	for _, slug := range slugs {
		agg := aggregates[slug]

		regionNames := make([]string, 0, len(agg.Regions))
		for region := range agg.Regions {
			regionNames = append(regionNames, region)
		}
		sort.Strings(regionNames)

		regionList, diags := types.ListValueFrom(ctx, types.StringType, regionNames)
		resp.Diagnostics.Append(diags...)
		if resp.Diagnostics.HasError() {
			return
		}

		rows = append(rows, imageDataSourceRow{
			Slug:        types.StringValue(slug),
			Name:        types.StringValue(agg.Name),
			Version:     nullableString(agg.Version),
			IsDev:       types.BoolValue(agg.IsDev),
			OSImageHash: nullableString(agg.OSImageHash),
			Regions:     regionList,
		})
	}

	config.Images = rows
	resp.Diagnostics.Append(resp.State.Set(ctx, &config)...)
}

func formatVersionTuple(version []int64) string {
	if len(version) == 0 {
		return ""
	}

	parts := make([]string, 0, len(version))
	for _, v := range version {
		parts = append(parts, strconv.FormatInt(v, 10))
	}
	return strings.Join(parts, ".")
}

func stringValueOrEmpty(v *string) string {
	if v == nil {
		return ""
	}
	return strings.TrimSpace(*v)
}
