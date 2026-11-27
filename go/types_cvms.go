package phala

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
)

// CVMHourlyRate contains split hourly pricing for a CVM.
type CVMHourlyRate struct {
	Total   *string `json:"total,omitempty"`
	Compute *string `json:"compute,omitempty"`
	Disk    *string `json:"disk,omitempty"`
}

// CVMGpuRentalOrderInfo contains a slimmed-down GPU rental order reference.
type CVMGpuRentalOrderInfo struct {
	OrderID                string  `json:"order_id"`
	Status                 string  `json:"status"`
	PricingPlan            *string `json:"pricing_plan,omitempty"`
	CommitmentDays         *int    `json:"commitment_days,omitempty"`
	AutoRenew              *bool   `json:"auto_renew,omitempty"`
	ExpiresAt              *string `json:"expires_at,omitempty"`
	RenewalInProgress      *bool   `json:"renewal_in_progress,omitempty"`
	RenewalNextAttemptAt   *string `json:"renewal_next_attempt_at,omitempty"`
	AgreedHourlyRate       *string `json:"agreed_hourly_rate,omitempty"`
	HourlyBillingStartTime *string `json:"hourly_billing_start_time,omitempty"`
	ActivatedAt            *string `json:"activated_at,omitempty"`
	CompletedAt            *string `json:"completed_at,omitempty"`
	CancelledAt            *string `json:"cancelled_at,omitempty"`
	DecoupledAt            *string `json:"decoupled_at,omitempty"`
	SkuCode                *string `json:"sku_code,omitempty"`
	SkuDisplayName         *string `json:"sku_display_name,omitempty"`
}

// CVMInfoFields contains fields shared by versioned CVM response schemas.
type CVMInfoFields struct {
	Name                string                 `json:"name"`
	AppID               *string                `json:"app_id,omitempty"`
	VMUUID              *string                `json:"vm_uuid,omitempty"`
	InstanceID          *string                `json:"instance_id,omitempty"`
	Resource            CvmResource            `json:"resource"`
	NodeInfo            *NodeRef               `json:"node_info,omitempty"`
	OS                  *CvmOsInfo             `json:"os,omitempty"`
	KMSType             *string                `json:"kms_type,omitempty"`
	KMSInfo             *CvmKmsInfo            `json:"kms_info,omitempty"`
	Status              string                 `json:"status"`
	Progress            *CvmProgressInfo       `json:"progress,omitempty"`
	ComposeHash         *string                `json:"compose_hash,omitempty"`
	DockerComposeHash   *string                `json:"docker_compose_hash,omitempty"`
	PreLaunchScriptHash *string                `json:"pre_launch_script_hash,omitempty"`
	Gateway             *CvmGatewayInfo        `json:"gateway,omitempty"`
	Logs                *CVMLogURLs            `json:"logs,omitempty"`
	Services            []any                  `json:"services,omitempty"`
	Endpoints           []CVMEndpoint          `json:"endpoints,omitempty"`
	PublicLogs          *bool                  `json:"public_logs,omitempty"`
	PublicSysinfo       *bool                  `json:"public_sysinfo,omitempty"`
	PublicTcbinfo       *bool                  `json:"public_tcbinfo,omitempty"`
	GatewayEnabled      *bool                  `json:"gateway_enabled,omitempty"`
	SecureTime          *bool                  `json:"secure_time,omitempty"`
	ManagedEnv          bool                   `json:"managed_env"`
	Listed              bool                   `json:"listed"`
	StorageFS           *string                `json:"storage_fs,omitempty"`
	Workspace           *WorkspaceRef          `json:"workspace,omitempty"`
	Creator             *UserRef               `json:"creator,omitempty"`
	CreatedAt           *string                `json:"created_at,omitempty"`
	DeletedAt           *string                `json:"deleted_at,omitempty"`
	ProjectType         *string                `json:"project_type,omitempty"`
	UpdatedAt           *string                `json:"updated_at,omitempty"`
	AppURL              *string                `json:"app_url,omitempty"`
	BaseImage           *string                `json:"base_image,omitempty"`
	Features            []string               `json:"features,omitempty"`
	Runner              *string                `json:"runner,omitempty"`
	ManifestVer         *string                `json:"manifest_version,omitempty"`
	HourlyRate          *CVMHourlyRate         `json:"hourly_rate,omitempty"`
	BillingInterval     *string                `json:"billing_interval,omitempty"`
	GpuRentalOrder      *CVMGpuRentalOrderInfo `json:"gpu_rental_order,omitempty"`
	ComposeFile         any                    `json:"compose_file,omitempty"`
	GPU                 *CVMGPUInfo            `json:"gpu,omitempty"`
	DappDashboardURL    *string                `json:"dapp_dashboard_url,omitempty"`
	SyslogEndpoint      *string                `json:"syslog_endpoint,omitempty"`
	// EnabledSSHAccess is true when this CVM runs a dev OS image or a dev-box service.
	EnabledSSHAccess bool                   `json:"enabled_ssh_access"`
	FinalityWait     *CVMFinalityWaitStatus `json:"finality_wait,omitempty"`
	FinalityFailure  *CVMFinalityFailure    `json:"finality_failure,omitempty"`

	// Additional fields used by the Terraform provider.
	InProgress         bool          `json:"in_progress,omitempty"`
	EncryptedEnvPubkey *string       `json:"encrypted_env_pubkey,omitempty"`
	DiskSize           *int64        `json:"disk_size,omitempty"`
	PublicURLs         []CVMEndpoint `json:"public_urls,omitempty"`
}

// CVMInfoV20260121 represents CVM information.
type CVMInfoV20260121 struct {
	ID string `json:"id"`
	CVMInfoFields
}

// CVMInfoV20260522 represents CVM information with hashed CVM IDs.
type CVMInfoV20260522 struct {
	ID string `json:"id"`
	CVMInfoFields
}

// CVMInfo is the latest CVM information schema.
type CVMInfo = CVMInfoV20260522

// CVMGPUInfo describes the GPU allocation and expected confidential computing mode.
type CVMGPUInfo struct {
	ProductID *string      `json:"product_id"`
	GPUs      int          `json:"gpus"`
	CCMode    CVMGPUCCMode `json:"cc_mode"`
}

// CVMGPUCCMode describes the expected GPU confidential computing mode.
type CVMGPUCCMode struct {
	Expected string `json:"expected"`
}

