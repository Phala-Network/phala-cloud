package phala

import (
	"context"
	"fmt"
	"net/url"
)

// GetAppList returns the list of applications.
func (c *Client) GetAppList(ctx context.Context) (*GetAppListResponse, error) {
	var result GetAppListResponse
	if err := c.doJSON(ctx, "GET", "/apps", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetAppInfo returns information about a specific application.
func (c *Client) GetAppInfo(ctx context.Context, appID string) (*AppInfo, error) {
	var result AppInfo
	if err := c.doJSON(ctx, "GET", "/apps/"+appID, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetAppCVMs returns CVMs associated with an application.
func (c *Client) GetAppCVMs(ctx context.Context, appID string) ([]GenericObject, error) {
	var result []GenericObject
	if err := c.doJSON(ctx, "GET", "/apps/"+appID+"/cvms", nil, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// ReplicateAppCVM creates a replica of a CVM within an application context.
// This uses the app-scoped endpoint POST /apps/{appID}/cvms/{vmUUID}/replicas
// to ensure the new replica is associated with the correct app.
func (c *Client) ReplicateAppCVM(ctx context.Context, appID, vmUUID string, opts *ReplicateCVMOptions) (*CVMActionResponse, error) {
	var result CVMActionResponse
	path := "/apps/" + appID + "/cvms/" + vmUUID + "/replicas"
	if err := c.doJSON(ctx, "POST", path, opts, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetAppRevisions returns revisions for an application.
func (c *Client) GetAppRevisions(ctx context.Context, appID string, opts *PaginationOptions) (*AppRevisionsResponse, error) {
	path := "/apps/" + appID + "/revisions"
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
	var result AppRevisionsResponse
	if err := c.doJSON(ctx, "GET", path, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetAppRevisionDetail returns detailed information about a specific revision.
func (c *Client) GetAppRevisionDetail(ctx context.Context, appID, revisionID string) (*AppRevisionDetail, error) {
	var result AppRevisionDetail
	path := fmt.Sprintf("/apps/%s/revisions/%s", appID, revisionID)
	if err := c.doJSON(ctx, "GET", path, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetAppAttestation returns attestation data for an application.
func (c *Client) GetAppAttestation(ctx context.Context, appID string) (*AppAttestationResponse, error) {
	var result AppAttestationResponse
	if err := c.doJSON(ctx, "GET", "/apps/"+appID+"/attestations", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetAppDeviceAllowlist returns the device allowlist for an application.
func (c *Client) GetAppDeviceAllowlist(ctx context.Context, appID string) (*DeviceAllowlistResponse, error) {
	var result DeviceAllowlistResponse
	if err := c.doJSON(ctx, "GET", "/apps/"+appID+"/device-allowlist", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetAppFilterOptions returns filter options for application listings.
func (c *Client) GetAppFilterOptions(ctx context.Context) (*AppFilterOptions, error) {
	var result AppFilterOptions
	if err := c.doJSON(ctx, "GET", "/apps/filter-options", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CheckAppIsAllowed checks if a deployment is allowed by an on-chain app contract.
func (c *Client) CheckAppIsAllowed(ctx context.Context, appID string, req *CheckAppIsAllowedRequest) (*IsAllowedResult, error) {
	var result IsAllowedResult
	if err := c.doJSON(ctx, "POST", fmt.Sprintf("/apps/%s/is-allowed", appID), req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CheckAppCvmsIsAllowed batch checks on-chain allowance for all CVMs under an app.
func (c *Client) CheckAppCvmsIsAllowed(ctx context.Context, appID string) (*AppCvmsBatchIsAllowedResponse, error) {
	var result AppCvmsBatchIsAllowedResponse
	if err := c.doJSON(ctx, "POST", fmt.Sprintf("/apps/%s/cvms/is-allowed", appID), struct{}{}, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
