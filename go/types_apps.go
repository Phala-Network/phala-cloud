package phala

// AppInfo represents application information.
type AppInfo struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	AppID            string   `json:"app_id"`
	AppProvisionType *string  `json:"app_provision_type,omitempty"`
	AppIconURL       *string  `json:"app_icon_url,omitempty"`
	CreatedAt        string   `json:"created_at"`
	KMSType          string   `json:"kms_type"`
	Profile          *AppProfile `json:"profile,omitempty"`
	CurrentCVM       *CVMInfo `json:"current_cvm,omitempty"`
	CVMs             []CVMInfo `json:"cvms,omitempty"`
	CVMCount         int      `json:"cvm_count"`
}

// AppProfile represents an app profile.
type AppProfile struct {
	DisplayName  *string `json:"display_name,omitempty"`
	AvatarURL    *string `json:"avatar_url,omitempty"`
	Description  *string `json:"description,omitempty"`
	CustomDomain *string `json:"custom_domain,omitempty"`
}

// GetAppListResponse is the response for listing apps.
type GetAppListResponse struct {
	DstackApps []AppInfo `json:"dstack_apps"`
	Page       int       `json:"page"`
	PageSize   int       `json:"page_size"`
	Total      int       `json:"total"`
	TotalPages int       `json:"total_pages"`
}

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

// DeviceAllowlistItem represents an item in the device allowlist.
type DeviceAllowlistItem struct {
	DeviceID       string `json:"device_id"`
	NodeName       *string `json:"node_name,omitempty"`
	CVMIDs         []int  `json:"cvm_ids,omitempty"`
	AllowedOnchain bool   `json:"allowed_onchain"`
	Status         string `json:"status"`
}

// DeviceAllowlistResponse is the response for getting app device allowlist.
type DeviceAllowlistResponse struct {
	IsOnchainKMS       bool                  `json:"is_onchain_kms"`
	AllowAnyDevice     *bool                 `json:"allow_any_device,omitempty"`
	ChainID            *int                  `json:"chain_id,omitempty"`
	AppContractAddress *string               `json:"app_contract_address,omitempty"`
	Devices            []DeviceAllowlistItem `json:"devices,omitempty"`
}

// AppFilterOptions is the response for getting app filter options.
type AppFilterOptions = GenericObject
