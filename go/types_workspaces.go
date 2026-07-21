package phala

// Workspace represents workspace information.
type Workspace struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Slug   *string `json:"slug,omitempty"`
	Tier   string  `json:"tier"`
	Avatar *string `json:"avatar,omitempty"`
	// Features contains workspace-scoped feature flags. Populated by
	// GET /workspaces/{slug} for browser-session requests; empty for
	// API-key requests and list items.
	Features []FeatureFlag `json:"features,omitempty"`
	// Viewer is the current browser-session viewer with account-scoped
	// feature flags. Nil for API-key requests and list items.
	Viewer *WorkspaceViewer `json:"viewer,omitempty"`
}

// WorkspaceViewer is the browser-session viewer returned by workspace bootstrap.
type WorkspaceViewer struct {
	User     UserInfo      `json:"user"`
	Features []FeatureFlag `json:"features,omitempty"`
}

// ListWorkspacesResponse is the response for listing workspaces.
type ListWorkspacesResponse = GenericObject

// WorkspaceNodes is the response for workspace nodes.
type WorkspaceNodes = GenericObject

// WorkspaceQuotas is the response for workspace quotas.
type WorkspaceQuotas = GenericObject
