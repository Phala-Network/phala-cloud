package provider

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/hashicorp/terraform-plugin-framework/diag"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

// cvmAPIResponse is the common response structure returned by the Phala Cloud
// CVM endpoints.  It is shared across resource_app, resource_cvm_power, and
// resource_shared.
type cvmAPIResponse struct {
	ID         json.RawMessage `json:"id"`
	Name       string          `json:"name"`
	Status     string          `json:"status"`
	InProgress bool            `json:"in_progress"`
	Listed     *bool           `json:"listed"`
	AppID      string          `json:"app_id"`
	VMUUID     string          `json:"vm_uuid"`
	InstanceID string          `json:"instance_id"`
	EnvPubkey  *string         `json:"encrypted_env_pubkey"`
	KMSInfo    *struct {
		EncryptedEnvPubkey string `json:"encrypted_env_pubkey"`
	} `json:"kms_info"`

	Resource *struct {
		InstanceType string `json:"instance_type"`
		DiskInGB     *int64 `json:"disk_in_gb"`
	} `json:"resource"`

	InstanceType string `json:"instance_type"`
	DiskSize     *int64 `json:"disk_size"`

	Progress *struct {
		Target string `json:"target"`
	} `json:"progress"`

	NodeInfo *struct {
		Region string `json:"region"`
	} `json:"node_info"`
	Node *struct {
		RegionIdentifier string `json:"region_identifier"`
	} `json:"node"`
	OS *struct {
		Name string `json:"name"`
	} `json:"os"`
	BaseImage      string `json:"base_image"`
	PublicLogs     *bool  `json:"public_logs"`
	PublicSysinfo  *bool  `json:"public_sysinfo"`
	PublicTCBInfo  *bool  `json:"public_tcbinfo"`
	GatewayEnabled *bool  `json:"gateway_enabled"`
	SecureTime     *bool  `json:"secure_time"`
	StorageFS      string `json:"storage_fs"`
	ComposeFile    *struct {
		PublicLogs     *bool  `json:"public_logs"`
		PublicSysinfo  *bool  `json:"public_sysinfo"`
		PublicTCBInfo  *bool  `json:"public_tcbinfo"`
		GatewayEnabled *bool  `json:"gateway_enabled"`
		SecureTime     *bool  `json:"secure_time"`
		StorageFS      string `json:"storage_fs"`
	} `json:"compose_file"`

	Endpoints []struct {
		App string `json:"app"`
	} `json:"endpoints"`
	PublicURLs []struct {
		App string `json:"app"`
	} `json:"public_urls"`
}

func (r cvmAPIResponse) idString() string {
	if len(r.ID) == 0 {
		return ""
	}

	var asString string
	if err := json.Unmarshal(r.ID, &asString); err == nil {
		return strings.TrimSpace(asString)
	}

	var asInt int64
	if err := json.Unmarshal(r.ID, &asInt); err == nil {
		return strconv.FormatInt(asInt, 10)
	}

	var asFloat float64
	if err := json.Unmarshal(r.ID, &asFloat); err == nil {
		return strconv.FormatInt(int64(asFloat), 10)
	}

	return ""
}

func (r cvmAPIResponse) envEncryptionPubkey() string {
	if r.EnvPubkey != nil && strings.TrimSpace(*r.EnvPubkey) != "" {
		return strings.TrimSpace(*r.EnvPubkey)
	}
	if r.KMSInfo != nil && strings.TrimSpace(r.KMSInfo.EncryptedEnvPubkey) != "" {
		return strings.TrimSpace(r.KMSInfo.EncryptedEnvPubkey)
	}
	return ""
}

func (r cvmAPIResponse) osImageName() string {
	if r.OS != nil && strings.TrimSpace(r.OS.Name) != "" {
		return strings.TrimSpace(r.OS.Name)
	}
	if strings.TrimSpace(r.BaseImage) != "" {
		return strings.TrimSpace(r.BaseImage)
	}
	return ""
}

