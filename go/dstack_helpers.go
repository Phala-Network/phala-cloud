package phala

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"

	dstacksdk "github.com/Dstack-TEE/dstack/sdk/go/dstack"
	"golang.org/x/crypto/sha3"
)

// EnvVar represents an environment variable key-value pair.
type EnvVar = dstacksdk.EnvVar

// AppCompose represents the application composition structure used for compose hashing.
type AppCompose = dstacksdk.AppCompose

// DockerConfig represents Docker registry credentials used by AppCompose.
type DockerConfig = dstacksdk.DockerConfig

// KeyProviderKind represents the key provider type used by AppCompose.
type KeyProviderKind = dstacksdk.KeyProviderKind

const (
	KeyProviderNone  = dstacksdk.KeyProviderNone
	KeyProviderKMS   = dstacksdk.KeyProviderKMS
	KeyProviderLocal = dstacksdk.KeyProviderLocal
)

// VerifyEnvEncryptPublicKeyOptions configures timestamp validation for signature verification.
type VerifyEnvEncryptPublicKeyOptions = dstacksdk.VerifyEnvEncryptPublicKeyOptions

// EncryptEnvVars encrypts environment variables using the upstream dstack Go SDK implementation.
func EncryptEnvVars(envs []EnvVar, publicKeyHex string) (string, error) {
	return dstacksdk.EncryptEnvVars(envs, publicKeyHex)
}

// GetComposeHash computes the compose hash using the upstream dstack Go SDK implementation.
func GetComposeHash(appCompose AppCompose, normalize ...bool) (string, error) {
	return dstacksdk.GetComposeHash(appCompose, normalize...)
}

// VerifyEnvEncryptPublicKey verifies the signature of an env encryption public key.
func VerifyEnvEncryptPublicKey(publicKey []byte, signature []byte, appID string) ([]byte, error) {
	return dstacksdk.VerifyEnvEncryptPublicKey(publicKey, signature, appID)
}

// VerifyEnvEncryptPublicKeyWithTimestamp verifies a timestamped env encryption public-key signature.
func VerifyEnvEncryptPublicKeyWithTimestamp(
	publicKey []byte,
	signature []byte,
	appID string,
	timestamp uint64,
	opts *VerifyEnvEncryptPublicKeyOptions,
) ([]byte, error) {
	return dstacksdk.VerifyEnvEncryptPublicKeyWithTimestamp(publicKey, signature, appID, timestamp, opts)
}

// MrConfigIdInput holds the inputs for computing a V2 mr_config_id.
type MrConfigIdInput struct {
	ComposeHash     [32]byte
	AppID           [20]byte
	KeyProviderType KeyProviderKind
	KeyProviderID   []byte
}

// keyProviderByte maps a KeyProviderKind to the single-byte encoding used by
// dstack-types/src/mr_config.rs.
func keyProviderByte(kp KeyProviderKind) (byte, error) {
	switch kp {
	case KeyProviderNone:
		return 0, nil
	case KeyProviderLocal:
		return 1, nil
	case KeyProviderKMS:
		return 2, nil
	case "tpm":
		return 3, nil
	default:
		return 0, fmt.Errorf("unknown key provider kind: %q", kp)
	}
}

// GetMrConfigIdV1 computes a V1 mr_config_id from compose_hash alone.
// Format: 0x01 || compose_hash (32 bytes) || zeros (15 bytes) = 48 bytes.
func GetMrConfigIdV1(composeHash [32]byte) [48]byte {
	var result [48]byte
	result[0] = 1
	copy(result[1:33], composeHash[:])
	return result
}

// GetMrConfigId computes a V2 mr_config_id.
//
// Mirrors dstack-types/src/mr_config.rs MrConfig::V2::to_mr_config_id().
//
// LEGACY VMMs ONLY. dstack stopped generating V2 for new VMs: a TDX VM that
// declares key_provider_id now measures MrConfigV3, and V2 survives only as
// the fallback for VMs that predate the stored mr_config document
// (dstack/vmm/src/app/mr_config.rs). Keep it for verifying those quotes; never
// use it to describe a new deployment.
//
// Hash input (concatenated raw bytes):
//   - compose_hash: [32]byte
//   - app_id: [20]byte
//   - key_provider_type: 1 byte (none=0, local=1, kms=2, tpm=3)
//   - key_provider_id: []byte (variable length)
//
// Output: 0x02 || keccak256(above) (32 bytes) || zeros (15 bytes) = 48 bytes.
func GetMrConfigId(input MrConfigIdInput) ([48]byte, error) {
	kpByte, err := keyProviderByte(input.KeyProviderType)
	if err != nil {
		return [48]byte{}, err
	}

	hasher := sha3.NewLegacyKeccak256()
	hasher.Write(input.ComposeHash[:])
	hasher.Write(input.AppID[:])
	hasher.Write([]byte{kpByte})
	hasher.Write(input.KeyProviderID)
	digest := hasher.Sum(nil)

	var result [48]byte
	result[0] = 2
	copy(result[1:33], digest[:32])
	return result, nil
}

