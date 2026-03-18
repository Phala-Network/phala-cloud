package phala

import "context"

// GetCVMComposeFile returns the compose file for a CVM.
func (c *Client) GetCVMComposeFile(ctx context.Context, cvmID string) (*ComposeFile, error) {
	var result ComposeFile
	if err := c.doJSON(ctx, "GET", cvmPath(cvmID, "compose_file"), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetCVMDockerCompose returns the raw docker-compose YAML for a CVM.
func (c *Client) GetCVMDockerCompose(ctx context.Context, cvmID string) (string, error) {
	var result string
	err := c.doText(ctx, "GET", cvmPath(cvmID, "docker-compose.yml"), "", "", nil, &result)
	return result, err
}

// GetCVMPreLaunchScript returns the pre-launch script for a CVM.
func (c *Client) GetCVMPreLaunchScript(ctx context.Context, cvmID string) (string, error) {
	var result string
	err := c.doText(ctx, "GET", cvmPath(cvmID, "pre-launch-script"), "", "", nil, &result)
	return result, err
}

// ProvisionComposeUpdateRequest is the request for provisioning a compose file update.
type ProvisionComposeUpdateRequest struct {
	Name              string  `json:"name"`
	DockerComposeFile string  `json:"docker_compose_file"`
	GatewayEnabled    *bool   `json:"gateway_enabled,omitempty"`
	PreLaunchScript   *string `json:"pre_launch_script,omitempty"`
	EncryptedEnv      *string `json:"encrypted_env,omitempty"`
	EnvKeys           *string `json:"env_keys,omitempty"`
	PublicLogs        *bool   `json:"public_logs,omitempty"`
	PublicSysinfo     *bool   `json:"public_sysinfo,omitempty"`
	PublicTcbinfo     *bool   `json:"public_tcbinfo,omitempty"`
	SecureTime        *bool   `json:"secure_time,omitempty"`
	UpdateEnvVars     *bool   `json:"update_env_vars,omitempty"`
}

// ProvisionCVMComposeFileUpdate provisions a compose file update.
func (c *Client) ProvisionCVMComposeFileUpdate(ctx context.Context, cvmID string, req *ProvisionComposeUpdateRequest) (*ProvisionCVMResponse, error) {
	var result ProvisionCVMResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "POST", cvmPath(cvmID, "compose_file", "provision"), req, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// CommitComposeUpdateRequest is the request for committing a compose file update.
type CommitComposeUpdateRequest struct {
	ComposeHash   string  `json:"compose_hash"`
	EncryptedEnv  *string `json:"encrypted_env,omitempty"`
	EnvKeys       *string `json:"env_keys,omitempty"`
	UpdateEnvVars *bool   `json:"update_env_vars,omitempty"`
}

// CommitCVMComposeFileUpdate commits a compose file update.
func (c *Client) CommitCVMComposeFileUpdate(ctx context.Context, cvmID string, req *CommitComposeUpdateRequest) error {
	return c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", cvmPath(cvmID, "compose_file"), req, nil)
	})
}

// ComposeUpdateOptions holds optional headers for compose update operations.
type ComposeUpdateOptions struct {
	ComposeHash     string
	TransactionHash string
}

// UpdateDockerCompose updates the docker-compose YAML for a CVM.
func (c *Client) UpdateDockerCompose(ctx context.Context, cvmID, compose string, opts *ComposeUpdateOptions) (*UpdateResult, error) {
	headers := map[string]string{}
	if opts != nil {
		if opts.ComposeHash != "" {
			headers["X-Compose-Hash"] = opts.ComposeHash
		}
		if opts.TransactionHash != "" {
			headers["X-Transaction-Hash"] = opts.TransactionHash
		}
	}

	var result UpdateResult
	err := c.doWithRetry(ctx, func() error {
		return c.doText(ctx, "PATCH", cvmPath(cvmID, "docker-compose"), "text/yaml", compose, headers, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// UpdatePreLaunchScript updates the pre-launch script for a CVM.
func (c *Client) UpdatePreLaunchScript(ctx context.Context, cvmID, script string, opts *ComposeUpdateOptions) (*UpdateResult, error) {
	headers := map[string]string{}
	if opts != nil {
		if opts.ComposeHash != "" {
			headers["X-Compose-Hash"] = opts.ComposeHash
		}
		if opts.TransactionHash != "" {
			headers["X-Transaction-Hash"] = opts.TransactionHash
		}
	}

	var result UpdateResult
	err := c.doWithRetry(ctx, func() error {
		return c.doText(ctx, "PATCH", cvmPath(cvmID, "pre-launch-script"), "text/plain", script, headers, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}
