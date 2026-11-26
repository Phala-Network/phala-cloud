package phala

import (
	"context"
	"errors"
	"fmt"
	"io"
)

// CVMSSHKeyEntry describes an SSH key authorized on a CVM.
type CVMSSHKeyEntry struct {
	ID            string `json:"id"`
	OwnerUserID   string `json:"owner_user_id"`
	OwnerUsername string `json:"owner_username"`
	AddedByUserID string `json:"added_by_user_id"`
	Name          string `json:"name"`
	PublicKey     string `json:"public_key"`
	Fingerprint   string `json:"fingerprint"`
	KeyType       string `json:"key_type"`
}

// CVMSSHKeysResponse contains the desired authorized keys and restart status.
type CVMSSHKeysResponse struct {
	Keys            []CVMSSHKeyEntry `json:"keys"`
	RestartRequired bool             `json:"restart_required"`
}

// UpdateCVMSSHKeysRequest replaces the authorized key set.
type UpdateCVMSSHKeysRequest struct {
	SSHKeyIDs []string `json:"ssh_key_ids"`
	Usernames []string `json:"usernames,omitempty"`
	ApplyNow  bool     `json:"apply_now,omitempty"`
}

// GetCVMSSHKeys returns the CVM's desired authorized key set.
func (c *Client) GetCVMSSHKeys(ctx context.Context, cvmID string) (*CVMSSHKeysResponse, error) {
	var result CVMSSHKeysResponse
	if err := c.getJSON(ctx, cvmPath(cvmID, "ssh-keys"), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// UpdateCVMSSHKeys replaces the CVM's authorized key set.
func (c *Client) UpdateCVMSSHKeys(ctx context.Context, cvmID string, req *UpdateCVMSSHKeysRequest) (*CVMSSHKeysResponse, error) {
	var result CVMSSHKeysResponse
	if err := c.doJSON(ctx, "PUT", cvmPath(cvmID, "ssh-keys"), req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// UpdateResourcesRequest is the request for updating CVM resources.
type UpdateResourcesRequest struct {
	VCPU         *int    `json:"vcpu,omitempty"`
	Memory       *int    `json:"memory,omitempty"`
	DiskSize     *int    `json:"disk_size,omitempty"`
	InstanceType *string `json:"instance_type,omitempty"`

	// Deprecated: the API restarts the CVM whenever a resize needs it and
	// ignores this flag, so it is no longer sent.
	AllowRestart *bool `json:"-"`
}

// UpdateResourcesResponse is the response from the unified CVM update endpoint.
type UpdateResourcesResponse = CVMUpdateResponse

// CVMUpdateResponse is the 202 response from PATCH /cvms/{id}. Status is
// "no_change" with an empty CorrelationID when nothing had to change.
type CVMUpdateResponse struct {
	Message       string `json:"message"`
	CorrelationID string `json:"correlation_id"`
	Status        string `json:"status"`
}

// UpdateCVMResources updates the resources for a CVM.
func (c *Client) UpdateCVMResources(ctx context.Context, cvmID string, req *UpdateResourcesRequest) (*UpdateResourcesResponse, error) {
	var result UpdateResourcesResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", cvmPath(cvmID), req, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// UpdateVisibilityRequest is the request for updating CVM visibility.
type UpdateVisibilityRequest struct {
	PublicSysinfo *bool `json:"public_sysinfo,omitempty"`
	PublicLogs    *bool `json:"public_logs,omitempty"`
	PublicTcbinfo *bool `json:"public_tcbinfo,omitempty"`
}

// UpdateCVMVisibility updates the visibility settings for a CVM through
// PATCH /cvms/{id}. Visibility flags are part of the compose hash: for a CVM
// on contract-owned KMS the API answers 465 until the new hash is registered
// on-chain. Use PatchCVM for the two-phase flow.
func (c *Client) UpdateCVMVisibility(ctx context.Context, cvmID string, req *UpdateVisibilityRequest) (*CVMUpdateResponse, error) {
	var result CVMUpdateResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", cvmPath(cvmID), req, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// UpdateListedRequest is the request body for toggling a CVM's public
// marketplace listing.
type UpdateListedRequest struct {
	Listed bool `json:"listed"`
}

// UpdateCVMListed toggles whether a CVM is publicly listed. It hits the
// dedicated PATCH /cvms/{id}/listed endpoint, which is a pure metadata update
// (plain DB write) — no compose change, no redeploy, no attestation change.
func (c *Client) UpdateCVMListed(ctx context.Context, cvmID string, listed bool) error {
	return c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", cvmPath(cvmID, "listed"), &UpdateListedRequest{Listed: listed}, nil)
	})
}

// UpdateOSImageRequest is the request for updating CVM OS image.
type UpdateOSImageRequest struct {
	OSImageName string `json:"os_image_name"`
}

// UpdateOSImage updates the OS image for a CVM. The returned response carries
// the accepted update's correlation ID and status. It is nil when the server
// accepted the update with an empty body.
func (c *Client) UpdateOSImage(ctx context.Context, cvmID string, req *UpdateOSImageRequest) (*PatchCVMResponse, error) {
	var result PatchCVMResponse
	err := c.doWithRetry(ctx, func() error {
		return c.doJSON(ctx, "PATCH", cvmPath(cvmID, "os-image"), req, &result)
	})
	if errors.Is(err, io.EOF) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &result, nil
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
	c = c.withVersion("2026-01-21")
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
	c = c.withVersion("2026-01-21")
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
	EnvKeys         []string `json:"env_keys,omitzero"`
	ComposeHash     *string  `json:"compose_hash,omitempty"`
	TransactionHash *string  `json:"transaction_hash,omitempty"`

	// ConfirmFinalityReplacement sets X-Confirm-Finality-Replacement. Empty sends
	// no header: a new update silently replaces a waiting one. Use
	// ConfirmFinalityReplacementNone to get a 412 (see
	// APIError.FinalityReplacementRequired) instead of replacing it, or the
	// waiting update's correlation ID to confirm the replacement.
	ConfirmFinalityReplacement string `json:"-"`
}

// UpdateCVMEnvs updates the encrypted environment variables for a CVM.
func (c *Client) UpdateCVMEnvs(ctx context.Context, cvmID string, req *UpdateEnvsRequest) (*UpdateResult, error) {
	if req == nil {
		return nil, fmt.Errorf("phala: update envs request is required")
	}
	var result UpdateResult
	err := c.doWithRetry(ctx, func() error {
		return c.doJSONWithHeaders(ctx, "PATCH", cvmPath(cvmID, "envs"), withConfirmFinalityReplacement(nil, req.ConfirmFinalityReplacement), req, &result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// CVMAnnotationsResponse holds the host-side key/value metadata the node's
// dstack VMM stores for a CVM. It is not passed to the guest, not measured
// and not part of the compose hash, so attestation does not cover it.
type CVMAnnotationsResponse struct {
	Annotations map[string]string `json:"annotations"`
}

type updateCVMAnnotationsRequest struct {
	Annotations map[string]string `json:"annotations"`
}

// GetCVMAnnotations returns the annotations the node's VMM stores for the CVM.
// Needs the cvm_annotations feature flag.
func (c *Client) GetCVMAnnotations(ctx context.Context, cvmID string) (*CVMAnnotationsResponse, error) {
	var result CVMAnnotationsResponse
	if err := c.getJSON(ctx, cvmPath(cvmID, "annotations"), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// UpdateCVMAnnotations replaces every annotation of the CVM; an empty map
// clears them. It needs no restart, but host tools that read annotations only
// when QEMU launches see the change after the next restart. Needs the
// cvm_annotations feature flag.
func (c *Client) UpdateCVMAnnotations(ctx context.Context, cvmID string, annotations map[string]string) (*CVMAnnotationsResponse, error) {
	var result CVMAnnotationsResponse
	req := updateCVMAnnotationsRequest{Annotations: annotations}
	if err := c.doJSON(ctx, "PUT", cvmPath(cvmID, "annotations"), req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CVMInitScript describes one init script provided by Phala Cloud for a CVM.
type CVMInitScript struct {
	Slug InitScriptSlug `json:"slug"`
	// Selected reports whether the CVM's current compose runs the script.
	Selected bool `json:"selected"`
	// Selectable reports whether the caller may select the script for this
	// CVM's compose and OS image.
	Selectable bool `json:"selectable"`
	// Reason says why the script is not selectable; nil when it is.
	Reason *string `json:"reason"`
}

// CVMInitScriptsResponse lists every init script Phala Cloud provides, in the
// order it runs them.
type CVMInitScriptsResponse struct {
	Items []CVMInitScript `json:"items"`
	// HasCustomScripts is true when the CVM also runs init scripts set by
	// Phala Cloud support, and changing the selection replaces them.
	HasCustomScripts bool `json:"has_custom_scripts"`
}

// GetCVMInitScripts returns which provided init scripts the CVM runs and which
// it can select.
func (c *Client) GetCVMInitScripts(ctx context.Context, cvmID string) (*CVMInitScriptsResponse, error) {
	var result CVMInitScriptsResponse
	if err := c.getJSON(ctx, cvmPath(cvmID, "init-scripts"), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ManagedInitScript is one init script provided by Phala Cloud, with the
// script text and hash that provisioning injects.
type ManagedInitScript struct {
	// Name identifies the script. Phala Cloud owns the names; the SDK does
	// not validate them.
	Name    string `json:"name"`
	Version string `json:"version"`
	Script  string `json:"script"`
	// Hash is the sha256 hex of Script.
	Hash         string `json:"hash"`
	RequestField string `json:"request_field"`
	MinOSVersion string `json:"min_os_version"`
}

// ManagedInitScriptsResponse lists every init script Phala Cloud provides.
type ManagedInitScriptsResponse struct {
	Items []ManagedInitScript `json:"items"`
}

// GetManagedInitScripts returns every init script Phala Cloud provides, with
// the script text and hash. The endpoint is public and needs no auth.
func (c *Client) GetManagedInitScripts(ctx context.Context) (*ManagedInitScriptsResponse, error) {
	var result ManagedInitScriptsResponse
	if err := c.getJSON(ctx, "/managed-init-scripts", &result); err != nil {
		return nil, err
	}
	return &result, nil
}