// CVMGPUStatus contains observed GPU status, or nil when unavailable.
type CVMGPUStatus struct {
	Observed []CVMGPUObservedStatus `json:"observed"`
}

// CVMGPUObservedStatus describes the observed mode of one GPU.
type CVMGPUObservedStatus struct {
	Slot   string `json:"slot"`
	CCMode string `json:"cc_mode"`
}

// CVMEndpoint represents a CVM endpoint URL.
type CVMEndpoint struct {
	App      string `json:"app"`
	Instance string `json:"instance"`
}

// CVMLogURLs contains short-lived, expiring presigned URLs for CVM log streams.
// Serial, Stdout, and Stderr are complete URLs. ContainerLogBase is the
// query-free base URL for container logs; append the container name, display
// query parameters, and AuthQuery to construct a complete container log URL.
// ContainerLogBase and AuthQuery are populated only when public_logs is true
// and vm_uuid is available; otherwise they are unset.
type CVMLogURLs struct {
	Serial           *string `json:"serial,omitempty"`
	Stdout           *string `json:"stdout,omitempty"`
	Stderr           *string `json:"stderr,omitempty"`
	ContainerLogBase *string `json:"container_log_base,omitempty"`
	AuthQuery        *string `json:"auth_query,omitempty"`
}

// CvmResource holds CVM resource allocation.
type CvmResource struct {
	InstanceType        *string  `json:"instance_type,omitempty"`
	VCPU                *int     `json:"vcpu,omitempty"`
	MemoryInGB          *float64 `json:"memory_in_gb,omitempty"`
	MemoryInMB          *int64   `json:"memory_in_mb,omitempty"`
	DiskInGB            *int     `json:"disk_in_gb,omitempty"`
	GPUs                *int     `json:"gpus,omitempty"`
	ComputeBillingPrice *string  `json:"compute_billing_price,omitempty"`
	BillingPeriod       *string  `json:"billing_period,omitempty"`
}

// CvmOsInfo holds CVM OS information.
type CvmOsInfo struct {
	Name        *string `json:"name,omitempty"`
	Version     *string `json:"version,omitempty"`
	IsDev       *bool   `json:"is_dev,omitempty"`
	OSImageHash *string `json:"os_image_hash,omitempty"`
}

// CvmAvailableOSImageVariant represents a production or development OS image variant.
type CvmAvailableOSImageVariant struct {
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	OSImageHash *string `json:"os_image_hash,omitempty"`
	RequiresGPU bool    `json:"requires_gpu"`
	SupportsCPU bool    `json:"supports_cpu"`
	SupportsGPU bool    `json:"supports_gpu"`
	IsCurrent   bool    `json:"is_current"`
	Enabled     bool    `json:"enabled"`
}

// CvmAvailableOSImage groups production and development variants by version.
type CvmAvailableOSImage struct {
	Version     []int                       `json:"version"`
	Release     string                      `json:"release"`
	PublishedAt *string                     `json:"published_at"`
	Prod        *CvmAvailableOSImageVariant `json:"prod"`
	Dev         *CvmAvailableOSImageVariant `json:"dev"`
}

// CvmKmsInfo holds CVM KMS information.
type CvmKmsInfo struct {
	ChainID            *int    `json:"chain_id,omitempty"`
	DstackKmsAddress   *string `json:"dstack_kms_address,omitempty"`
	DstackAppAddress   *string `json:"dstack_app_address,omitempty"`
	DeployerAddress    *string `json:"deployer_address,omitempty"`
	RPCEndpoint        *string `json:"rpc_endpoint,omitempty"`
	EncryptedEnvPubkey *string `json:"encrypted_env_pubkey,omitempty"`
	K256Pubkey         *string `json:"k256_pubkey,omitempty"`
	BlockTag           *string `json:"block_tag,omitempty"`
	FinalityETASeconds *int    `json:"finality_eta_seconds,omitempty"`
}

// ChainName returns a human-readable chain name based on ChainID.
func (k *CvmKmsInfo) ChainName() string {
	if k == nil || k.ChainID == nil {
		return ""
	}
	switch *k.ChainID {
	case 1:
		return "Ethereum"
	case 8453:
		return "Base"
	case 31337:
		return "Anvil"
	default:
		return ""
	}
}

// CvmProgressInfo holds CVM progress information.
type CvmProgressInfo struct {
	Target        *string `json:"target,omitempty"`
	StartedAt     *string `json:"started_at,omitempty"`
	CorrelationID *string `json:"correlation_id,omitempty"`
}

// CvmGatewayInfo holds CVM gateway information.
type CvmGatewayInfo struct {
	BaseDomain *string `json:"base_domain,omitempty"`
	CNAME      *string `json:"cname,omitempty"`
}

// NodeRef is a reference to a node.
type NodeRef struct {
	ObjectType string          `json:"object_type"`
	ID         *int            `json:"id,omitempty"`
	NodeID     *int            `json:"node_id,omitempty"`
	Name       *string         `json:"name,omitempty"`
	Region     *string         `json:"region,omitempty"`
	DeviceID   *string         `json:"device_id,omitempty"`
	DeviceIDs  []DeviceIDEntry `json:"device_ids,omitempty"`
	PPID       *string         `json:"ppid,omitempty"`
	Status     *string         `json:"status,omitempty"`
	Version    *string         `json:"version,omitempty"`
}

// UserRef is a reference to a user.
type UserRef struct {
	ObjectType string  `json:"object_type"`
	ID         *string `json:"id,omitempty"`
	Username   *string `json:"username,omitempty"`
	AvatarURL  *string `json:"avatar_url,omitempty"`
}

// WorkspaceRef is a reference to a workspace.
type WorkspaceRef struct {
	ObjectType string  `json:"object_type"`
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Slug       *string `json:"slug,omitempty"`
	AvatarURL  *string `json:"avatar_url,omitempty"`
}

// CvmRef is a reference to a CVM.
type CvmRef struct {
	ObjectType string  `json:"object_type"`
	ID         *string `json:"id,omitempty"`
	Name       *string `json:"name,omitempty"`
	AppID      *string `json:"app_id,omitempty"`
	VMUUID     *string `json:"vm_uuid,omitempty"`
}

// PaginatedCVMInfosV20260121 is a paginated list of CVM infos.
type PaginatedCVMInfosV20260121 = Paginated[CVMInfoV20260121]

// PaginatedCVMInfosV20260522 is a paginated list of CVM infos with hashed CVM IDs.
type PaginatedCVMInfosV20260522 = Paginated[CVMInfoV20260522]

