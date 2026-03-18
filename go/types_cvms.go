package phala

import "fmt"

// CVMInfo represents CVM information (API version 2026-01-21).
type CVMInfo struct {
	ID             string           `json:"id"`
	Name           string           `json:"name"`
	AppID          *string          `json:"app_id,omitempty"`
	VMUUID         *string          `json:"vm_uuid,omitempty"`
	InstanceID     *string          `json:"instance_id,omitempty"`
	Resource       CvmResource      `json:"resource"`
	NodeInfo       *NodeRef         `json:"node_info,omitempty"`
	OS             *CvmOsInfo       `json:"os,omitempty"`
	KMSType        *string          `json:"kms_type,omitempty"`
	KMSInfo        *CvmKmsInfo      `json:"kms_info,omitempty"`
	Status         string           `json:"status"`
	Progress       *CvmProgressInfo `json:"progress,omitempty"`
	ComposeHash    *string          `json:"compose_hash,omitempty"`
	Gateway        *CvmGatewayInfo  `json:"gateway,omitempty"`
	Services       []any            `json:"services,omitempty"`
	PublicLogs     *bool            `json:"public_logs,omitempty"`
	PublicSysinfo  *bool            `json:"public_sysinfo,omitempty"`
	PublicTcbinfo  *bool            `json:"public_tcbinfo,omitempty"`
	GatewayEnabled *bool            `json:"gateway_enabled,omitempty"`
	SecureTime     *bool            `json:"secure_time,omitempty"`
	Listed         bool             `json:"listed"`
	StorageFS      *string          `json:"storage_fs,omitempty"`
	Workspace      *WorkspaceRef    `json:"workspace,omitempty"`
	Creator        *UserRef         `json:"creator,omitempty"`
	CreatedAt      *string          `json:"created_at,omitempty"`
	UpdatedAt      *string          `json:"updated_at,omitempty"`
	AppURL         *string          `json:"app_url,omitempty"`
	BaseImage      *string          `json:"base_image,omitempty"`
	Features       []string         `json:"features,omitempty"`
	Runner         *string          `json:"runner,omitempty"`
	ManifestVer    *string          `json:"manifest_version,omitempty"`
	ComposeFile    any              `json:"compose_file,omitempty"`

	// Additional fields used by the Terraform provider.
	InProgress         bool          `json:"in_progress,omitempty"`
	EncryptedEnvPubkey *string       `json:"encrypted_env_pubkey,omitempty"`
	DiskSize           *int64        `json:"disk_size,omitempty"`
	Endpoints          []CVMEndpoint `json:"endpoints,omitempty"`
	PublicURLs         []CVMEndpoint `json:"public_urls,omitempty"`
}

// CVMEndpoint represents a CVM endpoint URL.
type CVMEndpoint struct {
	App      string `json:"app"`
	Instance string `json:"instance"`
}

