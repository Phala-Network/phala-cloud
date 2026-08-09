package phala

// GenericObject is a generic JSON object for responses that don't have a defined type.
type GenericObject = map[string]any

// PaginationOptions holds common pagination parameters.
type PaginationOptions struct {
	Page     *int `json:"page,omitempty"`
	PageSize *int `json:"page_size,omitempty"`
}

// Paginated is a generic paginated response.
type Paginated[T any] struct {
	Items    []T `json:"items"`
	Total    int `json:"total"`
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
	Pages    int `json:"pages"`
}

// Update result statuses returned by the compose and pre-launch script update
// endpoints.
const (
	UpdateStatusInProgress           = "in_progress"
	UpdateStatusPreconditionRequired = "precondition_required"
	UpdateStatusNoChange             = "no_change"
)

// UpdateResult represents the result of an update operation that may require on-chain confirmation.
type UpdateResult struct {
	// Status discriminates the response variants: in_progress (the update was
	// accepted), precondition_required (the compose hash needs on-chain
	// registration first) and no_change (the submitted content matches what is
	// already deployed, so nothing was done).
	Status string `json:"status,omitempty"`

	// Normal success fields.
	RequiresOnChainHash *bool  `json:"requires_on_chain_hash,omitempty"`
	CorrelationID       string `json:"correlation_id,omitempty"`

	// Compose precondition fields (status 465).
	ComposeHash string `json:"compose_hash,omitempty"`
	AppID       string `json:"app_id,omitempty"`
	DeviceID    string `json:"device_id,omitempty"`
	Message     string `json:"message,omitempty"`

	// KMS info for on-chain operations.
	KMSInfo *KMSInfo `json:"kms_info,omitempty"`
}

// InProgressResponse is returned for operations that are in progress.
type InProgressResponse struct {
	RequiresOnChainHash bool   `json:"requires_on_chain_hash"`
	CorrelationID       string `json:"correlation_id,omitempty"`
}

// ComposeHashPreconditionResponse is returned when compose hash precondition fails (465).
type ComposeHashPreconditionResponse struct {
	Message     string   `json:"message"`
	ComposeHash string   `json:"compose_hash"`
	AppID       string   `json:"app_id"`
	DeviceID    string   `json:"device_id"`
	KMSInfo     *KMSInfo `json:"kms_info,omitempty"`
}
