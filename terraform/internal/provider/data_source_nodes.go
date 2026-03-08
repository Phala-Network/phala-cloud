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

var _ datasource.DataSource = &nodesDataSource{}

type nodesDataSource struct {
	client *APIClient
}

type nodesDataSourceModel struct {
	Region            types.String        `tfsdk:"region"`
	SupportOnchainKMS types.Bool          `tfsdk:"support_onchain_kms"`
	Nodes             []nodeDataSourceRow `tfsdk:"nodes"`
}

type nodeDataSourceRow struct {
	NodeID            types.Int64   `tfsdk:"node_id"`
	Name              types.String  `tfsdk:"name"`
	Region            types.String  `tfsdk:"region"`
	Listed            types.Bool    `tfsdk:"listed"`
	SupportOnchainKMS types.Bool    `tfsdk:"support_onchain_kms"`
	ResourceScore     types.Float64 `tfsdk:"resource_score"`
	RemainingVCPU     types.Float64 `tfsdk:"remaining_vcpu"`
	RemainingMemoryMB types.Float64 `tfsdk:"remaining_memory_mb"`
	RemainingCVMSlots types.Float64 `tfsdk:"remaining_cvm_slots"`
	FMSPC             types.String  `tfsdk:"fmspc"`
	DeviceID          types.String  `tfsdk:"device_id"`
	Images            types.List    `tfsdk:"images"`
}

func NewNodesDataSource() datasource.DataSource {
	return &nodesDataSource{}
}

func (d *nodesDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_nodes"
}

func (d *nodesDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "Lists available worker nodes (teepods) for CVM placement.",
		Attributes: map[string]schema.Attribute{
			"region": schema.StringAttribute{
				Optional:            true,
				MarkdownDescription: "Optional region filter (for example: us-west).",
			},
			"support_onchain_kms": schema.BoolAttribute{
				Optional:            true,
				MarkdownDescription: "Optional filter by on-chain KMS support.",
			},
			"nodes": schema.ListNestedAttribute{
				Computed:            true,
				MarkdownDescription: "Available nodes for placement (`node_id` maps to resource `node_id`).",
				NestedObject: schema.NestedAttributeObject{
					Attributes: map[string]schema.Attribute{
						"node_id":             schema.Int64Attribute{Computed: true},
						"name":                schema.StringAttribute{Computed: true},
						"region":              schema.StringAttribute{Computed: true},
						"listed":              schema.BoolAttribute{Computed: true},
						"support_onchain_kms": schema.BoolAttribute{Computed: true},
						"resource_score":      schema.Float64Attribute{Computed: true},
						"remaining_vcpu":      schema.Float64Attribute{Computed: true},
						"remaining_memory_mb": schema.Float64Attribute{Computed: true},
						"remaining_cvm_slots": schema.Float64Attribute{Computed: true},
						"fmspc":               schema.StringAttribute{Computed: true},
						"device_id":           schema.StringAttribute{Computed: true},
						"images": schema.ListAttribute{
							Computed:    true,
							ElementType: types.StringType,
						},
					},
				},
			},
		},
	}
}

func (d *nodesDataSource) Configure(_ context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}

	client, ok := req.ProviderData.(*APIClient)
	if !ok {
		resp.Diagnostics.AddError(
			"Unexpected provider data type",
			"Expected *APIClient while configuring nodes data source.",
		)
		return
	}

	d.client = client
}

func (d *nodesDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {
	var config nodesDataSourceModel
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
	if config.SupportOnchainKMS.IsUnknown() {
		resp.Diagnostics.AddAttributeError(
			path.Root("support_onchain_kms"),
			"Unknown support_onchain_kms filter",
			"Set support_onchain_kms to true/false or remove the filter.",
		)
		return
	}

	regionFilter := strings.TrimSpace(stringFromTF(config.Region))
	filterOnchain := !config.SupportOnchainKMS.IsNull()
	wantOnchain := false
	if filterOnchain {
		wantOnchain = config.SupportOnchainKMS.ValueBool()
	}

	var payload struct {
		Nodes []struct {
			TeepodID          *int64   `json:"teepod_id"`
			ID                *int64   `json:"id"`
			Name              string   `json:"name"`
			Listed            *bool    `json:"listed"`
			ResourceScore     *float64 `json:"resource_score"`
			RemainingVCPU     *float64 `json:"remaining_vcpu"`
			RemainingMemory   *float64 `json:"remaining_memory"`
			RemainingCVMSlots *float64 `json:"remaining_cvm_slots"`
			RegionIdentifier  string   `json:"region_identifier"`
			SupportOnchainKMS *bool    `json:"support_onchain_kms"`
			FMSPC             *string  `json:"fmspc"`
			DeviceID          *string  `json:"device_id"`
			Images            []struct {
				Name string `json:"name"`
			} `json:"images"`
		} `json:"nodes"`
	}

	if err := d.client.GetJSON(ctx, "/teepods/available", &payload); err != nil {
		resp.Diagnostics.AddError("Failed to list nodes", err.Error())
		return
	}

	rows := make([]nodeDataSourceRow, 0, len(payload.Nodes))
	for _, node := range payload.Nodes {
		nodeID := int64(0)
		switch {
		case node.TeepodID != nil:
			nodeID = *node.TeepodID
		case node.ID != nil:
			nodeID = *node.ID
		default:
			continue
		}
		if nodeID <= 0 {
			continue
		}

		region := strings.TrimSpace(node.RegionIdentifier)
		if regionFilter != "" && !strings.EqualFold(region, regionFilter) {
			continue
		}

		onchain := node.SupportOnchainKMS != nil && *node.SupportOnchainKMS
		if filterOnchain && onchain != wantOnchain {
			continue
		}

		imageNames := make([]string, 0, len(node.Images))
		for _, image := range node.Images {
			name := strings.TrimSpace(image.Name)
			if name == "" {
				continue
			}
			imageNames = append(imageNames, name)
		}
		sort.Strings(imageNames)

		images, diags := types.ListValueFrom(ctx, types.StringType, imageNames)
		resp.Diagnostics.Append(diags...)
		if resp.Diagnostics.HasError() {
			return
		}

		rows = append(rows, nodeDataSourceRow{
			NodeID:            types.Int64Value(nodeID),
			Name:              nullableString(node.Name),
			Region:            nullableString(region),
			Listed:            types.BoolValue(node.Listed != nil && *node.Listed),
			SupportOnchainKMS: types.BoolValue(onchain),
			ResourceScore:     nullableFloat64(node.ResourceScore),
			RemainingVCPU:     nullableFloat64(node.RemainingVCPU),
			RemainingMemoryMB: nullableFloat64(node.RemainingMemory),
			RemainingCVMSlots: nullableFloat64(node.RemainingCVMSlots),
			FMSPC:             nullableStringPtr(node.FMSPC),
			DeviceID:          nullableStringPtr(node.DeviceID),
			Images:            images,
		})
	}

	sort.Slice(rows, func(i, j int) bool {
		return rows[i].NodeID.ValueInt64() < rows[j].NodeID.ValueInt64()
	})

	config.Nodes = rows
	resp.Diagnostics.Append(resp.State.Set(ctx, &config)...)
}

func nullableFloat64(v *float64) types.Float64 {
	if v == nil {
		return types.Float64Null()
	}
	return types.Float64Value(*v)
}
