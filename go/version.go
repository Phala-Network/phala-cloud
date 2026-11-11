package phala

import (
	"runtime"
	"strings"
	"time"
)

const (
	// DefaultAPIVersion is the default Phala Cloud API version.
	DefaultAPIVersion = "2026-06-23"

	// kmsContractAPIVersion is the API version that exposes the contract-centric
	// KMS API. The contract methods pin it per request.
	kmsContractAPIVersion = "2026-06-23"

	// DefaultBaseURL is the default Phala Cloud API base URL.
	DefaultBaseURL = "https://cloud-api.phala.com/api/v1"

	// DefaultTimeout is the default per-request HTTP timeout, matching the JS
	// and Python SDKs. Override it with WithTimeout.
	DefaultTimeout = 60 * time.Second

	// sdkVersion is the version of this SDK, used in User-Agent.
	sdkVersion = "0.5.4"
)

// DefaultUserAgent returns the SDK User-Agent product tokens.
// Wrappers can prepend their own product token:
//
//	"my-wrapper/1.0 " + phala.DefaultUserAgent()
//
// WithUserAgent replaces this value entirely.
func DefaultUserAgent() string {
	return "phala-cloud-sdk-go/" + sdkVersion + " go/" + strings.TrimPrefix(runtime.Version(), "go")
}