// GetMrConfigIdHex is a convenience wrapper that accepts and returns hex strings.
func GetMrConfigIdHex(composeHashHex, appIDHex string, kp KeyProviderKind, kpIDHex string) (string, error) {
	composeHashHex = strings.TrimPrefix(composeHashHex, "0x")
	appIDHex = strings.TrimPrefix(appIDHex, "0x")
	kpIDHex = strings.TrimPrefix(kpIDHex, "0x")

	composeHash, err := hex.DecodeString(composeHashHex)
	if err != nil {
		return "", fmt.Errorf("invalid compose_hash hex: %w", err)
	}
	if len(composeHash) != 32 {
		return "", fmt.Errorf("compose_hash must be 32 bytes, got %d", len(composeHash))
	}

	appID, err := hex.DecodeString(appIDHex)
	if err != nil {
		return "", fmt.Errorf("invalid app_id hex: %w", err)
	}
	if len(appID) != 20 {
		return "", fmt.Errorf("app_id must be 20 bytes, got %d", len(appID))
	}

	var kpID []byte
	if kpIDHex != "" {
		kpID, err = hex.DecodeString(kpIDHex)
		if err != nil {
			return "", fmt.Errorf("invalid key_provider_id hex: %w", err)
		}
	}

	var input MrConfigIdInput
	copy(input.ComposeHash[:], composeHash)
	copy(input.AppID[:], appID)
	input.KeyProviderType = kp
	input.KeyProviderID = kpID

	result, err := GetMrConfigId(input)
	if err != nil {
		return "", err
	}
	return "0x" + hex.EncodeToString(result[:]), nil
}

// VerifyMrConfigId checks whether a given mr_config_id matches the expected
// value computed from the provided inputs.
func VerifyMrConfigId(mrConfigIDHex string, composeHashHex, appIDHex string, kp KeyProviderKind, kpIDHex string) (bool, error) {
	expected, err := GetMrConfigIdHex(composeHashHex, appIDHex, kp, kpIDHex)
	if err != nil {
		return false, err
	}
	return strings.EqualFold(expected, mrConfigIDHex), nil
}

// mrConfigV3Domain is the domain separator hashed ahead of the MrConfigV3
// document bytes.
const mrConfigV3Domain = "dstack-mr-config-v3:"

// MaxInitScripts is the number of init scripts dstack is willing to bind.
const MaxInitScripts = 5

// MrConfigV3Document is the MrConfigV3 document, field for field as dstack
// serializes it (dstack-types/src/mr_config.rs MrConfigV3).
//
// Byte fields carry the exact spelling the canonical JSON uses: lowercase hex,
// no "0x" prefix. Optional fields are empty when absent, which is what
// #[skip_serializing_none] produces on the Rust side. InitScriptHashes is nil
// when the field is omitted and non-nil-but-empty when the compose is
// manifest_version >= 3 with no init scripts — two different documents.
type MrConfigV3Document struct {
	Version          int
	AppID            string
	ComposeHash      string
	GpuPolicyHash    string
	KeyProvider      KeyProviderKind
	KeyProviderID    string
	InstanceID       string
	InitScriptHashes []string
}

// MrConfigV3Input holds the loose inputs accepted when building a document.
// Every hex field accepts a "0x" prefix or none.
type MrConfigV3Input struct {
	// AppID is 20 bytes. Empty means dstack pins no application identity.
	AppID string
	// ComposeHash is 32 bytes.
	ComposeHash string
	// GpuPolicyHash is 32 bytes, set only when the VM has GPUs attached.
	GpuPolicyHash string
	KeyProvider   KeyProviderKind
	// KeyProviderID is variable length, empty for KeyProviderNone.
	KeyProviderID string
	// InstanceID is 20 bytes, empty when the compose sets no_instance_id.
	InstanceID string
	// InitScriptHashes are 32 bytes each, in execution order. A nil slice
	// omits the field; a non-nil empty slice requires no init scripts.
	InitScriptHashes []string
}

