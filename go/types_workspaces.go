package phala

// Workspace represents workspace information.
type Workspace struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Slug   *string `json:"slug,omitempty"`
	Tier   string  `json:"tier"`
	Avatar *string `json:"avatar,omitempty"`
}

// ListWorkspacesResponse is the response for listing workspaces.
type ListWorkspacesResponse = GenericObject

// WorkspaceNodes is the response for workspace nodes.
type WorkspaceNodes = GenericObject

// WorkspaceQuotas is the response for workspace quotas.
type WorkspaceQuotas = GenericObject