// PaginatedCVMInfos is the latest paginated CVM info schema.
type PaginatedCVMInfos = PaginatedCVMInfosV20260522

// GetCVMListOptions holds query parameters for listing CVMs.
type GetCVMListOptions struct {
	Page          *int     `json:"page,omitempty"`
	PageSize      *int     `json:"page_size,omitempty"`
	Family        *string  `json:"family,omitempty"`
	InstanceTypes []string `json:"instance_types,omitempty"`
	Search        *string  `json:"search,omitempty"`
	Status        []string `json:"status,omitzero"`
	BaseImage     *string  `json:"base_image,omitempty"`
	KMSSlug       *string  `json:"kms_slug,omitempty"`
	KMSType       *string  `json:"kms_type,omitempty"`
	Node          *string  `json:"node,omitempty"`
	Region        *string  `json:"region,omitempty"`
}

// ProvisionCVMRequest is the request body for provisioning a CVM.
type ProvisionCVMRequest struct {
	Name         string       `json:"name"`
	InstanceType string       `json:"instance_type,omitempty"`
	ComposeFile  *ComposeFile `json:"compose_file,omitempty"`

	// Optional fields.
	VCPU            *int                `json:"vcpu,omitempty"`
	Memory          *int                `json:"memory,omitempty"`
	DiskSize        *int                `json:"disk_size,omitempty"`
	Node            *string             `json:"node,omitempty"`
	Image           *string             `json:"image,omitempty"`
	Region          *string             `json:"region,omitempty"`
	KMSID           *string             `json:"kms_id,omitempty"`
	KMS             *string             `json:"kms,omitempty"`
	KMSContract     *string             `json:"kms_contract,omitempty"`
	KMSContractID   *string             `json:"kms_contract_id,omitempty"`
	KeyProviderMode *string             `json:"key_provider_mode,omitempty"`
	SkipGateway     *bool               `json:"skip_gateway,omitempty"`
	Listed          *bool               `json:"listed,omitempty"`
	Nonce           *int64              `json:"nonce,omitempty"`
	AppID           *string             `json:"app_id,omitempty"`
	PreferDev       *bool               `json:"prefer_dev,omitempty"`
	EnvKeys         []string            `json:"env_keys,omitzero"`
	SSHKeyIDs       []string            `json:"ssh_key_ids,omitzero"`
	Ports           []ProvisionPort     `json:"ports,omitzero"`
	EncryptedEnv    *string             `json:"encrypted_env,omitempty"`
	UserConfig      *string             `json:"user_config,omitempty"`
	Hugepages       *bool               `json:"hugepages,omitempty"`
	PinNUMA         *bool               `json:"pin_numa,omitempty"`
	GPUs            *ProvisionGPUConfig `json:"gpus,omitempty"`
	KMSURLs         []string            `json:"kms_urls,omitzero"`
	GatewayURLs     []string            `json:"gateway_urls,omitzero"`
	// InitScripts selects, by name, the init scripts provided by Phala Cloud to
	// run on every boot. The server validates the names and fixes the order.
	InitScripts []InitScriptSlug `json:"init_scripts,omitzero"`
	// Deprecated: use InitScripts with InitScriptDockerCleanup.
	EnabledInitScriptsDockerCleanup *bool `json:"enabled_init_scripts_docker_cleanup,omitempty"`
	EnabledGuestAgentAccess         *bool `json:"enabled_guest_agent_access,omitempty"`
	// GuestAgentGatewayAccess confirms blocking gateway access to port 8090.
	// Send "closed".
	GuestAgentGatewayAccess *string `json:"guest_agent_gateway_access,omitempty"`

	// ComposeFileRaw is a whole app-compose JSON file, sent instead of
	// ComposeFile. Needs the compose_advanced feature flag.
	ComposeFileRaw *string `json:"compose_file_raw,omitempty"`
	// LaunchToken (at least 32 bytes) is required by the guest on every boot.
	LaunchToken *string `json:"launch_token,omitempty"`
	// GenerateLaunchToken gates the CVM with a token Phala Cloud generates for
	// a new app (returned once in the commit response), or with the app's
	// existing token.
	GenerateLaunchToken *bool `json:"generate_launch_token,omitempty"`
	// Annotations is host-side key/value metadata stored by the dstack VMM.
	// Needs the cvm_annotations feature flag.
	Annotations map[string]string `json:"annotations,omitzero"`
}

type ProvisionPort struct {
	VMPort      int      `json:"vm_port"`
	Protocol    string   `json:"protocol,omitempty"`
	SourceCIDRs []string `json:"source_cidrs,omitzero"`
	Description *string  `json:"description,omitempty"`
}
type ProvisionGPUSpec struct {
	Slot      string  `json:"slot"`
	ProductID *string `json:"product_id,omitempty"`
}
type ProvisionGPUConfig struct {
	GPUs       []ProvisionGPUSpec `json:"gpus"`
	AttachMode string             `json:"attach_mode,omitempty"`
}

// ComposeInitScripts decodes both historical single-string and current array forms.
// It is encoded as an array. The field is read-only here: provisioning ignores
// it. Select init scripts by name with ProvisionCVMRequest.InitScripts.
type ComposeInitScripts []string

func (scripts *ComposeInitScripts) UnmarshalJSON(data []byte) error {
	var single string
	if err := json.Unmarshal(data, &single); err == nil && string(data) != "null" {
		if single == "" {
			*scripts = ComposeInitScripts{}
		} else {
			*scripts = ComposeInitScripts{single}
		}
		return nil
	}
	var values []string
	if err := json.Unmarshal(data, &values); err != nil {
		return err
	}
	*scripts = values
	return nil
}

// Runner values for ComposeFile.Runner. Runners other than
// ComposeRunnerDockerCompose need the compose_advanced feature flag.
const (
	ComposeRunnerDockerCompose  = "docker-compose"
	ComposeRunnerNerdctlCompose = "nerdctl-compose"
	ComposeRunnerBash           = "bash"
)