func normalizeMrConfigHex(value, field string) (string, error) {
	bare := strings.ToLower(strings.TrimPrefix(strings.TrimPrefix(value, "0x"), "0X"))
	if _, err := hex.DecodeString(bare); err != nil {
		return "", fmt.Errorf("invalid %s hex: %w", field, err)
	}
	return bare, nil
}

func expectMrConfigByteLength(bare string, size int, field string) error {
	if len(bare) != size*2 {
		return fmt.Errorf("%s must be %d bytes, got %d", field, size, len(bare)/2)
	}
	return nil
}

// BuildMrConfigV3Document builds the MrConfigV3 document dstack would generate
// for these inputs.
//
// Mirrors VmWorkDir::prepare_mr_config_v3 in dstack/vmm/src/app/mr_config.rs:
// empty optional byte fields are dropped rather than serialized as empty
// strings, so a no_instance_id compose yields a document with no instance_id
// key at all.
func BuildMrConfigV3Document(input MrConfigV3Input) (MrConfigV3Document, error) {
	document := MrConfigV3Document{Version: 3, KeyProvider: input.KeyProvider}

	composeHash, err := normalizeMrConfigHex(input.ComposeHash, "compose_hash")
	if err != nil {
		return MrConfigV3Document{}, err
	}
	if err := expectMrConfigByteLength(composeHash, 32, "compose_hash"); err != nil {
		return MrConfigV3Document{}, err
	}
	document.ComposeHash = composeHash

	if input.AppID != "" {
		appID, err := normalizeMrConfigHex(input.AppID, "app_id")
		if err != nil {
			return MrConfigV3Document{}, err
		}
		if err := expectMrConfigByteLength(appID, 20, "app_id"); err != nil {
			return MrConfigV3Document{}, err
		}
		document.AppID = appID
	}

	if input.GpuPolicyHash != "" {
		gpuPolicyHash, err := normalizeMrConfigHex(input.GpuPolicyHash, "gpu_policy_hash")
		if err != nil {
			return MrConfigV3Document{}, err
		}
		if err := expectMrConfigByteLength(gpuPolicyHash, 32, "gpu_policy_hash"); err != nil {
			return MrConfigV3Document{}, err
		}
		document.GpuPolicyHash = gpuPolicyHash
	}

	if input.KeyProviderID != "" {
		keyProviderID, err := normalizeMrConfigHex(input.KeyProviderID, "key_provider_id")
		if err != nil {
			return MrConfigV3Document{}, err
		}
		document.KeyProviderID = keyProviderID
	}

	if input.InstanceID != "" {
		instanceID, err := normalizeMrConfigHex(input.InstanceID, "instance_id")
		if err != nil {
			return MrConfigV3Document{}, err
		}
		if err := expectMrConfigByteLength(instanceID, 20, "instance_id"); err != nil {
			return MrConfigV3Document{}, err
		}
		document.InstanceID = instanceID
	}

	if input.InitScriptHashes != nil {
		if len(input.InitScriptHashes) > MaxInitScripts {
			return MrConfigV3Document{}, fmt.Errorf("init_script_hashes supports at most %d hashes", MaxInitScripts)
		}
		hashes := make([]string, 0, len(input.InitScriptHashes))
		for index, value := range input.InitScriptHashes {
			field := fmt.Sprintf("init_script_hashes[%d]", index)
			bare, err := normalizeMrConfigHex(value, field)
			if err != nil {
				return MrConfigV3Document{}, err
			}
			if err := expectMrConfigByteLength(bare, 32, field); err != nil {
				return MrConfigV3Document{}, err
			}
			hashes = append(hashes, bare)
		}
		document.InitScriptHashes = hashes
	}

	return document, nil
}

// CanonicalizeMrConfigV3Document renders an MrConfigV3 document as RFC 8785
// (JCS) JSON, byte for byte what serde_jcs::to_string produces for the Rust
// struct.
//
// The document is a flat object whose values are hex strings, one enum string,
// one small integer, and an array of hex strings. That reduces JCS to three
// rules here: emit the member names in ascending code-unit order (they are all
// ASCII, and the order below is that order), emit no whitespace, and print the
// one number as a bare integer. No value needs JSON string escaping, because
// every string is [0-9a-f]* or one of none/kms/local/tpm.
func CanonicalizeMrConfigV3Document(document MrConfigV3Document) string {
	var members []string
	appendMember := func(key, value string) {
		members = append(members, fmt.Sprintf("%q:%q", key, value))
	}

	if document.AppID != "" {
		appendMember("app_id", document.AppID)
	}
	appendMember("compose_hash", document.ComposeHash)
	if document.GpuPolicyHash != "" {
		appendMember("gpu_policy_hash", document.GpuPolicyHash)
	}
	if document.InitScriptHashes != nil {
		quoted := make([]string, 0, len(document.InitScriptHashes))
		for _, value := range document.InitScriptHashes {
			quoted = append(quoted, fmt.Sprintf("%q", value))
		}
		members = append(members, fmt.Sprintf("%q:[%s]", "init_script_hashes", strings.Join(quoted, ",")))
	}
	if document.InstanceID != "" {
		appendMember("instance_id", document.InstanceID)
	}
	appendMember("key_provider", string(document.KeyProvider))
	if document.KeyProviderID != "" {
		appendMember("key_provider_id", document.KeyProviderID)
	}
	members = append(members, fmt.Sprintf("%q:%d", "version", document.Version))

	return "{" + strings.Join(members, ",") + "}"
}

