// Client
export {
  createClient as createBaseClient,
  type Client as BaseClient,
  SUPPORTED_API_VERSIONS,
} from "./client";
export { createClient, type Client } from "./create-client";

// Types
export * from "./types";

// Credentials (versioned auth response schemas)
export * from "./credentials";

// Actions
export * from "./actions";

// CVM logs (log-gateway; not bound as client methods)
export {
  LogAccessError,
  fetchCvmLogs,
  followCvmLogs,
  fetchCvmChannelLogs,
  streamCvmChannelLogs,
  fetchContainerLogs,
  fetchContainerLogsEntries,
  streamContainerLogs,
  streamContainerLogsEntries,
  getCvmLogEndpoint,
  resolveLogTimeWindow,
  type CvmLogChannel,
  type CvmLogEntry,
  type CvmLogFormat,
  type CvmLogSource,
  type CvmLogsOptions,
  type LogChannel,
} from "./actions/cvms/logs";

// Utils
export * from "./utils";
export { defineAction, defineSimpleAction } from "./utils/define-action";

// Dotenv parsing
export { parseEnv, parseEnvVars } from "./parse_dotenv";

export {
  encryptEnvVars,
  type EnvVar,
} from "@phala/dstack-sdk/encrypt-env-vars";
export {
  verifyEnvEncryptPublicKey,
  verifyEnvEncryptPublicKeyLegacy,
} from "@phala/dstack-sdk/verify-env-encrypt-public-key";
