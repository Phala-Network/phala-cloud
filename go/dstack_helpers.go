package phala

import (
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
