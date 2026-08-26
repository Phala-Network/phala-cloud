package phala

import (
	"context"
	"fmt"
	"net/url"
)

// cvmPath returns the API path for a CVM, resolving the ID format.
func cvmPath(cvmID string, subpath ...string) string {
	p := "/cvms/" + ResolveCVMID(cvmID)
	for _, s := range subpath {
		p += "/" + s
	}
	return p
}

// ProvisionCVM provisions a new CVM.
func (c *Client) ProvisionCVM(ctx context.Context, req *ProvisionCVMRequest) (*ProvisionCVMResponse, error) {
	var result ProvisionCVMResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "POST", "/cvms/provision", req, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// CommitCVMProvision commits a provisioned CVM.
func (c *Client) CommitCVMProvision(ctx context.Context, req *CommitCVMProvisionRequest) (*CommitCVMProvisionResponse, error) {
	var result CommitCVMProvisionResponse
	if err := c.doJSON(ctx, "POST", "/cvms", req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CommitCVMProvisionV20260121 commits a provisioned CVM using the pre-hashid response schema.
func (c *Client) CommitCVMProvisionV20260121(ctx context.Context, req *CommitCVMProvisionRequest) (*CommitCVMProvisionResponseV20260121, error) {
	var result CommitCVMProvisionResponseV20260121
	if err := c.doJSON(ctx, "POST", "/cvms", req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetCVMList returns a paginated list of CVMs.
func (c *Client) GetCVMList(ctx context.Context, opts *GetCVMListOptions) (*PaginatedCVMInfos, error) {
	path := buildCVMListPath(opts)
	var result PaginatedCVMInfos
	if err := c.doJSON(ctx, "GET", path, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetCVMListV20260121 returns a paginated list of CVMs using the v20260121 response schema.
func (c *Client) GetCVMListV20260121(ctx context.Context, opts *GetCVMListOptions) (*PaginatedCVMInfosV20260121, error) {
	path := buildCVMListPath(opts)
	var result PaginatedCVMInfosV20260121
	if err := c.doJSON(ctx, "GET", path, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func buildCVMListPath(opts *GetCVMListOptions) string {
	path := "/cvms/paginated"
	if opts == nil {
		return path
	}
	q := url.Values{}
	if opts.Page != nil {
		q.Set("page", fmt.Sprintf("%d", *opts.Page))
	}
	if opts.PageSize != nil {
		q.Set("page_size", fmt.Sprintf("%d", *opts.PageSize))
	}
	if opts.Family != nil {
		q.Set("family", *opts.Family)
	}
	for _, t := range opts.InstanceTypes {
		q.Add("instance_types", t)
	}
	if encoded := q.Encode(); encoded != "" {
		path += "?" + encoded
	}
	return path
}

// GetCVMInfo returns detailed information about a CVM.
func (c *Client) GetCVMInfo(ctx context.Context, cvmID string) (*CVMInfo, error) {
	var result CVMInfo
	if err := c.doJSON(ctx, "GET", cvmPath(cvmID), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetCVMInfoV20260121 returns CVM information using the v20260121 response schema.
func (c *Client) GetCVMInfoV20260121(ctx context.Context, cvmID string) (*CVMInfoV20260121, error) {
	var result CVMInfoV20260121
	if err := c.doJSON(ctx, "GET", cvmPath(cvmID), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetCVMState returns the current state of a CVM.
func (c *Client) GetCVMState(ctx context.Context, cvmID string) (*CVMState, error) {
	var result CVMState
	if err := c.doJSON(ctx, "GET", cvmPath(cvmID, "state"), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetCVMStats returns statistics for a CVM.
func (c *Client) GetCVMStats(ctx context.Context, cvmID string) (*CVMStats, error) {
	var result CVMStats
	if err := c.doJSON(ctx, "GET", cvmPath(cvmID, "stats"), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetCVMNetwork returns network information for a CVM.
func (c *Client) GetCVMNetwork(ctx context.Context, cvmID string) (*CVMNetwork, error) {
	var result CVMNetwork
	if err := c.doJSON(ctx, "GET", cvmPath(cvmID, "network"), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetCVMContainersStats returns container statistics for a CVM.
func (c *Client) GetCVMContainersStats(ctx context.Context, cvmID string) (*CVMContainersStats, error) {
	var result CVMContainersStats
	if err := c.doJSON(ctx, "GET", cvmPath(cvmID, "composition"), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetCVMAttestation returns attestation data for a CVM.
func (c *Client) GetCVMAttestation(ctx context.Context, cvmID string) (*CVMAttestation, error) {
	var result CVMAttestation
	if err := c.doJSON(ctx, "GET", cvmPath(cvmID, "attestation"), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetCVMUserConfig returns user configuration for a CVM.
func (c *Client) GetCVMUserConfig(ctx context.Context, cvmID string) (*CVMUserConfig, error) {
	var result CVMUserConfig
	if err := c.doJSON(ctx, "GET", cvmPath(cvmID, "user_config"), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetAvailableOSImages returns available OS images for a CVM.
func (c *Client) GetAvailableOSImages(ctx context.Context, cvmID string) ([]CvmAvailableOSImage, error) {
	var result []CvmAvailableOSImage
	if err := c.doJSON(ctx, "GET", cvmPath(cvmID, "available-os-images"), nil, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// StartCVM starts a CVM.
func (c *Client) StartCVM(ctx context.Context, cvmID string) (*CVMActionResponse, error) {
	var result CVMActionResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "POST", cvmPath(cvmID, "start"), nil, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// StartCVMV20260121 starts a CVM using the pre-hashid response schema.
func (c *Client) StartCVMV20260121(ctx context.Context, cvmID string) (*CVMActionResponseV20260121, error) {
	var result CVMActionResponseV20260121
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "POST", cvmPath(cvmID, "start"), nil, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// StopCVM stops a CVM.
func (c *Client) StopCVM(ctx context.Context, cvmID string) (*CVMActionResponse, error) {
	var result CVMActionResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "POST", cvmPath(cvmID, "stop"), nil, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// StopCVMV20260121 stops a CVM using the pre-hashid response schema.
func (c *Client) StopCVMV20260121(ctx context.Context, cvmID string) (*CVMActionResponseV20260121, error) {
	var result CVMActionResponseV20260121
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "POST", cvmPath(cvmID, "stop"), nil, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// ShutdownCVM gracefully shuts down a CVM.
func (c *Client) ShutdownCVM(ctx context.Context, cvmID string) (*CVMActionResponse, error) {
	var result CVMActionResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "POST", cvmPath(cvmID, "shutdown"), nil, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// ShutdownCVMV20260121 gracefully shuts down a CVM using the pre-hashid response schema.
func (c *Client) ShutdownCVMV20260121(ctx context.Context, cvmID string) (*CVMActionResponseV20260121, error) {
	var result CVMActionResponseV20260121
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "POST", cvmPath(cvmID, "shutdown"), nil, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// RestartCVMOptions configures optional parameters for RestartCVM.
type RestartCVMOptions struct {
	Force bool `json:"force"`
}

// RestartCVM restarts a CVM.
func (c *Client) RestartCVM(ctx context.Context, cvmID string, opts *RestartCVMOptions) (*CVMActionResponse, error) {
	body := map[string]bool{"force": false}
	if opts != nil {
		body["force"] = opts.Force
	}
	var result CVMActionResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "POST", cvmPath(cvmID, "restart"), body, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// RestartCVMV20260121 restarts a CVM using the pre-hashid response schema.
func (c *Client) RestartCVMV20260121(ctx context.Context, cvmID string, opts *RestartCVMOptions) (*CVMActionResponseV20260121, error) {
	body := map[string]bool{"force": false}
	if opts != nil {
		body["force"] = opts.Force
	}
	var result CVMActionResponseV20260121
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "POST", cvmPath(cvmID, "restart"), body, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// DeleteCVM deletes a CVM.
func (c *Client) DeleteCVM(ctx context.Context, cvmID string) error {
	return c.doWithRetry(ctx, func() error {
		return c.doEmpty(ctx, "DELETE", cvmPath(cvmID))
	})
}

// ReplicateCVM replicates a CVM to another node.
func (c *Client) ReplicateCVM(ctx context.Context, cvmID string, opts *ReplicateCVMOptions) (*CVMActionResponse, error) {
	var result CVMActionResponse
	if err := c.doJSON(ctx, "POST", cvmPath(cvmID, "replicas"), opts, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ReplicateCVMV20260121 replicates a CVM using the pre-hashid response schema.
func (c *Client) ReplicateCVMV20260121(ctx context.Context, cvmID string, opts *ReplicateCVMOptions) (*CVMActionResponseV20260121, error) {
	var result CVMActionResponseV20260121
	if err := c.doJSON(ctx, "POST", cvmPath(cvmID, "replicas"), opts, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// PatchCVM applies a multi-field patch to a CVM.
func (c *Client) PatchCVM(ctx context.Context, cvmID string, req *PatchCVMRequest) (*PatchCVMResponse, error) {
	var result PatchCVMResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", cvmPath(cvmID), req, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// ConfirmCVMPatch confirms a CVM patch with on-chain transaction hash.
func (c *Client) ConfirmCVMPatch(ctx context.Context, cvmID string, req *ConfirmCVMPatchRequest) (*CVMActionResponse, error) {
	var result CVMActionResponse
	if err := c.doJSON(ctx, "PATCH", cvmPath(cvmID), req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ConfirmCVMPatchV20260121 confirms a CVM patch using the pre-hashid response schema.
func (c *Client) ConfirmCVMPatchV20260121(ctx context.Context, cvmID string, req *ConfirmCVMPatchRequest) (*CVMActionResponseV20260121, error) {
	var result CVMActionResponseV20260121
	if err := c.doJSON(ctx, "PATCH", cvmPath(cvmID), req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CheckCvmIsAllowed checks if a CVM deployment is allowed by its on-chain contract.
func (c *Client) CheckCvmIsAllowed(ctx context.Context, cvmID string, req *CheckCvmIsAllowedRequest) (*IsAllowedResult, error) {
	var result IsAllowedResult
	if err := c.doJSON(ctx, "POST", cvmPath(cvmID, "is-allowed"), req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CheckCvmIsAllowedV20260121 checks CVM allowance using the pre-hashid response schema.
func (c *Client) CheckCvmIsAllowedV20260121(ctx context.Context, cvmID string, req *CheckCvmIsAllowedRequest) (*IsAllowedResultV20260121, error) {
	var result IsAllowedResultV20260121
	if err := c.doJSON(ctx, "POST", cvmPath(cvmID, "is-allowed"), req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