// ComposeFile is an app compose, as returned by GetCVMComposeFile and sent
// (flat) by ProvisionCVMComposeFileUpdate.
type ComposeFile struct {
	Name                    string               `json:"name"`
	DockerComposeFile       string               `json:"docker_compose_file,omitempty"`
	GatewayEnabled          *bool                `json:"gateway_enabled,omitempty"`
	PreLaunchScript         *string              `json:"pre_launch_script,omitempty"`
	AllowedEnvs             []string             `json:"allowed_envs,omitzero"`
	PublicLogs              *bool                `json:"public_logs,omitempty"`
	PublicSysinfo           *bool                `json:"public_sysinfo,omitempty"`
	PublicTcbinfo           *bool                `json:"public_tcbinfo,omitempty"`
	SecureTime              *bool                `json:"secure_time,omitempty"`
	StorageFS               *string              `json:"storage_fs,omitempty"`
	BashScript              *string              `json:"bash_script,omitempty"`
	DefaultGatewayDomain    *string              `json:"default_gateway_domain,omitempty"`
	InitScript              ComposeInitScripts   `json:"init_script,omitzero"`
	KeyProvider             *string              `json:"key_provider,omitempty"`
	KeyProviderID           *string              `json:"key_provider_id,omitempty"`
	KMSEnabled              *bool                `json:"kms_enabled,omitempty"`
	LocalKeyProviderEnabled *bool                `json:"local_key_provider_enabled,omitempty"`
	ManifestVersion         json.RawMessage      `json:"manifest_version,omitempty"`
	NoInstanceID            *bool                `json:"no_instance_id,omitempty"`
	PortPolicy              *ComposePortPolicy   `json:"port_policy,omitempty"`
	Runner                  *string              `json:"runner,omitempty"`
	Requirements            *ComposeRequirements `json:"requirements,omitempty"`
	StorageDiscard          *bool                `json:"storage_discard,omitempty"`
	EventLogVersion         *int                 `json:"event_log_version,omitempty"`
	Snapshotter             *string              `json:"snapshotter,omitempty"`
	VerityVolumes           []VerityVolume       `json:"verity_volumes,omitzero"`
	Features                []string             `json:"features,omitzero"`
	Salt                    *string              `json:"salt,omitempty"`
	SwapSize                *string              `json:"swap_size,omitempty"`
	TproxyEnabled           *bool                `json:"tproxy_enabled,omitempty"`
	// Extra holds app-compose keys the SDK does not model, so a
	// GetCVMComposeFile → ProvisionCVMComposeFileUpdate round trip keeps them.
	Extra map[string]json.RawMessage `json:"-"`
}

func (c *ComposeFile) UnmarshalJSON(data []byte) error {
	type plain ComposeFile
	var value plain
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}
	extra, err := extraJSONFields(data, value)
	if err != nil {
		return err
	}
	*c = ComposeFile(value)
	c.Extra = extra
	return nil
}

func (c ComposeFile) MarshalJSON() ([]byte, error) {
	type plain ComposeFile
	base, err := json.Marshal(plain(c))
	if err != nil {
		return nil, err
	}
	return mergeJSONObject(base, c.Extra)
}

func extraJSONFields(data []byte, known any) (map[string]json.RawMessage, error) {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	t := reflect.TypeOf(known)
	if t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		name, _, _ := strings.Cut(field.Tag.Get("json"), ",")
		if name == "" || name == "-" {
			continue
		}
		delete(raw, name)
	}
	if len(raw) == 0 {
		return nil, nil
	}
	return raw, nil
}

func mergeJSONObject(base []byte, extra map[string]json.RawMessage) ([]byte, error) {
	if len(extra) == 0 {
		return base, nil
	}
	var obj map[string]json.RawMessage
	if err := json.Unmarshal(base, &obj); err != nil {
		return nil, err
	}
	if obj == nil {
		obj = map[string]json.RawMessage{}
	}
	for key, value := range extra {
		obj[key] = value
	}
	return json.Marshal(obj)
}

type ComposePortAttr struct {
	Port int  `json:"port"`
	PP   bool `json:"pp"`
}
type ComposePortPolicy struct {
	Ports        []ComposePortAttr `json:"ports,omitzero"`
	RestrictMode *bool             `json:"restrict_mode,omitempty"`
}
type ComposeGPUPolicy struct {
	AllowDebug        *bool   `json:"allow_debug,omitempty"`
	AllowDevtools     *bool   `json:"allow_devtools,omitempty"`
	AllowInsecureBoot *bool   `json:"allow_insecure_boot,omitempty"`
	AttestGPU         *bool   `json:"attest_gpu,omitempty"`
	Rego              *string `json:"rego,omitempty"`
}
type ComposeRequirements struct {
	// EphemeralDataDisk formats the data disk on every boot (dstack OS 0.6.3+).
	EphemeralDataDisk    *bool             `json:"ephemeral_data_disk,omitempty"`
	GPUPolicy            *ComposeGPUPolicy `json:"gpu_policy,omitempty"`
	HealthCheck          *bool             `json:"health_check,omitempty"`
	HealthStatusFile     *string           `json:"health_status_file,omitempty"`
	LaunchTokenHash      *string           `json:"launch_token_hash,omitempty"`
	Platforms            []string          `json:"platforms,omitzero"`
	TDXMeasureACPITables *bool             `json:"tdx_measure_acpi_tables,omitempty"`
}
type VerityVolume struct {
	Source     string `json:"source"`
	Target     string `json:"target"`
	VerityRoot string `json:"verity_root"`
}

// ProvisionCVMResponse is the response from provisioning a CVM.
type ProvisionCVMResponse struct {
	AppID               string      `json:"app_id"`
	ComposeHash         string      `json:"compose_hash"`
	AppEnvEncryptPubkey string      `json:"app_env_encrypt_pubkey,omitempty"`
	KMSInfo             *CvmKmsInfo `json:"kms_info,omitempty"`
	FMSPC               string      `json:"fmspc,omitempty"`
	DeviceID            string      `json:"device_id,omitempty"`
	OSImageHash         string      `json:"os_image_hash,omitempty"`
	InstanceType        string      `json:"instance_type,omitempty"`
	NodeID              *int        `json:"node_id,omitempty"`
	// Deprecated: KMSID identifies a KMS node, not the on-chain KMS contract.
	// Use KMSContractID instead.
	KMSID                 string `json:"kms_id,omitempty"`
	KMSContractID         string `json:"kms_contract_id,omitempty"`
	ComposeHashRegistered bool   `json:"compose_hash_registered,omitempty"`
	// Token is the one-time commit token for the same-path two-phase create.
	// Present when the backend supports token commit on POST /cvms; empty
	// against older backends.
	Token string `json:"token,omitempty"`
	// ComposeUnchanged is set only by ProvisionCVMComposeFileUpdate: true means
	// the submitted compose matched the deployed one, so the commit step is a
	// no-op and can be skipped. Always false for a fresh provision.
	ComposeUnchanged bool `json:"compose_unchanged,omitempty"`
}

