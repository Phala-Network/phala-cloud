package phala

import dstacksdk "github.com/Dstack-TEE/dstack/sdk/go/dstack"

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
