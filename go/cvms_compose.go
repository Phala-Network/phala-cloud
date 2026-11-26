package phala

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
)

// GetCVMComposeFile returns the compose file for a CVM.
func (c *Client) GetCVMComposeFile(ctx context.Context, cvmID string) (*ComposeFile, error) {
	var result ComposeFile
	if err := c.getJSON(ctx, cvmPath(cvmID, "compose_file"), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetCVMDockerCompose returns the raw docker-compose YAML for a CVM.
func (c *Client) GetCVMDockerCompose(ctx context.Context, cvmID string) (string, error) {
	var result string
	err := c.getText(ctx, cvmPath(cvmID, "docker-compose.yml"), &result)
	return result, err
}

// GetCVMPreLaunchScript returns the pre-launch script for a CVM.
func (c *Client) GetCVMPreLaunchScript(ctx context.Context, cvmID string) (string, error) {
	var result string
	err := c.getText(ctx, cvmPath(cvmID, "pre-launch-script"), &result)
	return result, err
}

// ProvisionComposeUpdateRequest is the body of POST /cvms/{id}/compose_file/provision.
// It is the app compose returned by GetCVMComposeFile, plus UpdateEnvVars and
// ConfirmDataWipe, serialized flat as the server reads it. Set compose fields
// on ComposeFile; a composite literal of this type cannot name promoted
// fields. Unknown compose keys stay in ComposeFile.Extra so a
// read-modify-write does not drop them.
type ProvisionComposeUpdateRequest struct {
	ComposeFile
	UpdateEnvVars *bool `json:"update_env_vars,omitempty"`
	// ConfirmDataWipe confirms turning on docker_cleanup, runtime_tmpfs or
	// requirements.ephemeral_data_disk, which erase data on every boot.
	ConfirmDataWipe bool `json:"confirm_data_wipe,omitempty"`
}

func (r ProvisionComposeUpdateRequest) MarshalJSON() ([]byte, error) {
	base, err := json.Marshal(r.ComposeFile)
	if err != nil {
		return nil, err
	}
	extra := map[string]json.RawMessage{}
	if r.UpdateEnvVars != nil {
		value, err := json.Marshal(r.UpdateEnvVars)
		if err != nil {
			return nil, err
		}
		extra["update_env_vars"] = value
	}
	if r.ConfirmDataWipe {
		extra["confirm_data_wipe"] = []byte("true")
	}
	return mergeJSONObject(base, extra)
}

func (r *ProvisionComposeUpdateRequest) UnmarshalJSON(data []byte) error {
	if err := json.Unmarshal(data, &r.ComposeFile); err != nil {
		return err
	}
	var side struct {
		UpdateEnvVars   *bool `json:"update_env_vars"`
		ConfirmDataWipe bool  `json:"confirm_data_wipe"`
	}
	if err := json.Unmarshal(data, &side); err != nil {
		return err
	}
	r.UpdateEnvVars = side.UpdateEnvVars
	r.ConfirmDataWipe = side.ConfirmDataWipe
	delete(r.Extra, "update_env_vars")
	delete(r.Extra, "confirm_data_wipe")
	if len(r.Extra) == 0 {
		r.Extra = nil
	}
	return nil
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
	ComposeHash   string   `json:"compose_hash"`
	EncryptedEnv  *string  `json:"encrypted_env,omitempty"`
	EnvKeys       []string `json:"env_keys,omitzero"`
	UpdateEnvVars *bool    `json:"update_env_vars,omitempty"`

	// ConfirmFinalityReplacement sets X-Confirm-Finality-Replacement. Empty sends
	// no header: a new update silently replaces a waiting one. Use
	// ConfirmFinalityReplacementNone to get a 412 (see
	// APIError.FinalityReplacementRequired) instead of replacing it, or the
	// waiting update's correlation ID to confirm the replacement.
	ConfirmFinalityReplacement string `json:"-"`
}

// CommitCVMComposeFileUpdate commits a compose file update. The returned
// response carries the correlation ID to pass to WaitForCVMFinality (see
// PatchCVMResponse.FinalityCorrelationID). It is nil when the server accepted
// the update with an empty body.
func (c *Client) CommitCVMComposeFileUpdate(ctx context.Context, cvmID string, req *CommitComposeUpdateRequest) (*PatchCVMResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("phala: commit compose update request is required")
	}
	var result PatchCVMResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSONWithHeaders(ctx, "PATCH", cvmPath(cvmID, "compose_file"), withConfirmFinalityReplacement(nil, req.ConfirmFinalityReplacement), req, &result)
	})
	if errors.Is(err, io.EOF) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// ComposeUpdateOptions holds optional headers for compose update operations.
