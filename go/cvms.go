package phala

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"reflect"
	"strconv"
)

// cvmPath returns the API path for a CVM, resolving the ID format.
func cvmPath(cvmID string, subpath ...string) string {
	p := "/cvms/" + ResolveCVMID(cvmID)
	for _, s := range subpath {
		p += "/" + s
	}
	return p
}

// ProvisionCVM prepares a new CVM creation (phase 1 of the two-phase create).
// It POSTs the provision payload to /cvms and returns app_id, compose_hash, the
// env-encryption pubkey, and a one-time commit token. The legacy
// POST /cvms/provision endpoint remains available but is deprecated.
func (c *Client) ProvisionCVM(ctx context.Context, req *ProvisionCVMRequest) (*ProvisionCVMResponse, error) {
	var result ProvisionCVMResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "POST", "/cvms", req, &result)
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
	c = c.withVersion("2026-01-21")
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
	c = c.withVersion("2026-01-21")
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
	c = c.withVersion("2026-01-21")
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
	c = c.withVersion("2026-01-21")
	var result CVMActionResponseV20260121
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "POST", cvmPath(cvmID, "start"), nil, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// RedeployCVMRevisionRequest is the request body for redeploying a single
// CVM to an app revision.
type RedeployCVMRevisionRequest struct {
	// EncryptedEnv is an optional encrypted environment blob. When empty
	// it is omitted from the request and the CVM keeps the environment
	// it currently has, even if the target revision was deployed with
	// different secrets. A rollback after a failed update therefore keeps
	// the failed update's environment.
	//
	// If the target revision's allowed_envs differ from the current
	// ones, pass a blob encrypted with the app's env encryption public
	// key (the same way as at deploy time).
	EncryptedEnv string `json:"encrypted_env,omitempty"`

	// AllowEnvMismatch bypasses the server's env-key check. By default the
	// backend rejects the redeploy (HTTP 400, error code ERR-03-017) when
	// the target revision's allowed_envs differ from the keys of the
	// environment currently stored on the CVM, in either direction. Set it
	// only to deliberately keep the current environment despite the
	// mismatch; otherwise pass a re-encrypted EncryptedEnv.
	AllowEnvMismatch bool `json:"allow_env_mismatch,omitempty"`
}

// RedeployCVMRevisionResponse is returned when a CVM redeploy is accepted.
type RedeployCVMRevisionResponse struct {
	Message string `json:"message"`
	// CorrelationID identifies the accepted operation. Poll the CVM's
	// in-progress operation (GetCVMInfo or GetCVMState, Operation.CorrelationID)
	// until it finishes and check the outcome, rather than waiting only for
	// compose_hash to change.
	CorrelationID string `json:"correlation_id"`
	Status        string `json:"status"`
}

