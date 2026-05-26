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

// RefreshInstanceIDResponseFields contains shared instance ID refresh fields.
type RefreshInstanceIDResponseFields struct {
	Identifier          string  `json:"identifier"`
	Status              string  `json:"status"`
	OldInstanceID       *string `json:"old_instance_id,omitempty"`
	NewInstanceID       *string `json:"new_instance_id,omitempty"`
	Source              string  `json:"source"`
	VerifiedWithGateway bool    `json:"verified_with_gateway"`
	Reason              *string `json:"reason,omitempty"`
}

// RefreshInstanceIDResponseV20260121 is an instance ID refresh response before hashed CVM IDs.
type RefreshInstanceIDResponseV20260121 struct {
	CVMID *int `json:"cvm_id,omitempty"`
	RefreshInstanceIDResponseFields
}

// RefreshInstanceIDResponseV20260522 is an instance ID refresh response with hashed CVM IDs.
type RefreshInstanceIDResponseV20260522 struct {
	CVMID *string `json:"cvm_id,omitempty"`
	RefreshInstanceIDResponseFields
}

// RefreshInstanceIDResponse is the latest instance ID refresh response schema.
type RefreshInstanceIDResponse = RefreshInstanceIDResponseV20260522

// RefreshInstanceIDOptions configures optional parameters for RefreshCVMInstanceID.
type RefreshInstanceIDOptions struct {
	Overwrite *bool `json:"overwrite,omitempty"`
	DryRun    *bool `json:"dry_run,omitempty"`
}

// RefreshCVMInstanceID refreshes the instance ID for a CVM.
func (c *Client) RefreshCVMInstanceID(ctx context.Context, cvmID string, opts *RefreshInstanceIDOptions) (*RefreshInstanceIDResponse, error) {
	var body any
	if opts != nil {
		body = opts
	}
	var result RefreshInstanceIDResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", cvmPath(cvmID, "instance-id"), body, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// RefreshCVMInstanceIDV20260121 refreshes the instance ID using the pre-hashid response schema.
func (c *Client) RefreshCVMInstanceIDV20260121(ctx context.Context, cvmID string, opts *RefreshInstanceIDOptions) (*RefreshInstanceIDResponseV20260121, error) {
	var body any
	if opts != nil {
		body = opts
	}
	var result RefreshInstanceIDResponseV20260121
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", cvmPath(cvmID, "instance-id"), body, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// RefreshInstanceIDsResponseFields contains shared batch instance ID refresh fields.
type RefreshInstanceIDsResponseFields struct {
	Total     int `json:"total"`
	Scanned   int `json:"scanned"`
	Updated   int `json:"updated"`
	Unchanged int `json:"unchanged"`
	Skipped   int `json:"skipped"`
	Conflicts int `json:"conflicts"`
	Errors    int `json:"errors"`
}

// RefreshInstanceIDsResponseV20260121 is a batch instance ID refresh response before hashed CVM IDs.
type RefreshInstanceIDsResponseV20260121 struct {
	RefreshInstanceIDsResponseFields
	Items []RefreshInstanceIDResponseV20260121 `json:"items"`
}

// RefreshInstanceIDsResponseV20260522 is a batch instance ID refresh response with hashed CVM IDs.
type RefreshInstanceIDsResponseV20260522 struct {
	RefreshInstanceIDsResponseFields
	Items []RefreshInstanceIDResponseV20260522 `json:"items"`
}

// RefreshInstanceIDsResponse is the latest batch instance ID refresh response schema.
type RefreshInstanceIDsResponse = RefreshInstanceIDsResponseV20260522

// RefreshInstanceIDsRequest configures optional parameters for RefreshCVMInstanceIDs.
type RefreshInstanceIDsRequest struct {
	CVMIDs      []string `json:"cvm_ids,omitempty"`
	RunningOnly *bool    `json:"running_only,omitempty"`
	MissingOnly *bool    `json:"missing_only,omitempty"`
	Overwrite   *bool    `json:"overwrite,omitempty"`
	Limit       *int     `json:"limit,omitempty"`
	DryRun      *bool    `json:"dry_run,omitempty"`
}

// RefreshCVMInstanceIDs refreshes instance IDs for CVMs.
func (c *Client) RefreshCVMInstanceIDs(ctx context.Context, req *RefreshInstanceIDsRequest) (*RefreshInstanceIDsResponse, error) {
	var body any
	if req != nil {
		body = req
	} else {
		body = map[string]any{}
	}
	var result RefreshInstanceIDsResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", "/cvms/instance-ids", body, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// RefreshCVMInstanceIDsV20260121 refreshes instance IDs using the pre-hashid response schema.
func (c *Client) RefreshCVMInstanceIDsV20260121(ctx context.Context, req *RefreshInstanceIDsRequest) (*RefreshInstanceIDsResponseV20260121, error) {
	var body any
	if req != nil {
		body = req
	} else {
		body = map[string]any{}
	}
	var result RefreshInstanceIDsResponseV20260121
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", "/cvms/instance-ids", body, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// UpdateEnvsRequest is the request for updating CVM environment variables.
type UpdateEnvsRequest struct {
	EncryptedEnv    string   `json:"encrypted_env"`
	EnvKeys         []string `json:"env_keys,omitempty"`
	ComposeHash     *string  `json:"compose_hash,omitempty"`
	TransactionHash *string  `json:"transaction_hash,omitempty"`
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
