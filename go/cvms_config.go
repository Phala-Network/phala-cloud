package phala

import "context"

// UpdateResourcesRequest is the request for updating CVM resources.
type UpdateResourcesRequest struct {
	VCPU         *int    `json:"vcpu,omitempty"`
	Memory       *int    `json:"memory,omitempty"`
	DiskSize     *int    `json:"disk_size,omitempty"`
	InstanceType *string `json:"instance_type,omitempty"`
	AllowRestart *bool   `json:"allow_restart,omitempty"`
}

// UpdateCVMResources updates the resources for a CVM.
func (c *Client) UpdateCVMResources(ctx context.Context, cvmID string, req *UpdateResourcesRequest) error {
	return c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", cvmPath(cvmID, "resources"), req, nil)
	})
}

// UpdateVisibilityRequest is the request for updating CVM visibility.
type UpdateVisibilityRequest struct {
	PublicSysinfo *bool `json:"public_sysinfo,omitempty"`
	PublicLogs    *bool `json:"public_logs,omitempty"`
	PublicTcbinfo *bool `json:"public_tcbinfo,omitempty"`
}

// UpdateCVMVisibility updates the visibility settings for a CVM.
func (c *Client) UpdateCVMVisibility(ctx context.Context, cvmID string, req *UpdateVisibilityRequest) (*CVMVisibility, error) {
	var result CVMVisibility
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", cvmPath(cvmID, "visibility"), req, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// UpdateOSImageRequest is the request for updating CVM OS image.
type UpdateOSImageRequest struct {
	OSImageName string `json:"os_image_name"`
}

// UpdateOSImage updates the OS image for a CVM.
func (c *Client) UpdateOSImage(ctx context.Context, cvmID string, req *UpdateOSImageRequest) error {
	return c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", cvmPath(cvmID, "os-image"), req, nil)
	})
}

// RefreshInstanceIDResponse is the response for refreshing a CVM instance ID.
type RefreshInstanceIDResponse = GenericObject

// RefreshCVMInstanceID refreshes the instance ID for a CVM.
func (c *Client) RefreshCVMInstanceID(ctx context.Context, cvmID string) (*RefreshInstanceIDResponse, error) {
	var result RefreshInstanceIDResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", cvmPath(cvmID, "instance-id"), nil, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// RefreshInstanceIDsResponse is the response for refreshing all CVM instance IDs.
type RefreshInstanceIDsResponse = GenericObject

// RefreshCVMInstanceIDs refreshes instance IDs for all CVMs.
func (c *Client) RefreshCVMInstanceIDs(ctx context.Context) (*RefreshInstanceIDsResponse, error) {
	var result RefreshInstanceIDsResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", "/cvms/instance-ids", map[string]any{}, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// UpdateEnvsRequest is the request for updating CVM environment variables.
type UpdateEnvsRequest struct {
	EncryptedEnv    string  `json:"encrypted_env"`
	EnvKeys         *string `json:"env_keys,omitempty"`
	ComposeHash     *string `json:"compose_hash,omitempty"`
	TransactionHash *string `json:"transaction_hash,omitempty"`
}

// UpdateCVMEnvs updates the encrypted environment variables for a CVM.
func (c *Client) UpdateCVMEnvs(ctx context.Context, cvmID string, req *UpdateEnvsRequest) (*UpdateResult, error) {
	var result UpdateResult
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", cvmPath(cvmID, "envs"), req, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}
