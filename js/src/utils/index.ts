export { encryptEnvVars } from "@phala/dstack-sdk/encrypt-env-vars";
export {
  getComposeHash,
  dumpAppCompose,
  preprocessAppCompose,
  sortObject,
  withComposeMethods,
  type AppCompose,
  type AppComposeWithMethods,
  type SortableValue,
  type SortableObject,
  type SortableArray,
} from "./get_compose_hash";
export { asHex } from "./as-hex";
export { validateActionParameters, safeValidateActionParameters } from "./validate-parameters";
export {
  isValidHostname,
  convertToHostname,
  generateFallbackHostname,
  generateDefaultCvmName,
} from "./hostname";

// Error parsing utilities
export {
  // Error parser
  parseApiError,
  // Error classes
  PhalaCloudError,
  RequestError,
  ValidationError,
  AuthError,
  BusinessError,
  ServerError,
  UnknownError,
  ResourceError,
  // Formatting utilities
  formatValidationErrors,
  formatErrorMessage,
  formatStructuredError,
  getErrorMessage,
  // Conflict helpers
  isConflictError,
  isAppIdConflictError,
  // Deprecated utilities
  getValidationFields,
  // Types
  type ValidationErrorItem,
  type StructuredErrorDetail,
  type ErrorLink,
  type StructuredErrorResponse,
  ApiErrorSchema,
  type ApiError,
} from "./errors";

// Error code constants
export { ErrorCodes, type ErrorCode } from "./error_codes";

// Network utilities
export {
  // Core network functions
  createNetworkClients,
  extractNetworkClients,
  // Network operations
  checkNetworkStatus,
  checkBalance,
  validateNetworkPrerequisites,
  // Transaction utilities
  waitForTransactionReceipt,
  executeTransaction,
  // Error classes
  NetworkError,
  WalletError,
  TransactionError,
  // Types
  type NetworkConfig,
  type WalletConnection,
  type NetworkClients,
  type BalanceCheckResult,
  type TransactionOptions,
  type TransactionResult,
} from "./network";

// Transaction utilities
export {
  // Transaction tracking
  createTransactionTracker,
  // Batch operations
  executeBatchTransactions,
  // Retry mechanisms
  executeTransactionWithRetry,
  // Gas estimation
  estimateTransactionGas,
  // Types
  type TransactionState,
  type TransactionStatus,
  type TransactionTracker,
  type BatchTransactionOptions,
  type BatchTransactionResult,
  type RetryOptions,
  type GasEstimationOptions,
} from "./transaction";

// Optional convenience functions (not required, but helpful for quick start)
export {
  // Convenience client factories
  createClientsFromPrivateKey,
  createClientsFromBrowser,
  autoCreateClients,
  // Convenience browser operations
  switchToNetwork,
  addNetwork,
} from "./client-factories";
