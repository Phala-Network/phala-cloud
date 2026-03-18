package phala

import (
	"context"
	"fmt"
	"net/url"
)

// ListWorkspaces returns the list of workspaces.
func (c *Client) ListWorkspaces(ctx context.Context) (*ListWorkspacesResponse, error) {
	var result ListWorkspacesResponse
	if err := c.doJSON(ctx, "GET", "/workspaces", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetWorkspace returns information about a workspace.
func (c *Client) GetWorkspace(ctx context.Context, slug string) (*Workspace, error) {
	var result Workspace
	if err := c.doJSON(ctx, "GET", "/workspaces/"+slug, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetWorkspaceNodes returns nodes for a workspace.
func (c *Client) GetWorkspaceNodes(ctx context.Context, slug string, opts *PaginationOptions) (*WorkspaceNodes, error) {
	path := "/workspaces/" + slug + "/nodes"
	if opts != nil {
		q := url.Values{}
		if opts.Page != nil {
			q.Set("page", fmt.Sprintf("%d", *opts.Page))
		}
		if opts.PageSize != nil {
			q.Set("page_size", fmt.Sprintf("%d", *opts.PageSize))
		}
		if encoded := q.Encode(); encoded != "" {
			path += "?" + encoded
		}
	}
	var result WorkspaceNodes
	if err := c.doJSON(ctx, "GET", path, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetWorkspaceQuotas returns quotas for a workspace.
func (c *Client) GetWorkspaceQuotas(ctx context.Context, slug string) (*WorkspaceQuotas, error) {
	var result WorkspaceQuotas
	if err := c.doJSON(ctx, "GET", "/workspaces/"+slug+"/quotas", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