func hashMrConfigV3Document(document MrConfigV3Document) [32]byte {
	hasher := sha256.New()
	hasher.Write([]byte(mrConfigV3Domain))
	hasher.Write([]byte{0})
	hasher.Write([]byte(CanonicalizeMrConfigV3Document(document)))
	var digest [32]byte
	copy(digest[:], hasher.Sum(nil))
	return digest
}

// GetMrConfigIdV3 computes the TDX mr_config_id V3 for a document.
//
// Output: 0x03 || sha256(domain || 0x00 || JCS(document)) (32 bytes) || zeros (15 bytes).
//
// Mirrors MrConfigV3::tdx_mr_config_id_from_document in
// dstack-types/src/mr_config.rs.
func GetMrConfigIdV3(document MrConfigV3Document) [48]byte {
	digest := hashMrConfigV3Document(document)
	var result [48]byte
	result[0] = 3
	copy(result[1:33], digest[:])
	return result
}

// GetSnpHostDataV3 computes the AMD SEV-SNP host_data for a document: the same
// 32-byte digest as GetMrConfigIdV3, carried without the version byte or the
// padding.
func GetSnpHostDataV3(document MrConfigV3Document) [32]byte {
	return hashMrConfigV3Document(document)
}

// GetMrConfigIdV3Hex is a convenience wrapper returning the V3 mr_config_id as
// "0x"-prefixed hex.
func GetMrConfigIdV3Hex(input MrConfigV3Input) (string, error) {
	document, err := BuildMrConfigV3Document(input)
	if err != nil {
		return "", err
	}
	result := GetMrConfigIdV3(document)
	return "0x" + hex.EncodeToString(result[:]), nil
}

// VerifyMrConfigIdV3 checks a V3 mr_config_id against the document inputs it
// should have been derived from.
func VerifyMrConfigIdV3(mrConfigIDHex string, input MrConfigV3Input) (bool, error) {
	expected, err := GetMrConfigIdV3Hex(input)
	if err != nil {
		return false, err
	}
	return strings.EqualFold(expected, mrConfigIDHex), nil
}

// VerifyMrConfigIdAnyVersion verifies a mr_config_id against the inputs it
// should have been derived from, dispatching on the version byte. A single
// call therefore verifies quotes from legacy VMMs (V1 compose-hash-only, V2
// keccak) and current ones (V3 document digest) alike. The V3-only fields of
// the input are ignored for V1 and V2.
func VerifyMrConfigIdAnyVersion(mrConfigIDHex string, input MrConfigV3Input) (bool, error) {
	bare := strings.ToLower(strings.TrimPrefix(strings.TrimPrefix(mrConfigIDHex, "0x"), "0X"))
	if len(bare) != 96 {
		return false, nil
	}

	switch bare[:2] {
	case "01":
		composeHash, err := normalizeMrConfigHex(input.ComposeHash, "compose_hash")
		if err != nil {
			return false, err
		}
		if err := expectMrConfigByteLength(composeHash, 32, "compose_hash"); err != nil {
			return false, err
		}
		var raw [32]byte
		decoded, err := hex.DecodeString(composeHash)
		if err != nil {
			return false, err
		}
		copy(raw[:], decoded)
		expected := GetMrConfigIdV1(raw)
		return strings.EqualFold(hex.EncodeToString(expected[:]), bare), nil
	case "02":
		expected, err := GetMrConfigIdHex(input.ComposeHash, input.AppID, input.KeyProvider, input.KeyProviderID)
		if err != nil {
			return false, err
		}
		return strings.EqualFold(strings.TrimPrefix(expected, "0x"), bare), nil
	case "03":
		expected, err := GetMrConfigIdV3Hex(input)
		if err != nil {
			return false, err
		}
		return strings.EqualFold(strings.TrimPrefix(expected, "0x"), bare), nil
	default:
		return false, nil
	}
}