// RedeployCVMRevision schedules an async redeploy of a single CVM to the
// named app revision. The endpoint returns 202 on accept. A nil req is
// valid and keeps the CVM's current environment.
//
// HTTP 465 from the backend means on-chain KMS compose-hash registration
// is required; surfaced as a regular *APIError.
func (c *Client) RedeployCVMRevision(ctx context.Context, cvmID, revisionID string, req *RedeployCVMRevisionRequest) (*RedeployCVMRevisionResponse, error) {
	var result RedeployCVMRevisionResponse
	path := cvmPath(cvmID, "revisions", url.PathEscape(revisionID), "redeploy")
	// A typed nil pointer would marshal as JSON null; send no body instead.
	var body any
	if req != nil {
		body = req
	}
	if err := c.doJSON(ctx, "POST", path, body, &result); err != nil {
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
	c = c.withVersion("2026-01-21")
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
	c = c.withVersion("2026-01-21")
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
	c = c.withVersion("2026-01-21")
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
	c = c.withVersion("2026-01-21")
	var result CVMActionResponseV20260121
	if err := c.doJSON(ctx, "POST", cvmPath(cvmID, "replicas"), opts, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CommitCVMUpdate completes a prepared CVM update with its one-time token.
func (c *Client) CommitCVMUpdate(ctx context.Context, cvmID string, req *CommitCVMUpdateRequest) (*CommitCVMUpdateResponse, error) {
	var result CommitCVMUpdateResponse
	if err := c.doJSON(ctx, "POST", cvmPath(cvmID, "commit-update"), req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// PatchCVM applies a multi-field patch to a CVM via PATCH /cvms/{id}.
//
// A 465 response (compose hash registration required, contract-owned KMS) is
// not an error: it returns RequiresOnChainHash with the hash to register.
//
// Listed is not part of the unified PATCH. PatchCVM sends the unified PATCH
// first (skipped when no other field is set) and applies Listed through
// PATCH /cvms/{id}/listed only after the CVM patch was accepted or answered
// with 465. The two calls are not atomic: when the listing call fails, the
// returned error states that the CVM patch was already accepted.
func (c *Client) PatchCVM(ctx context.Context, cvmID string, req *PatchCVMRequest) (*PatchCVMResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("phala: patch request is required")
	}
	body := *req
	if body.OSImageName != nil {
		if body.Image != nil && *body.Image != *body.OSImageName {
			return nil, fmt.Errorf("phala: Image %q and deprecated OSImageName %q conflict; set Image only", *body.Image, *body.OSImageName)
		}
		body.Image = body.OSImageName
	}

	result := &PatchCVMResponse{}
	patched := false
	if !isZeroPatch(body) {
		var err error
		result, err = c.sendCVMPatch(ctx, cvmID, body)
		if err != nil {
			return nil, err
		}
		patched = true
	}

	if body.Listed != nil {
		if err := c.UpdateCVMListed(ctx, cvmID, *body.Listed); err != nil {
			if patched {
				return nil, fmt.Errorf("phala: CVM patch was already accepted but updating listed failed: %w", err)
			}
			return nil, err
		}
	}
	return result, nil
}

// sendCVMPatch sends the unified PATCH /cvms/{id} and maps a 465 answer to a
// hash-required response.
func (c *Client) sendCVMPatch(ctx context.Context, cvmID string, body PatchCVMRequest) (*PatchCVMResponse, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("phala: marshal request: %w", err)
	}
	var headers map[string]string
	if body.PrepareOnly {
		headers = map[string]string{"X-Prepare-Only": "true"}
	}

	var result PatchCVMResponse
	err = c.doWithRetry(ctx, func() error {
		return c.doText(ctx, "PATCH", cvmPath(cvmID), "application/json", string(payload), headers, &result)
	})
	var apiErr *APIError
	if errors.As(err, &apiErr) && apiErr.IsComposePrecondition() {
		return patchCVMHashRequired(apiErr)
	}
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// isZeroPatch reports whether req has no field that PATCH /cvms/{id} accepts.
// ShutdownTimeout and AllowForceStop only tune how a change is applied, so
// they do not make a request worth sending on their own.
func isZeroPatch(req PatchCVMRequest) bool {
	req.Listed = nil
	req.OSImageName = nil
	req.ShutdownTimeout = nil
	req.AllowForceStop = nil
	req.PrepareOnly = false
	return reflect.ValueOf(req).IsZero()
}

// patchCVMHashRequired maps a 465 error to a hash-required response. A 465
// without compose_hash in its details is not that response, so the original
// *APIError is returned.
func patchCVMHashRequired(apiErr *APIError) (*PatchCVMResponse, error) {
	fields := make(map[string]any, len(apiErr.Details))
	for _, d := range apiErr.Details {
		if d.Field != "" {
			fields[d.Field] = d.Value
		}
	}
	composeHash, _ := fields["compose_hash"].(string)
	if composeHash == "" {
		return nil, apiErr
	}
	resp := &PatchCVMResponse{RequiresOnChainHash: true, ComposeHash: composeHash}
	resp.DeviceID, _ = fields["device_id"].(string)
	resp.CommitToken, _ = fields["commit_token"].(string)
	resp.CommitURL, _ = fields["commit_url"].(string)
	resp.APICommitURL, _ = fields["api_commit_url"].(string)
	switch v := fields["app_id"].(type) {
	case string:
		resp.AppID = v
	case json.Number:
		resp.AppID = v.String()
	case float64:
		resp.AppID = strconv.FormatFloat(v, 'f', -1, 64)
	}
	decodeDetail(fields["kms_info"], &resp.KMSInfo)
	decodeDetail(fields["onchain_status"], &resp.OnchainStatus)
	return resp, nil
}

// decodeDetail re-decodes a JSON value from an error detail into target.
func decodeDetail(value, target any) {
	if value == nil {
		return
	}
	b, err := json.Marshal(value)
	if err != nil {
		return
	}
	_ = json.Unmarshal(b, target)
}

// ConfirmCVMPatch confirms a CVM patch with on-chain transaction hash.
func (c *Client) ConfirmCVMPatch(ctx context.Context, cvmID string, req *ConfirmCVMPatchRequest) (*CVMActionResponse, error) {
	var result CVMActionResponse
	if req == nil {
		return nil, fmt.Errorf("phala: confirm patch request is required")
	}
	headers := map[string]string{"X-Compose-Hash": req.ComposeHash, "X-Transaction-Hash": req.TransactionHash}
	if err := c.doText(ctx, "PATCH", cvmPath(cvmID), "application/json", "{}", headers, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ConfirmCVMPatchV20260121 confirms a CVM patch using the pre-hashid response schema.
func (c *Client) ConfirmCVMPatchV20260121(ctx context.Context, cvmID string, req *ConfirmCVMPatchRequest) (*CVMActionResponseV20260121, error) {
	var result CVMActionResponseV20260121
	if req == nil {
		return nil, fmt.Errorf("phala: confirm patch request is required")
	}
	headers := map[string]string{"X-Compose-Hash": req.ComposeHash, "X-Transaction-Hash": req.TransactionHash, "X-Phala-Version": "2026-01-21"}
	if err := c.doText(ctx, "PATCH", cvmPath(cvmID), "application/json", "{}", headers, &result); err != nil {
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
	c = c.withVersion("2026-01-21")
	var result IsAllowedResultV20260121
	if err := c.doJSON(ctx, "POST", cvmPath(cvmID, "is-allowed"), req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