func (r cvmAPIResponse) inProgress() bool {
	return r.InProgress || (r.Progress != nil && strings.TrimSpace(r.Progress.Target) != "")
}

func (r cvmAPIResponse) instanceType() string {
	if r.Resource != nil && strings.TrimSpace(r.Resource.InstanceType) != "" {
		return r.Resource.InstanceType
	}
	return r.InstanceType
}

func (r cvmAPIResponse) region() string {
	if r.NodeInfo != nil && strings.TrimSpace(r.NodeInfo.Region) != "" {
		return r.NodeInfo.Region
	}
	if r.Node != nil && strings.TrimSpace(r.Node.RegionIdentifier) != "" {
		return r.Node.RegionIdentifier
	}
	return ""
}

func (r cvmAPIResponse) endpoint() string {
	if len(r.Endpoints) > 0 && strings.TrimSpace(r.Endpoints[0].App) != "" {
		return r.Endpoints[0].App
	}
	if len(r.PublicURLs) > 0 && strings.TrimSpace(r.PublicURLs[0].App) != "" {
		return r.PublicURLs[0].App
	}
	return ""
}

func (r cvmAPIResponse) publicLogsValue() *bool {
	if r.ComposeFile != nil && r.ComposeFile.PublicLogs != nil {
		return r.ComposeFile.PublicLogs
	}
	return r.PublicLogs
}

func (r cvmAPIResponse) publicSysinfoValue() *bool {
	if r.ComposeFile != nil && r.ComposeFile.PublicSysinfo != nil {
		return r.ComposeFile.PublicSysinfo
	}
	return r.PublicSysinfo
}

func (r cvmAPIResponse) publicTCBInfoValue() *bool {
	if r.ComposeFile != nil && r.ComposeFile.PublicTCBInfo != nil {
		return r.ComposeFile.PublicTCBInfo
	}
	return r.PublicTCBInfo
}

func (r cvmAPIResponse) gatewayEnabledValue() *bool {
	if r.ComposeFile != nil && r.ComposeFile.GatewayEnabled != nil {
		return r.ComposeFile.GatewayEnabled
	}
	return r.GatewayEnabled
}

func (r cvmAPIResponse) secureTimeValue() *bool {
	if r.ComposeFile != nil && r.ComposeFile.SecureTime != nil {
		return r.ComposeFile.SecureTime
	}
	return r.SecureTime
}

