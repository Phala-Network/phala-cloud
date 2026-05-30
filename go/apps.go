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

// GetAppListV20260121 returns the app list using the v20260121 response schema.
func (c *Client) GetAppListV20260121(ctx context.Context) (*GetAppListResponseV20260121, error) {
	var result GetAppListResponseV20260121
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

// GetAppInfoV20260121 returns app information using the v20260121 response schema.
func (c *Client) GetAppInfoV20260121(ctx context.Context, appID string) (*AppInfoV20260121, error) {
	var result AppInfoV20260121
	if err := c.doJSON(ctx, "GET", "/apps/"+appID, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetAppCVMs returns CVMs associated with an application.
func (c *Client) GetAppCVMs(ctx context.Context, appID string) ([]CVMInfoV20260522, error) {
	var result []CVMInfoV20260522
	if err := c.doJSON(ctx, "GET", "/apps/"+appID+"/cvms", nil, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// GetAppCVMsV20260121 returns app CVMs using the v20260121 response schema.
func (c *Client) GetAppCVMsV20260121(ctx context.Context, appID string) ([]CVMInfoV20260121, error) {
	var result []CVMInfoV20260121
	if err := c.doJSON(ctx, "GET", "/apps/"+appID+"/cvms", nil, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// CreateAppInstance creates a new CVM instance under an existing app.
func (c *Client) CreateAppInstance(ctx context.Context, appID string, req *CreateAppInstanceRequest) (*CVMInfo, error) {
	var result CVMInfo
	if err := c.doJSON(ctx, "POST", "/apps/"+appID+"/instances", req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CreateAppInstanceV20260121 creates an app instance using the v20260121 response schema.
func (c *Client) CreateAppInstanceV20260121(ctx context.Context, appID string, req *CreateAppInstanceRequest) (*CVMInfoV20260121, error) {
	var result CVMInfoV20260121
	if err := c.doJSON(ctx, "POST", "/apps/"+appID+"/instances", req, &result); err != nil {
		return nil, err
	}
	return &result, nil
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

// ReplicateAppCVMV20260121 creates an app CVM replica using the pre-hashid response schema.
func (c *Client) ReplicateAppCVMV20260121(ctx context.Context, appID, vmUUID string, opts *ReplicateCVMOptions) (*CVMActionResponseV20260121, error) {
	var result CVMActionResponseV20260121
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

// RedeployAppRevisionRequest is the request body for redeploying an app
// revision across a set of CVMs.
type RedeployAppRevisionRequest struct {
	// VMUUIDs lists the CVMs that should adopt the new revision. The
	// backend locks each CVM row, flips compose_hash in place, and
	// enqueues the per-CVM update task; vm_uuid and name are preserved.
	VMUUIDs []string `json:"vm_uuids"`
}

// RedeployAppRevision schedules an async redeploy of the named revision
// against the given set of CVMs. The endpoint returns 202 on accept;
// callers should poll GetCVMInfo per CVM and wait for compose_hash to
// flip to the new revision's value before reporting completion.
//
// HTTP 465 from the backend means on-chain KMS compose-hash registration
// is required; surfaced as a regular *APIError so callers can decide how
// to present it.
func (c *Client) RedeployAppRevision(ctx context.Context, appID, revisionID string, req *RedeployAppRevisionRequest) error {
	path := fmt.Sprintf("/apps/%s/revisions/%s/redeploy", appID, url.PathEscape(revisionID))
	return c.doJSON(ctx, "POST", path, req, nil)
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

// GetAppDeviceAllowlistV20260121 returns the device allowlist using the pre-hashid schema.
func (c *Client) GetAppDeviceAllowlistV20260121(ctx context.Context, appID string) (*DeviceAllowlistResponseV20260121, error) {
	var result DeviceAllowlistResponseV20260121
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

// CheckAppIsAllowedV20260121 checks app allowance using the pre-hashid response schema.
func (c *Client) CheckAppIsAllowedV20260121(ctx context.Context, appID string, req *CheckAppIsAllowedRequest) (*IsAllowedResultV20260121, error) {
	var result IsAllowedResultV20260121
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

// CheckAppCvmsIsAllowedV20260121 batch checks allowance using the pre-hashid response schema.
func (c *Client) CheckAppCvmsIsAllowedV20260121(ctx context.Context, appID string) (*AppCvmsBatchIsAllowedResponseV20260121, error) {
	var result AppCvmsBatchIsAllowedResponseV20260121
	if err := c.doJSON(ctx, "POST", fmt.Sprintf("/apps/%s/cvms/is-allowed", appID), struct{}{}, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
