package phala

// CreateAppInstanceRequest is the request body for creating an app instance.
type CreateAppInstanceRequest struct {
	Name              *string `json:"name,omitempty"`
	NodeID            *int    `json:"node_id,omitempty"`
	DockerComposeFile *string `json:"docker_compose_file,omitempty"`
	PreLaunchScript   *string `json:"pre_launch_script,omitempty"`
	EncryptedEnv      *string `json:"encrypted_env,omitempty"`
	ComposeHash       *string `json:"compose_hash,omitempty"`
	Token             *string `json:"token,omitempty"`
	TransactionHash   *string `json:"transaction_hash,omitempty"`
}

// AppInfoFields contains fields shared by versioned app response schemas.
type AppInfoFields struct {
	ID               string      `json:"id"`
	Name             string      `json:"name"`
	AppID            string      `json:"app_id"`
	AppProvisionType *string     `json:"app_provision_type,omitempty"`
	AppIconURL       *string     `json:"app_icon_url,omitempty"`
	CreatedAt        string      `json:"created_at"`
	KMSType          string      `json:"kms_type"`
	Profile          *AppProfile `json:"profile,omitempty"`
	CVMCount         int         `json:"cvm_count"`
}

// AppInfoV20260121 represents app information before hashed CVM IDs.
type AppInfoV20260121 struct {
	AppInfoFields
	CurrentCVM *CVMInfoV20260121  `json:"current_cvm,omitempty"`
	CVMs       []CVMInfoV20260121 `json:"cvms,omitempty"`
}

// AppInfoV20260522 represents app information with hashed CVM IDs.
type AppInfoV20260522 struct {
	AppInfoFields
	CurrentCVM *CVMInfoV20260522  `json:"current_cvm,omitempty"`
	CVMs       []CVMInfoV20260522 `json:"cvms,omitempty"`
}

// AppInfo is the latest app information schema.
type AppInfo = AppInfoV20260522

// AppProfile represents an app profile.
type AppProfile struct {
	DisplayName  *string `json:"display_name,omitempty"`
	AvatarURL    *string `json:"avatar_url,omitempty"`
	Description  *string `json:"description,omitempty"`
	CustomDomain *string `json:"custom_domain,omitempty"`
}

// GetAppListResponseFields contains shared app list pagination fields.
type GetAppListResponseFields struct {
	Page       int `json:"page"`
	PageSize   int `json:"page_size"`
	Total      int `json:"total"`
	TotalPages int `json:"total_pages"`
}

// GetAppListResponseV20260121 is the app list response before hashed CVM IDs.
type GetAppListResponseV20260121 struct {
	DstackApps []AppInfoV20260121 `json:"dstack_apps"`
	GetAppListResponseFields
}

// GetAppListResponseV20260522 is the app list response with hashed CVM IDs.
type GetAppListResponseV20260522 struct {
	DstackApps []AppInfoV20260522 `json:"dstack_apps"`
	GetAppListResponseFields
}

// GetAppListResponse is the latest app list response schema.
type GetAppListResponse = GetAppListResponseV20260522

// AppRevision represents an app revision.
type AppRevision struct {
	RevisionID    string        `json:"revision_id"`
	AppID         string        `json:"app_id"`
	VMUUID        string        `json:"vm_uuid"`
	ComposeHash   string        `json:"compose_hash"`
	CreatedAt     string        `json:"created_at"`
	TraceID       *string       `json:"trace_id,omitempty"`
	OperationType string        `json:"operation_type"`
	TriggeredBy   *UserRef      `json:"triggered_by,omitempty"`
	CVM           *CvmRef       `json:"cvm,omitempty"`
	Workspace     *WorkspaceRef `json:"workspace,omitempty"`
}

// AppRevisionDetail represents detailed app revision information.
type AppRevisionDetail struct {
	RevisionID    string        `json:"revision_id"`
	AppID         string        `json:"app_id"`
	VMUUID        string        `json:"vm_uuid"`
	ComposeHash   string        `json:"compose_hash"`
	ComposeFile   any           `json:"compose_file,omitempty"`
	EncryptedEnv  string        `json:"encrypted_env"`
	UserConfig    string        `json:"user_config"`
	CreatedAt     string        `json:"created_at"`
	TraceID       *string       `json:"trace_id,omitempty"`
	OperationType string        `json:"operation_type"`
	TriggeredBy   *UserRef      `json:"triggered_by,omitempty"`
	CVM           *CvmRef       `json:"cvm,omitempty"`
	Workspace     *WorkspaceRef `json:"workspace,omitempty"`
}

// AppRevisionsResponse is the response for listing app revisions.
type AppRevisionsResponse struct {
	Revisions  []AppRevision `json:"revisions"`
	Total      int           `json:"total"`
	Page       int           `json:"page"`
	PageSize   int           `json:"page_size"`
	TotalPages int           `json:"total_pages"`
}

// AppAttestationResponse is the response for getting app attestation.
type AppAttestationResponse = GenericObject

// DeviceAllowlistItemFields contains shared device allowlist fields.
type DeviceAllowlistItemFields struct {
	DeviceID       string  `json:"device_id"`
	NodeName       *string `json:"node_name,omitempty"`
	AllowedOnchain bool    `json:"allowed_onchain"`
	Status         string  `json:"status"`
}

// DeviceAllowlistItemV20260121 is a device allowlist item before hashed CVM IDs.
type DeviceAllowlistItemV20260121 struct {
	DeviceAllowlistItemFields
	CVMIDs []int `json:"cvm_ids,omitempty"`
}

// DeviceAllowlistItemV20260522 is a device allowlist item with hashed CVM IDs.
type DeviceAllowlistItemV20260522 struct {
	DeviceAllowlistItemFields
	CVMIDs []string `json:"cvm_ids,omitempty"`
}

// DeviceAllowlistItem is the latest device allowlist item schema.
type DeviceAllowlistItem = DeviceAllowlistItemV20260522

// DeviceAllowlistResponseFields contains shared device allowlist response fields.
type DeviceAllowlistResponseFields struct {
	IsOnchainKMS       bool    `json:"is_onchain_kms"`
	AllowAnyDevice     *bool   `json:"allow_any_device,omitempty"`
	ChainID            *int    `json:"chain_id,omitempty"`
	AppContractAddress *string `json:"app_contract_address,omitempty"`
}

// DeviceAllowlistResponseV20260121 is the device allowlist response before hashed CVM IDs.
type DeviceAllowlistResponseV20260121 struct {
	DeviceAllowlistResponseFields
	Devices []DeviceAllowlistItemV20260121 `json:"devices,omitempty"`
}

// DeviceAllowlistResponseV20260522 is the device allowlist response with hashed CVM IDs.
type DeviceAllowlistResponseV20260522 struct {
	DeviceAllowlistResponseFields
	Devices []DeviceAllowlistItemV20260522 `json:"devices,omitempty"`
}

// DeviceAllowlistResponse is the latest device allowlist response schema.
type DeviceAllowlistResponse = DeviceAllowlistResponseV20260522

// AppFilterOptions is the response for getting app filter options.
type AppFilterOptions = GenericObject