func (r cvmAPIResponse) storageFSValue() string {
	if r.ComposeFile != nil && strings.TrimSpace(r.ComposeFile.StorageFS) != "" {
		return r.ComposeFile.StorageFS
	}
	return r.StorageFS
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

func cvmPath(id string) string {
	return "/cvms/" + url.PathEscape(id)
}

func selectCVMIdentifier(resp cvmAPIResponse, provisionAppID string) string {
	if id := resp.idString(); id != "" {
		return id
	}
	if strings.TrimSpace(resp.VMUUID) != "" {
		return resp.VMUUID
	}
	if strings.TrimSpace(resp.AppID) != "" {
		return ensureAppPrefix(resp.AppID)
	}
	if strings.TrimSpace(provisionAppID) != "" {
		return ensureAppPrefix(provisionAppID)
	}
	return ""
}

func ensureAppPrefix(v string) string {
	trimmed := strings.TrimSpace(v)
	if trimmed == "" {
		return ""
	}
	if strings.HasPrefix(trimmed, "app_") || strings.HasPrefix(trimmed, "0x") {
		return trimmed
	}
	if len(trimmed) == 40 {
		return "app_" + trimmed
	}
	return trimmed
}

// ---------------------------------------------------------------------------
// Compose-file update helpers
// ---------------------------------------------------------------------------

func provisionAndApplyComposeFileUpdate(
	ctx context.Context,
	client *APIClient,
	cvmID string,
	provisionReq map[string]any,
) error {
	if strings.TrimSpace(cvmID) == "" {
		return fmt.Errorf("missing cvm id for compose update")
	}
	if strings.TrimSpace(stringFromAny(provisionReq["name"])) == "" {
		return fmt.Errorf("compose update requires non-empty name")
	}

	var provisionResp struct {
		ComposeHash string `json:"compose_hash"`
	}
	if err := client.PostJSON(ctx, cvmPath(cvmID)+"/compose_file/provision", provisionReq, &provisionResp); err != nil {
		return err
	}
	if strings.TrimSpace(provisionResp.ComposeHash) == "" {
		return fmt.Errorf("compose update provision did not return compose_hash")
	}

	triggerReq := map[string]any{
		"compose_hash": provisionResp.ComposeHash,
	}
	if err := client.PatchJSON(ctx, cvmPath(cvmID)+"/compose_file", triggerReq, nil); err != nil {
		return err
	}
	return nil
}

// ---------------------------------------------------------------------------
// Terraform-value helpers
// ---------------------------------------------------------------------------

func nullableString(v string) types.String {
	if strings.TrimSpace(v) == "" {
		return types.StringNull()
	}
	return types.StringValue(v)
}

func waitTimeout(v types.Int64) time.Duration {
	if v.IsNull() || v.IsUnknown() || v.ValueInt64() <= 0 {
		return 10 * time.Minute
	}
	return time.Duration(v.ValueInt64()) * time.Second
}

func shouldWait(v types.Bool) bool {
	if v.IsNull() || v.IsUnknown() {
		return true
	}
	return v.ValueBool()
}

func listValueAsStrings(ctx context.Context, value types.List, fieldName string) ([]string, diag.Diagnostics) {
	var diags diag.Diagnostics
	if value.IsNull() {
		return nil, diags
	}
	if value.IsUnknown() {
		diags.AddError("Unknown list value", fmt.Sprintf("%s must be known at apply time.", fieldName))
		return nil, diags
	}

	var out []string
	diags.Append(value.ElementsAs(ctx, &out, false)...)
	if diags.HasError() {
		return nil, diags
	}

	clean := make([]string, 0, len(out))
	for _, v := range out {
		trimmed := strings.TrimSpace(v)
		if trimmed != "" {
			clean = append(clean, trimmed)
		}
	}

	return clean, diags
}

func mapValueAsStrings(ctx context.Context, value types.Map, fieldName string) (map[string]string, diag.Diagnostics) {
	var diags diag.Diagnostics
	if value.IsNull() {
		return nil, diags
	}
	if value.IsUnknown() {
		diags.AddError("Unknown map value", fmt.Sprintf("%s must be known at apply time.", fieldName))
		return nil, diags
	}

	var out map[string]string
	diags.Append(value.ElementsAs(ctx, &out, false)...)
	if diags.HasError() {
		return nil, diags
	}

	clean := make(map[string]string, len(out))
	for k, v := range out {
		key := strings.TrimSpace(k)
		if key == "" {
			diags.AddError("Invalid env key", "env map contains an empty key.")
			continue
		}
		clean[key] = v
	}
	if diags.HasError() {
		return nil, diags
	}

	return clean, diags
}

func sortedEnvKeys(env map[string]string) []string {
	keys := make([]string, 0, len(env))
	for k := range env {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func knownOptionalString(value types.String, fieldName string) (string, bool, diag.Diagnostics) {
	var diags diag.Diagnostics
	if value.IsNull() {
		return "", false, diags
	}
	if value.IsUnknown() {
		diags.AddError("Unknown string value", fmt.Sprintf("%s must be known at apply time.", fieldName))
		return "", false, diags
	}
	return value.ValueString(), true, diags
}

func knownOptionalInt64(value types.Int64, fieldName string) (int64, bool, diag.Diagnostics) {
	var diags diag.Diagnostics
	if value.IsNull() {
		return 0, false, diags
	}
	if value.IsUnknown() {
		diags.AddError("Unknown integer value", fmt.Sprintf("%s must be known at apply time.", fieldName))
		return 0, false, diags
	}
	return value.ValueInt64(), true, diags
}

// ---------------------------------------------------------------------------
// Provisioning identity helpers
// ---------------------------------------------------------------------------

// provisionIdentity holds the resolved KMS and custom app identity values
// for a provision request.
type provisionIdentity struct {
	KMSType        string
	CustomAppID    string
	HasCustomAppID bool
	Nonce          int64
	HasNonce       bool
}

func resolveProvisionIdentity(
	kmsValue types.String,
	customAppIDValue types.String,
	nonceValue types.Int64,
) (provisionIdentity, diag.Diagnostics) {
	var diags diag.Diagnostics
	var id provisionIdentity

	kmsRaw, hasKMS, kmsDiags := knownOptionalString(kmsValue, "kms")
	diags.Append(kmsDiags...)
	id.KMSType = "phala"
	if hasKMS {
		normalized, err := normalizeKMSType(kmsRaw)
		if err != nil {
			diags.AddError("Invalid kms", err.Error())
		} else {
			id.KMSType = normalized
		}
	}

	var customDiags diag.Diagnostics
	id.CustomAppID, id.HasCustomAppID, customDiags = knownOptionalString(customAppIDValue, "custom_app_id")
	diags.Append(customDiags...)
	id.CustomAppID = strings.TrimSpace(id.CustomAppID)
	if id.HasCustomAppID && id.CustomAppID == "" {
		diags.AddError("Invalid custom_app_id", "custom_app_id cannot be empty.")
	}

	var nonceDiags diag.Diagnostics
	id.Nonce, id.HasNonce, nonceDiags = knownOptionalInt64(nonceValue, "nonce")
	diags.Append(nonceDiags...)
	if id.HasNonce && id.Nonce < 0 {
		diags.AddError("Invalid nonce", "nonce must be greater than or equal to 0.")
	}

	if id.HasNonce && !id.HasCustomAppID {
		diags.AddError("Invalid nonce configuration", "nonce requires custom_app_id to be set.")
	}
	if id.HasCustomAppID && id.KMSType == "phala" && !id.HasNonce {
		diags.AddError("Invalid custom_app_id configuration", "nonce is required when custom_app_id is set with kms = phala.")
	}
	if id.HasNonce && id.KMSType != "phala" {
		diags.AddError("Invalid nonce configuration", "nonce is only supported when kms = phala.")
	}
	if id.KMSType != "phala" {
		diags.AddError(
			"Unsupported kms flow",
			"Only kms = phala is currently supported by this provider. On-chain kms flows (ethereum/base) are planned but not implemented yet.",
		)
	}

	return id, diags
}

func normalizeKMSType(raw string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "phala":
		return "phala", nil
	case "ethereum", "eth":
		return "ethereum", nil
	case "base":
		return "base", nil
	default:
		return "", fmt.Errorf(`kms must be one of "phala", "ethereum", "eth", or "base"`)
	}
}

func kmsPayloadValue(kms string) string {
	switch kms {
	case "ethereum":
		return "ETHEREUM"
	case "base":
		return "BASE"
	default:
		return "PHALA"
	}
}

func validateEncryptedEnvConfig(
	hasEncryptedEnv bool,
	hasEnvKeys bool,
	envComposeHash string,
	envTransactionHash string,
) diag.Diagnostics {
	var diags diag.Diagnostics

	if hasEnvKeys && !hasEncryptedEnv {
		diags.AddError(
			"Invalid encrypted env configuration",
			"env_keys requires encrypted_env to be set.",
		)
	}

	hasCompose := strings.TrimSpace(envComposeHash) != ""
	hasTx := strings.TrimSpace(envTransactionHash) != ""
	if hasCompose != hasTx {
		diags.AddError(
			"Invalid phase-2 env update configuration",
			"env_compose_hash and env_transaction_hash must be set together.",
		)
	}
	if (hasCompose || hasTx) && !hasEncryptedEnv {
		diags.AddError(
			"Invalid phase-2 env update configuration",
			"env_compose_hash/env_transaction_hash requires encrypted_env to be set.",
		)
	}

	return diags
}

// ---------------------------------------------------------------------------
// Encryption helpers
// ---------------------------------------------------------------------------

func encryptEnvMap(env map[string]string, publicKeyBase64 string) (string, error) {
	pubkeyBytes, err := decodeEnvPublicKey(publicKeyBase64)
	if err != nil {
		return "", fmt.Errorf("decode env encryption key: %w", err)
	}
	if len(pubkeyBytes) != 32 {
		return "", fmt.Errorf("invalid env encryption key length: expected 32 bytes, got %d", len(pubkeyBytes))
	}

	curve := ecdh.X25519()
	remotePub, err := curve.NewPublicKey(pubkeyBytes)
	if err != nil {
		return "", fmt.Errorf("parse env encryption key: %w", err)
	}
	ephemeralPriv, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		return "", fmt.Errorf("generate ephemeral key: %w", err)
	}

	sharedSecret, err := ephemeralPriv.ECDH(remotePub)
	if err != nil {
		return "", fmt.Errorf("derive shared secret: %w", err)
	}
	if len(sharedSecret) < 32 {
		return "", fmt.Errorf("invalid shared secret length: %d", len(sharedSecret))
	}

	block, err := aes.NewCipher(sharedSecret[:32])
	if err != nil {
		return "", fmt.Errorf("create AES cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create AES-GCM cipher: %w", err)
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}

	type envVar struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}

	keys := make([]string, 0, len(env))
	for key := range env {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	envVars := make([]envVar, 0, len(keys))
	for _, key := range keys {
		envVars = append(envVars, envVar{
			Key:   key,
			Value: env[key],
		})
	}

	plaintext, err := json.Marshal(map[string][]envVar{
		"env": envVars,
	})
	if err != nil {
		return "", fmt.Errorf("marshal env payload: %w", err)
	}

	ephemeralPub := ephemeralPriv.PublicKey().Bytes()
	ciphertext := aead.Seal(nil, nonce, plaintext, nil)

	out := make([]byte, 0, len(ephemeralPub)+len(nonce)+len(ciphertext))
	out = append(out, ephemeralPub...)
	out = append(out, nonce...)
	out = append(out, ciphertext...)

	return hex.EncodeToString(out), nil
}

func decodeEnvPublicKey(v string) ([]byte, error) {
	trimmed := strings.TrimSpace(v)
	if trimmed == "" {
		return nil, fmt.Errorf("empty value")
	}
	trimmed = strings.TrimPrefix(trimmed, "0x")
	trimmed = strings.TrimPrefix(trimmed, "0X")

	// Newer API versions return a hex-encoded X25519 public key.
	if out, err := hex.DecodeString(trimmed); err == nil && len(out) == 32 {
		return out, nil
	}

	// Backward compatibility for legacy base64 responses.
	if out, err := base64.StdEncoding.DecodeString(trimmed); err == nil {
		return out, nil
	}
	if out, err := base64.RawStdEncoding.DecodeString(trimmed); err == nil {
		return out, nil
	}

	return nil, fmt.Errorf("unable to decode public key (expected 32-byte hex or base64 format)")
}

// ---------------------------------------------------------------------------
// Text / API helpers
// ---------------------------------------------------------------------------

func normalizeTextBody(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	var asString string
	if err := json.Unmarshal([]byte(trimmed), &asString); err == nil {
		return asString
	}

	return raw
}

func isNotFound(err error) bool {
	apiErr, ok := err.(*APIError)
	return ok && apiErr.StatusCode == 404
}

func isRetryable(err error) bool {
	apiErr, ok := err.(*APIError)
	if !ok {
		return false
	}
	return isRetryableStatus(apiErr.StatusCode)
}
