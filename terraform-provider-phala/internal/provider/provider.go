package provider

import (
	"context"
	"os"
	"time"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/provider"
	"github.com/hashicorp/terraform-plugin-framework/provider/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

const (
	DefaultAPIPrefix  = "https://cloud-api.phala.com/api/v1"
	DefaultAPIVersion = "2026-01-21"
	DefaultTimeoutSec = 30
)

var _ provider.Provider = &phalaProvider{}

type phalaProvider struct {
	version string
}

type phalaProviderModel struct {
	APIKey         types.String `tfsdk:"api_key"`
	APIPrefix      types.String `tfsdk:"api_prefix"`
	APIVersion     types.String `tfsdk:"api_version"`
	TimeoutSeconds types.Int64  `tfsdk:"timeout_seconds"`
}

func New(version string) func() provider.Provider {
	return func() provider.Provider {
		return &phalaProvider{
			version: version,
		}
	}
}

func (p *phalaProvider) Metadata(_ context.Context, _ provider.MetadataRequest, resp *provider.MetadataResponse) {
	resp.TypeName = "phala"
	resp.Version = p.version
}

func (p *phalaProvider) Schema(_ context.Context, _ provider.SchemaRequest, resp *provider.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "Phala Cloud provider",
		Attributes: map[string]schema.Attribute{
			"api_key": schema.StringAttribute{
				Optional:            true,
				Sensitive:           true,
				MarkdownDescription: "Phala Cloud API key. Can also be set by PHALA_CLOUD_API_KEY.",
			},
			"api_prefix": schema.StringAttribute{
				Optional:            true,
				MarkdownDescription: "Phala Cloud API base URL. Can also be set by PHALA_CLOUD_API_PREFIX.",
			},
			"api_version": schema.StringAttribute{
				Optional:            true,
				MarkdownDescription: "Phala API version sent in X-Phala-Version header.",
			},
			"timeout_seconds": schema.Int64Attribute{
				Optional:            true,
				MarkdownDescription: "HTTP timeout in seconds.",
			},
		},
	}
}

func (p *phalaProvider) Configure(ctx context.Context, req provider.ConfigureRequest, resp *provider.ConfigureResponse) {
	var config phalaProviderModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &config)...)
	if resp.Diagnostics.HasError() {
		return
	}

	if config.APIKey.IsUnknown() {
		resp.Diagnostics.AddAttributeError(
			path.Root("api_key"),
			"Unknown API Key",
			"The provider cannot create a client because api_key is unknown.",
		)
		return
	}

	apiKey := firstNonEmptyString(
		stringFromTF(config.APIKey),
		os.Getenv("PHALA_CLOUD_API_KEY"),
	)
	if apiKey == "" {
		resp.Diagnostics.AddError(
			"Missing API Key",
			"Set api_key in the provider block or PHALA_CLOUD_API_KEY in the environment.",
		)
		return
	}

	apiPrefix := firstNonEmptyString(
		stringFromTF(config.APIPrefix),
		os.Getenv("PHALA_CLOUD_API_PREFIX"),
		DefaultAPIPrefix,
	)

	apiVersion := firstNonEmptyString(
		stringFromTF(config.APIVersion),
		DefaultAPIVersion,
	)

	timeoutSec := int64(DefaultTimeoutSec)
	if !config.TimeoutSeconds.IsNull() && !config.TimeoutSeconds.IsUnknown() {
		timeoutSec = config.TimeoutSeconds.ValueInt64()
		if timeoutSec <= 0 {
			resp.Diagnostics.AddError("Invalid timeout_seconds", "timeout_seconds must be greater than 0.")
			return
		}
	}

	client := NewAPIClient(apiPrefix, apiKey, apiVersion, time.Duration(timeoutSec)*time.Second)
	resp.DataSourceData = client
	resp.ResourceData = client
}

func (p *phalaProvider) DataSources(_ context.Context) []func() datasource.DataSource {
	return []func() datasource.DataSource{
		NewAccountDataSource,
		NewWorkspaceDataSource,
		NewSizesDataSource,
		NewRegionsDataSource,
		NewImagesDataSource,
	}
}

func (p *phalaProvider) Resources(_ context.Context) []func() resource.Resource {
	return []func() resource.Resource{
		NewAppResource,
		NewCVMResource,
		NewCVMPowerResource,
		NewSSHKeyResource,
	}
}

func stringFromTF(v types.String) string {
	if v.IsNull() || v.IsUnknown() {
		return ""
	}
	return v.ValueString()
}

func firstNonEmptyString(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