// CommitCVMProvisionRequest is the request for committing a CVM provision.
type CommitCVMProvisionRequest struct {
	// Token is the one-time commit token from ProvisionCVMResponse. When set,
	// the backend resolves AppID and ComposeHash from the token; they may be
	// left empty.
	Token           *string  `json:"token,omitempty"`
	AppID           string   `json:"app_id,omitempty"`
	ComposeHash     string   `json:"compose_hash,omitempty"`
	TransactionHash *string  `json:"transaction_hash,omitempty"`
	EncryptedEnv    *string  `json:"encrypted_env,omitempty"`
	EnvKeys         []string `json:"env_keys,omitzero"`
	KMSID           *string  `json:"kms_id,omitempty"`
	ContractAddress *string  `json:"contract_address,omitempty"`
	DeployerAddress *string  `json:"deployer_address,omitempty"`
}

// CommitCVMProvisionResponseFields contains shared commit response fields.
type CommitCVMProvisionResponseFields struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	// LaunchToken is the launch token this create stored on a new app
	// (LaunchToken or GenerateLaunchToken). Returned only here, once.
	LaunchToken  string                 `json:"launch_token,omitempty"`
	FinalityWait *CVMFinalityWaitStatus `json:"finality_wait,omitempty"`
}

// CommitCVMProvisionResponseV20260121 is the commit response before hashed CVM IDs.
type CommitCVMProvisionResponseV20260121 struct {
	ID int `json:"id"`
	CommitCVMProvisionResponseFields
}

// CommitCVMProvisionResponseV20260522 is the commit response with hashed CVM IDs.
type CommitCVMProvisionResponseV20260522 struct {
	ID string `json:"id"`
	CommitCVMProvisionResponseFields
}

// CommitCVMProvisionResponse is the latest commit response schema.
type CommitCVMProvisionResponse = CommitCVMProvisionResponseV20260522

// CvmID returns the CVM ID as a string.
func (r *CommitCVMProvisionResponseV20260522) CvmID() string {
	return r.ID
}

// CvmID returns the CVM ID as a string.
func (r *CommitCVMProvisionResponseV20260121) CvmID() string {
	return fmt.Sprintf("%d", r.ID)
}

// CVMResourceUsage contains live resource metrics from teescope.
type CVMResourceUsage struct {
	CPUPercent       *float64 `json:"cpu_percent,omitempty"`
	MemoryUsedBytes  *int64   `json:"memory_used_bytes,omitempty"`
	MemoryTotalBytes *int64   `json:"memory_total_bytes,omitempty"`
	DiskUsedBytes    *int64   `json:"disk_used_bytes,omitempty"`
	DiskTotalBytes   *int64   `json:"disk_total_bytes,omitempty"`
	EgressBytes      *int64   `json:"egress_bytes,omitempty"`
}

// CVMGuestEvent represents a guest lifecycle event.
type CVMGuestEvent struct {
	Event     string  `json:"event"`
	Body      string  `json:"body"`
	Timestamp float64 `json:"timestamp"`
}

// CVMOperationStatus represents an in-progress async operation.
type CVMOperationStatus struct {
	Type          *string `json:"type,omitempty"`
	Phase         *string `json:"phase,omitempty"`
	StartedAt     *string `json:"started_at,omitempty"`
	CorrelationID *string `json:"correlation_id,omitempty"`
}

// CVMStatusEntry represents a single CVM's status from the batch status endpoint.
type CVMStatusEntry struct {
	VMUUID           string              `json:"vm_uuid"`
	Status           string              `json:"status"`
	Uptime           *string             `json:"uptime,omitempty"`
	InProgress       bool                `json:"in_progress"`
	BootProgress     *string             `json:"boot_progress,omitempty"`
	BootError        *string             `json:"boot_error,omitempty"`
	ShutdownProgress *string             `json:"shutdown_progress,omitempty"`
	Events           []CVMGuestEvent     `json:"events"`
	Operation        *CVMOperationStatus `json:"operation,omitempty"`
	ResourceUsage    *CVMResourceUsage   `json:"resource_usage,omitempty"`
}

// CVMState represents the state of a CVM.
type CVMState = GenericObject

// CVMStats represents CVM statistics.
type CVMStats = GenericObject

// CVMNetwork represents CVM network information.
type CVMNetwork = GenericObject

// CVMContainersStats represents CVM container statistics.
type CVMContainersStats = GenericObject

// CVMUserConfig represents CVM user configuration: hostname,
// ssh_authorized_keys, default_gateway_domain and, when the CVM's compose
// carries requirements.launch_token_hash, the app's launch_token.
type CVMUserConfig = GenericObject

// CVMActionResponseFields contains shared lifecycle action response fields.
type CVMActionResponseFields struct {
	Name          string `json:"name,omitempty"`
	Status        string `json:"status,omitempty"`
	CorrelationID string `json:"correlation_id,omitempty"`
	// PortPolicyUnlistedPorts lists published ports absent from a restrictive
	// gateway policy after a CVM patch, including on-chain confirmation.
	PortPolicyUnlistedPorts []int `json:"port_policy_unlisted_ports,omitzero"`
}

// CVMActionResponseV20260121 is a lifecycle action response before hashed CVM IDs.
type CVMActionResponseV20260121 struct {
	ID int `json:"id,omitempty"`
	CVMActionResponseFields
}

// CVMActionResponseV20260522 is a lifecycle action response with hashed CVM IDs.
type CVMActionResponseV20260522 struct {
	ID string `json:"id,omitempty"`
	CVMActionResponseFields
}

// CVMActionResponse is the latest lifecycle action response schema.
type CVMActionResponse = CVMActionResponseV20260522

// ReplicateCVMOptions holds options for replicating a CVM.
type ReplicateCVMOptions struct {
	// Node is the physical node name. Omit it to inherit the source CVM's placement.
	Node *string `json:"node,omitempty"`
	// OSImage pins the replica to a specific OS image slug. Empty means the
	// replica inherits the source CVM's image.
	OSImage string `json:"os_image,omitempty"`
	// EncryptedEnv is required when the source CVM has managed env enabled.
	EncryptedEnv *string `json:"encrypted_env,omitempty"`
	// ComposeHash selects which compose to replicate when the source app has
	// more than one live instance.
	ComposeHash *string  `json:"compose_hash,omitempty"`
	KMSURLs     []string `json:"kms_urls,omitzero"`
	GatewayURLs []string `json:"gateway_urls,omitzero"`
}