type ComposeUpdateOptions struct {
	ComposeHash     string
	TransactionHash string

	// ConfirmFinalityReplacement sets X-Confirm-Finality-Replacement. Empty sends
	// no header: a new update silently replaces a waiting one. Use
	// ConfirmFinalityReplacementNone to get a 412 (see
	// APIError.FinalityReplacementRequired) instead of replacing it, or the
	// waiting update's correlation ID to confirm the replacement.
	ConfirmFinalityReplacement string `json:"-"`
}

// headers returns the request headers for opts. A nil opts sends none.
func (opts *ComposeUpdateOptions) headers() map[string]string {
	headers := map[string]string{}
	if opts == nil {
		return headers
	}
	if opts.ComposeHash != "" {
		headers["X-Compose-Hash"] = opts.ComposeHash
	}
	if opts.TransactionHash != "" {
		headers["X-Transaction-Hash"] = opts.TransactionHash
	}
	return withConfirmFinalityReplacement(headers, opts.ConfirmFinalityReplacement)
}

// UpdateDockerCompose updates the docker-compose YAML for a CVM.
func (c *Client) UpdateDockerCompose(ctx context.Context, cvmID, compose string, opts *ComposeUpdateOptions) (*UpdateResult, error) {
	headers := opts.headers()

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
	headers := opts.headers()

	var result UpdateResult
	err := c.doWithRetry(ctx, func() error {
		return c.doText(ctx, "PATCH", cvmPath(cvmID, "pre-launch-script"), "text/plain", script, headers, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// PreLaunchScriptUpgradeStatus reports whether a CVM runs an unmodified
// official pre-launch script and whether a newer official version exists.
// CanUpgrade is the flag callers act on: it is true only when the CVM is on an
// official script that is not the latest one.
type PreLaunchScriptUpgradeStatus struct {
	CurrentHash        *string `json:"current_hash"`
	LatestOfficialHash string  `json:"latest_official_hash"`
	IsOfficial         bool    `json:"is_official"`
	IsLatest           bool    `json:"is_latest"`
	CanUpgrade         bool    `json:"can_upgrade"`
}

// GetPreLaunchScriptUpgradeStatus returns the pre-launch script upgrade status for a CVM.
func (c *Client) GetPreLaunchScriptUpgradeStatus(ctx context.Context, cvmID string) (*PreLaunchScriptUpgradeStatus, error) {
	var result PreLaunchScriptUpgradeStatus
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "GET", cvmPath(cvmID, "pre-launch-script", "upgrade-status"), nil, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// UpgradePreLaunchScript replaces a CVM's pre-launch script with the latest
// official version. The script content lives server-side, so only the CVM ID is
// needed.
//
// For contract-owned KMS (ETHEREUM/BASE) the first call fails with a 465
// APIError carrying the compose hash to register on-chain. Use
// IsComposePrecondition and ComposePrecondition to read it, then retry with
// opts carrying the compose hash and the registering transaction hash.
func (c *Client) UpgradePreLaunchScript(ctx context.Context, cvmID string, opts *ComposeUpdateOptions) (*UpdateResult, error) {
	headers := opts.headers()

	var result UpdateResult
	err := c.doWithRetry(ctx, func() error {
		return c.doText(ctx, "POST", cvmPath(cvmID, "pre-launch-script", "upgrade-to-latest-official"), "", "", headers, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}
