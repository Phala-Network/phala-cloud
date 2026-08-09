package phala

// Workspace represents workspace information.
type Workspace struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Slug        *string `json:"slug,omitempty"`
	AvatarURL   *string `json:"avatar_url,omitempty"`
	Description *string `json:"description,omitempty"`
	Tier        string  `json:"tier"`
	Role        *string `json:"role,omitempty"`
	IsDefault   *bool   `json:"is_default,omitempty"`
	CreatedAt   *string `json:"created_at,omitempty"`

	ConfidentialModelsEnabled *bool `json:"confidential_models_enabled,omitempty"`

	// BillingStatus is the billing lifecycle state: active, suspended or
	// abandoned. A suspended workspace still runs but owes money; an abandoned
	// one is closed and read-only until its balance is settled.
	BillingStatus *string `json:"billing_status,omitempty"`
	// SuspendedAt is set only while BillingStatus is "suspended".
	SuspendedAt *string `json:"suspended_at,omitempty"`
}

// ListWorkspacesResponse is the response for listing workspaces.
type ListWorkspacesResponse = GenericObject

// WorkspaceNodes is the response for workspace nodes.
type WorkspaceNodes = GenericObject

// WorkspaceQuotas is the response for workspace quotas.
type WorkspaceQuotas = GenericObject