// CommitCVMUpdateRequest identifies a prepared update and its on-chain transaction.
type CommitCVMUpdateRequest struct {
	Token           string `json:"token"`
	ComposeHash     string `json:"compose_hash"`
	TransactionHash string `json:"transaction_hash"`

	// ConfirmFinalityReplacement sets X-Confirm-Finality-Replacement. Empty sends
	// no header: a new update silently replaces a waiting one. Use
	// ConfirmFinalityReplacementNone to get a 412 (see
	// APIError.FinalityReplacementRequired) instead of replacing it, or the
	// waiting update's correlation ID to confirm the replacement.
	ConfirmFinalityReplacement string `json:"-"`
}

// CommitCVMUpdateResponse identifies the resulting update operation.
type CommitCVMUpdateResponse struct {
	CorrelationID string `json:"correlation_id"`
	Status        string `json:"status"`
}

// GPUSpec selects one GPU device by its PCI slot.
type GPUSpec struct {
	Slot      string  `json:"slot"`
	ProductID *string `json:"product_id,omitempty"`
}

// GPUConfig is the GPU assignment for a CVM update. GPUs lists the slots to
// attach; AttachMode "all" attaches every GPU on the node instead. The API
// default for AttachMode is "listed".
type GPUConfig struct {
	GPUs       []GPUSpec `json:"gpus"`
	AttachMode *string   `json:"attach_mode,omitempty"`
}

// MarshalJSON sends a nil GPUs slice as [] because the API requires the
// gpus array even when AttachMode is "all".
func (g GPUConfig) MarshalJSON() ([]byte, error) {
	type plain GPUConfig
	if g.GPUs == nil {
		g.GPUs = []GPUSpec{}
	}
	return json.Marshal(plain(g))
}

// InitScriptSlug names an init script provided by Phala Cloud. Phala Cloud
// owns the list of scripts, their run order and the selection rules, and the
// server rejects names it does not know. The SDK sends any name as is and does
// not validate it. The constants below are the names known today, not a closed
// set; GetCVMInitScripts returns what a CVM can select.
type InitScriptSlug string

const (
	// InitScriptDockerCleanup erases all local container-runtime stores on
	// every boot.
	InitScriptDockerCleanup InitScriptSlug = "docker_cleanup"
	// InitScriptRuntimeTmpfs mounts the Docker and containerd runtime
	// directories on tmpfs, so container state lives in memory and never on
	// the data disk. Needs dstack OS 0.6.x.
	InitScriptRuntimeTmpfs InitScriptSlug = "runtime_tmpfs"
	// InitScriptEnvMerge merges encrypted env on boot.
	InitScriptEnvMerge InitScriptSlug = "env_merge"
)

// ComposeRequirementsPatch is the requirements part of a ComposePatch; it
// merges per key. gpu_policy is not patchable: the stored value is kept.
type ComposeRequirementsPatch struct {
	// EphemeralDataDisk formats the data disk on every boot (OS 0.6.3+).
	// Turning it on requires ConfirmDataWipe.
	EphemeralDataDisk Patch[bool]   `json:"ephemeral_data_disk,omitzero"`
	HealthCheck       Patch[bool]   `json:"health_check,omitzero"`
	HealthStatusFile  Patch[string] `json:"health_status_file,omitzero"`
	// LaunchTokenHash must be the hash of the app's launch token (see
	// SetAppLaunchToken).
	LaunchTokenHash      Patch[string]   `json:"launch_token_hash,omitzero"`
	Platforms            Patch[[]string] `json:"platforms,omitzero"`
	TDXMeasureACPITables Patch[bool]     `json:"tdx_measure_acpi_tables,omitzero"`
}

// ComposePatch is a JSON Merge Patch of a CVM's app compose, sent as
// PatchCVMRequest.Compose. Only keys set with PatchValue or PatchNull are
// sent, so an explicit default and an unset key stay distinct (they hash
// differently).
type ComposePatch struct {
	// BashScript replaces the script of a bash-runner app. Null is rejected
	// for a bash app.
	BashScript     Patch[string] `json:"bash_script,omitzero"`
	SecureTime     Patch[bool]   `json:"secure_time,omitzero"`
	SwapSize       Patch[string] `json:"swap_size,omitzero"`
	StorageDiscard Patch[bool]   `json:"storage_discard,omitzero"`
	// Snapshotter is "overlayfs" or "stargz", only with the nerdctl-compose runner.
	Snapshotter     Patch[string]                   `json:"snapshotter,omitzero"`
	GatewayEnabled  Patch[bool]                     `json:"gateway_enabled,omitzero"`
	PortPolicy      Patch[ComposePortPolicy]        `json:"port_policy,omitzero"`
	EventLogVersion Patch[int]                      `json:"event_log_version,omitzero"`
	Requirements    Patch[ComposeRequirementsPatch] `json:"requirements,omitzero"`

	// Fixed when the CVM is created: the current value passes, any other is rejected.
	KMSEnabled              Patch[bool]            `json:"kms_enabled,omitzero"`
	KeyProvider             Patch[string]          `json:"key_provider,omitzero"`
	KeyProviderID           Patch[string]          `json:"key_provider_id,omitzero"`
	LocalKeyProviderEnabled Patch[bool]            `json:"local_key_provider_enabled,omitzero"`
	ManifestVersion         Patch[json.RawMessage] `json:"manifest_version,omitzero"`
	NoInstanceID            Patch[bool]            `json:"no_instance_id,omitzero"`
	Runner                  Patch[string]          `json:"runner,omitzero"`
	StorageFS               Patch[string]          `json:"storage_fs,omitzero"`
	VerityVolumes           Patch[[]VerityVolume]  `json:"verity_volumes,omitzero"`
	TproxyEnabled           Patch[bool]            `json:"tproxy_enabled,omitzero"`
	Features                Patch[[]string]        `json:"features,omitzero"`
}

