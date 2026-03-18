package phala

// Structured error codes returned by the Phala Cloud API.
// Use with APIError.HasErrorCode() to match specific errors.
//
// Error codes follow the format ERR-{MODULE}-{CODE} where MODULE is a
// two-digit module identifier and CODE is a three-digit sequential number.

// Module 01: CVM Preflight & Compose Hash
const (
	ErrNodeNotFound        = "ERR-01-001"
	ErrComposeFileRequired = "ERR-01-002"
	ErrInvalidComposeFile  = "ERR-01-003"
	ErrDuplicateCvmName    = "ERR-01-004"
	ErrHashRegistration    = "ERR-01-005"
	ErrHashInvalidExpired  = "ERR-01-006"
	ErrTxVerifyFailed      = "ERR-01-007"
	ErrHashNotAllowed      = "ERR-01-008"
)

// Module 02: Inventory
const (
	ErrInstanceTypeNotFound  = "ERR-02-001"
	ErrResourceNotAvailable  = "ERR-02-002"
	ErrInsufficientVcpu      = "ERR-02-003"
	ErrInsufficientMemory    = "ERR-02-004"
	ErrInsufficientSlots     = "ERR-02-005"
	ErrGpuAllocation         = "ERR-02-006"
	ErrInsufficientGpu       = "ERR-02-007"
	ErrInvalidRequest        = "ERR-02-008"
	ErrIncompatibleConfig    = "ERR-02-009"
	ErrImageNotFound         = "ERR-02-010"
	ErrKmsNotFound           = "ERR-02-011"
	ErrTeepodNotAccessible   = "ERR-02-012"
	ErrOsImageNotCompatible  = "ERR-02-013"
	ErrNodeCapacityNotConfig = "ERR-02-014"
	ErrQuotaExceeded         = "ERR-02-015"
)

// Module 03: CVM Operations
const (
	ErrCvmNotFound          = "ERR-03-001"
	ErrMultipleCvmsSameName = "ERR-03-002"
	// ERR-03-003 and ERR-03-004 are CvmNotInWorkspaceError variants (reveal/hide existence).
	ErrCvmNotInWorkspace    = "ERR-03-003"
	ErrCvmAccessDenied      = "ERR-03-005"
	ErrReplicaImageNotAvail = "ERR-03-006"
	ErrCvmAppIdConflict     = "ERR-03-007"
)

// Module 04: Workspace
const (
	ErrInsufficientBalance = "ERR-04-001"
	ErrMaxCvmLimit         = "ERR-04-002"
	ErrResourceLimitExceed = "ERR-04-003"
)

// Module 05: Credentials
const (
	ErrTokenLimitExceeded = "ERR-05-001"
	ErrTokenRateLimit     = "ERR-05-002"
)

// Module 06: Auth
const (
	ErrOAuthEmailInvalid = "ERR-06-001"
)