// CvmResource holds CVM resource allocation.
type CvmResource struct {
	InstanceType        *string  `json:"instance_type,omitempty"`
	VCPU                *int     `json:"vcpu,omitempty"`
	MemoryInGB          *float64 `json:"memory_in_gb,omitempty"`
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

// CvmKmsInfo holds CVM KMS information.
type CvmKmsInfo struct {
	ChainID            *int    `json:"chain_id,omitempty"`
	DstackKmsAddress   *string `json:"dstack_kms_address,omitempty"`
	DstackAppAddress   *string `json:"dstack_app_address,omitempty"`
	DeployerAddress    *string `json:"deployer_address,omitempty"`
	RPCEndpoint        *string `json:"rpc_endpoint,omitempty"`
	EncryptedEnvPubkey *string `json:"encrypted_env_pubkey,omitempty"`
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
	ObjectType string  `json:"object_type"`
	ID         *int    `json:"id,omitempty"`
	Name       *string `json:"name,omitempty"`
	Region     *string `json:"region,omitempty"`
	DeviceID   *string `json:"device_id,omitempty"`
	PPID       *string `json:"ppid,omitempty"`
	Status     *string `json:"status,omitempty"`
	Version    *string `json:"version,omitempty"`
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

// PaginatedCVMInfos is a paginated list of CVM infos.
type PaginatedCVMInfos = Paginated[CVMInfo]

// GetCVMListOptions holds query parameters for listing CVMs.
type GetCVMListOptions struct {
	Page     *int `json:"page,omitempty"`
	PageSize *int `json:"page_size,omitempty"`
}

// ProvisionCVMRequest is the request body for provisioning a CVM.
type ProvisionCVMRequest struct {
	Name         string       `json:"name"`
	InstanceType string       `json:"instance_type"`
	ComposeFile  *ComposeFile `json:"compose_file,omitempty"`

	// Optional fields.
	VCPU              *int     `json:"vcpu,omitempty"`
	Memory            *int     `json:"memory,omitempty"`
	DiskSize          *int     `json:"disk_size,omitempty"`
	TeepodID          *int     `json:"teepod_id,omitempty"`
	Image             *string  `json:"image,omitempty"`
	Region            *string  `json:"region,omitempty"`
	KMSType           *string  `json:"kms_type,omitempty"`
	Listed            *bool    `json:"listed,omitempty"`
	Encrypted         *bool    `json:"encrypted,omitempty"`
	SecureTime        *bool    `json:"secure_time,omitempty"`
	SSHAuthorizedKeys []string `json:"ssh_authorized_keys,omitempty"`
	CustomAppID       *string  `json:"custom_app_id,omitempty"`
	Nonce             *int64   `json:"nonce,omitempty"`
	StorageFS         *string  `json:"storage_fs,omitempty"`
}

// ComposeFile represents a compose file configuration.
type ComposeFile struct {
	Name              string  `json:"name"`
	DockerComposeFile string  `json:"docker_compose_file"`
	GatewayEnabled    *bool   `json:"gateway_enabled,omitempty"`
	PreLaunchScript   *string `json:"pre_launch_script,omitempty"`
	EncryptedEnv      *string `json:"encrypted_env,omitempty"`
	EnvKeys           *string `json:"env_keys,omitempty"`
	PublicLogs        *bool   `json:"public_logs,omitempty"`
	PublicSysinfo     *bool   `json:"public_sysinfo,omitempty"`
	PublicTcbinfo     *bool   `json:"public_tcbinfo,omitempty"`
	SecureTime        *bool   `json:"secure_time,omitempty"`
	StorageFS         *string `json:"storage_fs,omitempty"`
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
	KMSID               string      `json:"kms_id,omitempty"`
}

// CommitCVMProvisionRequest is the request for committing a CVM provision.
type CommitCVMProvisionRequest struct {
	AppID           string   `json:"app_id"`
	ComposeHash     string   `json:"compose_hash"`
	TransactionHash *string  `json:"transaction_hash,omitempty"`
	EncryptedEnv    *string  `json:"encrypted_env,omitempty"`
	EnvKeys         []string `json:"env_keys,omitempty"`
}

// CommitCVMProvisionResponse is the response from committing a CVM provision.
type CommitCVMProvisionResponse struct {
	ID     any    `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

// CvmID returns the CVM ID as a string.
func (r *CommitCVMProvisionResponse) CvmID() string {
	if r.ID == nil {
		return ""
	}
	return fmt.Sprintf("%v", r.ID)
}

// CVMState represents the state of a CVM.
type CVMState = GenericObject

// CVMStats represents CVM statistics.
type CVMStats = GenericObject

// CVMNetwork represents CVM network information.
type CVMNetwork = GenericObject

// CVMContainersStats represents CVM container statistics.
type CVMContainersStats = GenericObject

// CVMUserConfig represents CVM user configuration.
type CVMUserConfig = GenericObject

// CVMActionResponse is the generic response for CVM lifecycle actions.
type CVMActionResponse struct {
	ID     any    `json:"id,omitempty"`
	Name   string `json:"name,omitempty"`
	Status string `json:"status,omitempty"`
}

// ReplicateCVMOptions holds options for replicating a CVM.
type ReplicateCVMOptions struct {
	NodeID *int `json:"node_id,omitempty"`
}

// PatchCVMRequest is the request for patching a CVM (multi-field update).
type PatchCVMRequest struct {
	DockerComposeFile *string `json:"docker_compose_file,omitempty"`
	PreLaunchScript   *string `json:"pre_launch_script,omitempty"`
	EncryptedEnv      *string `json:"encrypted_env,omitempty"`
	EnvKeys           *string `json:"env_keys,omitempty"`
	PublicSysinfo     *bool   `json:"public_sysinfo,omitempty"`
	PublicLogs        *bool   `json:"public_logs,omitempty"`
	PublicTcbinfo     *bool   `json:"public_tcbinfo,omitempty"`
	GatewayEnabled    *bool   `json:"gateway_enabled,omitempty"`
	SecureTime        *bool   `json:"secure_time,omitempty"`
	Listed            *bool   `json:"listed,omitempty"`
	VCPU              *int    `json:"vcpu,omitempty"`
	Memory            *int    `json:"memory,omitempty"`
	DiskSize          *int    `json:"disk_size,omitempty"`
	InstanceType      *string `json:"instance_type,omitempty"`
	OSImageName       *string `json:"os_image_name,omitempty"`
	AllowRestart      *bool   `json:"allow_restart,omitempty"`
}

// PatchCVMResponse is the response from patching a CVM.
type PatchCVMResponse struct {
	RequiresOnChainHash bool        `json:"requires_on_chain_hash"`
	CorrelationID       string      `json:"correlation_id,omitempty"`
	ComposeHash         string      `json:"compose_hash,omitempty"`
	AppID               string      `json:"app_id,omitempty"`
	DeviceID            string      `json:"device_id,omitempty"`
	KMSInfo             *CvmKmsInfo `json:"kms_info,omitempty"`
}

// ConfirmCVMPatchRequest is the request for confirming a CVM patch with on-chain hash.
type ConfirmCVMPatchRequest struct {
	ComposeHash     string `json:"compose_hash"`
	TransactionHash string `json:"transaction_hash"`
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

// CVMVisibility holds CVM visibility settings.
type CVMVisibility struct {
	PublicSysinfo *bool `json:"public_sysinfo,omitempty"`
	PublicLogs    *bool `json:"public_logs,omitempty"`
	PublicTcbinfo *bool `json:"public_tcbinfo,omitempty"`
}

// OSImage represents an available OS image.
type OSImage struct {
	Name        string  `json:"name"`
	Slug        string  `json:"slug,omitempty"`
	Version     string  `json:"version,omitempty"`
	OSImageHash *string `json:"os_image_hash,omitempty"`
	IsDev       bool    `json:"is_dev,omitempty"`
	RequiresGPU bool    `json:"requires_gpu,omitempty"`
}