// PatchCVMRequest is the request for patching a CVM (multi-field update) via
// PATCH /cvms/{id}. Only set fields are sent.
type PatchCVMRequest struct {
	// Compose-hash-affecting fields.
	DockerComposeFile *string  `json:"docker_compose_file,omitempty"`
	PreLaunchScript   *string  `json:"pre_launch_script,omitempty"`
	AllowedEnvs       []string `json:"allowed_envs,omitzero"`
	PublicSysinfo     *bool    `json:"public_sysinfo,omitempty"`
	PublicLogs        *bool    `json:"public_logs,omitempty"`
	PublicTcbinfo     *bool    `json:"public_tcbinfo,omitempty"`

	// Compose is a JSON Merge Patch of the app compose.
	Compose *ComposePatch `json:"compose,omitempty"`
	// GuestAgentGatewayAccess confirms blocking gateway access to port 8090.
	// Send "closed".
	GuestAgentGatewayAccess *string `json:"guest_agent_gateway_access,omitempty"`
	// ExpectedComposeHash rejects a change if this is no longer the CVM's stored compose hash.
	ExpectedComposeHash *string `json:"expected_compose_hash,omitempty"`
	// InitScripts replaces, by name, the init scripts provided by Phala Cloud
	// that the CVM runs. The server validates the names and fixes the order. nil leaves them
	// unchanged; an empty non-nil slice removes them all.
	InitScripts []InitScriptSlug `json:"init_scripts,omitzero"`
	// ConfirmDataWipe confirms turning on docker_cleanup, runtime_tmpfs or
	// requirements.ephemeral_data_disk, which erase data on every boot.
	ConfirmDataWipe bool `json:"confirm_data_wipe,omitempty"`

	EncryptedEnv *string    `json:"encrypted_env,omitempty"`
	UserConfig   *string    `json:"user_config,omitempty"`
	GPUs         *GPUConfig `json:"gpus,omitempty"`

	VCPU         *int    `json:"vcpu,omitempty"`
	Memory       *int    `json:"memory,omitempty"`
	DiskSize     *int    `json:"disk_size,omitempty"`
	InstanceType *string `json:"instance_type,omitempty"`

	// Image is the OS image name or slug, as listed by GetAvailableOSImages.
	Image *string `json:"image,omitempty"`

	// ShutdownTimeout is the graceful shutdown timeout in seconds (10-1200).
	// PatchNull uses the platform default.
	ShutdownTimeout Patch[int] `json:"shutdown_timeout,omitzero"`
	AllowForceStop  *bool      `json:"allow_force_stop,omitempty"`

	// Deprecated: use Image. PatchCVM sends OSImageName as image.
	OSImageName *string `json:"-"`

	// PrepareOnly sends X-Prepare-Only: true. For contract-owned KMS, the
	// hash-required response then carries a commit token for multisig
	// approval (see CommitCVMUpdate).
	PrepareOnly bool `json:"-"`

	// ConfirmFinalityReplacement sets X-Confirm-Finality-Replacement. Empty sends
	// no header: a new update silently replaces a waiting one. Use
	// ConfirmFinalityReplacementNone to get a 412 (see
	// APIError.FinalityReplacementRequired) instead of replacing it, or the
	// waiting update's correlation ID to confirm the replacement.
	ConfirmFinalityReplacement string `json:"-"`
}

// OnchainStatus reports whether the compose hash and device are already
// allowed on-chain. The API includes it in prepare-only responses.
type OnchainStatus struct {
	ComposeHashAllowed bool `json:"compose_hash_allowed"`
	DeviceIDAllowed    bool `json:"device_id_allowed"`
	IsAllowed          bool `json:"is_allowed"`
}

// PatchCVMResponse is the response from patching a CVM. When
// RequiresOnChainHash is true the API answered 465: register ComposeHash
// on-chain, then call ConfirmCVMPatch, or CommitCVMUpdate with CommitToken
// for a prepare-only request.
type PatchCVMResponse struct {
	RequiresOnChainHash bool                   `json:"requires_on_chain_hash"`
	CorrelationID       string                 `json:"correlation_id,omitempty"`
	Status              string                 `json:"status,omitempty"`
	Message             string                 `json:"message,omitempty"`
	ComposeHash         string                 `json:"compose_hash,omitempty"`
	AppID               string                 `json:"app_id,omitempty"`
	DeviceID            string                 `json:"device_id,omitempty"`
	KMSInfo             *KMSInfo               `json:"kms_info,omitempty"`
	CommitToken         string                 `json:"commit_token,omitempty"`
	CommitURL           string                 `json:"commit_url,omitempty"`
	APICommitURL        string                 `json:"api_commit_url,omitempty"`
	OnchainStatus       *OnchainStatus         `json:"onchain_status,omitempty"`
	FinalityWait        *CVMFinalityWaitStatus `json:"finality_wait,omitempty"`
	// PortPolicyUnlistedPorts lists published ports absent from a restrictive gateway policy.
	PortPolicyUnlistedPorts []int `json:"port_policy_unlisted_ports,omitzero"`
}

// CVMFinalityWaitStatus is Phala Cloud's view of an accepted on-chain operation.
// Strings are open; the server may add values.
type CVMFinalityWaitStatus struct {
	Operation     string                      `json:"operation"`
	CorrelationID string                      `json:"correlation_id"`
	Phase         string                      `json:"phase"`
	Stage         string                      `json:"stage"`
	Stages        []string                    `json:"stages,omitempty"`
	Transaction   *CVMFinalityWaitTransaction `json:"transaction"`
	Finality      CVMFinalityWaitProgress     `json:"finality"`
}

type CVMFinalityWaitTransaction struct {
	Hash        string `json:"hash"`
	BlockNumber int    `json:"block_number"`
	ChainID     int    `json:"chain_id"`
}

type CVMFinalityWaitProgress struct {
	BlockTag          *string `json:"block_tag"`
	PolicyBlockNumber *int    `json:"policy_block_number"`
	BlocksRemaining   *int    `json:"blocks_remaining"`
	ETASeconds        *int    `json:"eta_seconds"`
}

// CVMFinalityFailure is a terminal on-chain failure for a CVM.
type CVMFinalityFailure struct {
	Operation     string `json:"operation"`
	CorrelationID string `json:"correlation_id"`
	FailureReason string `json:"failure_reason"`
	FailedAt      string `json:"failed_at"`
}

// ConfirmCVMPatchRequest is the request for confirming a CVM patch with on-chain hash.
type ConfirmCVMPatchRequest struct {
	ComposeHash     string `json:"compose_hash"`
	TransactionHash string `json:"transaction_hash"`

	// ConfirmFinalityReplacement sets X-Confirm-Finality-Replacement. Empty sends
	// no header: a new update silently replaces a waiting one. Use
	// ConfirmFinalityReplacementNone to get a 412 (see
	// APIError.FinalityReplacementRequired) instead of replacing it, or the
	// waiting update's correlation ID to confirm the replacement.
	ConfirmFinalityReplacement string `json:"-"`
}

// CVMAttestation represents CVM attestation data.
type CVMAttestation struct {
	Name            *string       `json:"name,omitempty"`
	IsOnline        bool          `json:"is_online"`
	IsPublic        bool          `json:"is_public"`
	Error           *string       `json:"error,omitempty"`
	AppCertificates []Certificate `json:"app_certificates,omitempty"`
	TCBInfo         *TcbInfo      `json:"tcb_info,omitempty"`
	ComposeFile     *string       `json:"compose_file,omitempty"`
}

// Certificate represents a TLS certificate.
type Certificate struct {
	Subject            CertificateSubject `json:"subject"`
	Issuer             CertificateIssuer  `json:"issuer"`
	SerialNumber       string             `json:"serial_number"`
	NotBefore          string             `json:"not_before"`
	NotAfter           string             `json:"not_after"`
	Version            string             `json:"version"`
	Fingerprint        string             `json:"fingerprint"`
	SignatureAlgorithm string             `json:"signature_algorithm"`
	SANs               []string           `json:"sans,omitempty"`
	IsCA               bool               `json:"is_ca"`
	PositionInChain    *int               `json:"position_in_chain,omitempty"`
	Quote              *string            `json:"quote,omitempty"`
	AppID              *string            `json:"app_id,omitempty"`
	CertUsage          *string            `json:"cert_usage,omitempty"`
}

// CertificateSubject holds certificate subject fields.
type CertificateSubject struct {
	CommonName   *string `json:"common_name,omitempty"`
	Organization *string `json:"organization,omitempty"`
	Country      *string `json:"country,omitempty"`
	State        *string `json:"state,omitempty"`
	Locality     *string `json:"locality,omitempty"`
}

// CertificateIssuer holds certificate issuer fields.
type CertificateIssuer struct {
	CommonName   *string `json:"common_name,omitempty"`
	Organization *string `json:"organization,omitempty"`
	Country      *string `json:"country,omitempty"`
}

// TcbInfo holds TCB info fields.
type TcbInfo struct {
	MRTD       string     `json:"mrtd"`
	RootfsHash *string    `json:"rootfs_hash,omitempty"`
	RTMR0      string     `json:"rtmr0"`
	RTMR1      string     `json:"rtmr1"`
	RTMR2      string     `json:"rtmr2"`
	RTMR3      string     `json:"rtmr3"`
	EventLog   []EventLog `json:"event_log,omitempty"`
	AppCompose string     `json:"app_compose"`
}

// EventLog holds an event log entry.
type EventLog struct {
	IMR          int    `json:"imr"`
	EventType    int    `json:"event_type"`
	Digest       string `json:"digest"`
	Event        string `json:"event"`
	EventPayload string `json:"event_payload"`
}

// IsAllowedResultFields contains shared allowance check fields.
type IsAllowedResultFields struct {
	AppContractAddress string  `json:"app_contract_address"`
	ComposeHash        string  `json:"compose_hash"`
	DeviceID           string  `json:"device_id"`
	ComposeHashAllowed bool    `json:"compose_hash_allowed"`
	AllowAnyDevice     bool    `json:"allow_any_device"`
	DeviceIDAllowed    *bool   `json:"device_id_allowed,omitempty"`
	IsAllowed          bool    `json:"is_allowed"`
	Error              *string `json:"error,omitempty"`
}

// IsAllowedResultV20260121 is an allowance check result before hashed CVM IDs.
type IsAllowedResultV20260121 struct {
	CvmID int `json:"cvm_id,omitempty"`
	IsAllowedResultFields
}

// IsAllowedResultV20260522 is an allowance check result with hashed CVM IDs.
type IsAllowedResultV20260522 struct {
	CvmID string `json:"cvm_id,omitempty"`
	IsAllowedResultFields
}

// IsAllowedResult is the latest allowance check result schema.
type IsAllowedResult = IsAllowedResultV20260522

// CheckCvmIsAllowedRequest is the request for checking CVM on-chain allowance.
type CheckCvmIsAllowedRequest struct {
	ComposeHash *string `json:"compose_hash,omitempty"`
	// Node is the physical node name.
	Node     *string `json:"node,omitempty"`
	DeviceID *string `json:"device_id,omitempty"`
}

// CheckAppIsAllowedRequest is the request for checking app contract allowance.
type CheckAppIsAllowedRequest struct {
	ComposeHash string `json:"compose_hash"`
	// Node is the physical node name.
	Node     *string `json:"node,omitempty"`
	DeviceID *string `json:"device_id,omitempty"`
	ChainID  *int    `json:"chain_id,omitempty"`
}

// AppCvmsBatchIsAllowedResponseFields contains shared batch allowance fields.
type AppCvmsBatchIsAllowedResponseFields struct {
	IsOnchain    bool `json:"is_onchain"`
	Total        int  `json:"total"`
	AllowedCount int  `json:"allowed_count"`
	DeniedCount  int  `json:"denied_count"`
	ErrorCount   int  `json:"error_count"`
}

// AppCvmsBatchIsAllowedResponseV20260121 is the batch response before hashed CVM IDs.
type AppCvmsBatchIsAllowedResponseV20260121 struct {
	AppCvmsBatchIsAllowedResponseFields
	Results       []IsAllowedResultV20260121 `json:"results"`
	SkippedCvmIDs []int                      `json:"skipped_cvm_ids"`
}

// AppCvmsBatchIsAllowedResponseV20260522 is the batch response with hashed CVM IDs.
type AppCvmsBatchIsAllowedResponseV20260522 struct {
	AppCvmsBatchIsAllowedResponseFields
	Results       []IsAllowedResultV20260522 `json:"results"`
	SkippedCvmIDs []string                   `json:"skipped_cvm_ids"`
}

// AppCvmsBatchIsAllowedResponse is the latest batch allowance schema.
type AppCvmsBatchIsAllowedResponse = AppCvmsBatchIsAllowedResponseV20260522

// OSImage represents an available OS image.
type OSImage struct {
	Name        string  `json:"name"`
	Slug        string  `json:"slug,omitempty"`
	Version     string  `json:"version,omitempty"`
	OSImageHash *string `json:"os_image_hash,omitempty"`
	IsDev       bool    `json:"is_dev,omitempty"`
	RequiresGPU bool    `json:"requires_gpu,omitempty"`
}
