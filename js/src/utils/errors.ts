import { z } from "zod";
import type { FetchError, FetchRequest } from "ofetch";

/**
 * API Error Response Schema
 */
export const ApiErrorSchema = z.object({
  detail: z
    .union([
      z.string(),
      z.array(
        z
          .object({
            msg: z.string(),
            type: z.string().optional(),
            ctx: z.record(z.unknown()).optional(),
            loc: z.array(z.union([z.string(), z.number()])).optional(),
            input: z.unknown().optional(),
          })
          .passthrough(), // Allow additional fields
      ),
      z.record(z.unknown()),
    ])
    .optional(),
  type: z.string().optional(),
  code: z.string().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

function extractRequestId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const requestId = (data as Record<string, unknown>).request_id;
  return typeof requestId === "string" ? requestId : undefined;
}

function extractRequestIdFromResponse(
  response: { headers?: { get(name: string): string | null } } | undefined,
): string | undefined {
  return response?.headers?.get("X-Request-ID") ?? undefined;
}

/**
 * Structured validation error item from FastAPI/Pydantic
 */
export interface ValidationErrorItem {
  /** Field path (e.g., "name", "body.memory", "query.page") */
  field: string;
  /** Human-readable error message */
  message: string;
  /** Error type from Pydantic (e.g., "string_too_short", "greater_than_equal") */
  type: string;
  /** Additional context (e.g., { min_length: 4 }) */
  context?: Record<string, unknown>;
}

/**
 * Base class for all Phala Cloud API errors
 */
export class PhalaCloudError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly detail?:
    | string
    | Record<string, unknown>
    | Array<{ msg: string; type?: string; ctx?: Record<string, unknown> }>;
  public readonly requestId?: string;

  constructor(
    message: string,
    data: {
      status: number;
      statusText: string;
      detail?:
        | string
        | Record<string, unknown>
        | Array<{ msg: string; type?: string; ctx?: Record<string, unknown> }>;
      requestId?: string;
    },
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = data.status;
    this.statusText = data.statusText;
    this.detail = data.detail;
    this.requestId = data.requestId;

    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Base error class for HTTP requests
 * Extends PhalaCloudError with additional HTTP-specific properties
 */
export class RequestError extends PhalaCloudError implements ApiError {
  public readonly name = "RequestError";
  public readonly isRequestError = true as const; // Type discriminator
  public readonly data?: unknown;
  public readonly request?: FetchRequest | undefined;
  public readonly response?: Response | undefined;
  public readonly code?: string | undefined;
  public readonly type?: string | undefined;

  constructor(
    message: string,
    options?: {
      status?: number | undefined;
      statusText?: string | undefined;
      data?: unknown;
      request?: FetchRequest | undefined;
      response?: Response | undefined;
      cause?: unknown;
      detail?:
        | string
        | Record<string, unknown>
        | Array<{
            msg: string;
            type?: string;
            ctx?: Record<string, unknown>;
            loc?: (string | number)[];
            input?: unknown;
            [key: string]: unknown;
          }>;
      code?: string | undefined;
      type?: string | undefined;
      requestId?: string | undefined;
    },
  ) {
    super(message, {
      status: options?.status ?? 0,
      statusText: options?.statusText ?? "Unknown Error",
      detail: options?.detail || message,
      requestId: options?.requestId,
    });

    this.data = options?.data;
    this.request = options?.request;
    this.response = options?.response;
    this.code = options?.code;
    this.type = options?.type;
  }

  /**
   * Create RequestError from FetchError
   */
  static fromFetchError(error: FetchError): RequestError {
    const bodyRequestId = extractRequestId(error.data);
    const headerRequestId = extractRequestIdFromResponse(error.response);
    const requestId = bodyRequestId ?? headerRequestId;

    // Try to parse the error response as ApiError
    const parseResult = ApiErrorSchema.safeParse(error.data);

    if (parseResult.success) {
      // If ApiErrorSchema matched but detail is undefined, the response may use
      // StructuredError format (error_code, details array, etc). Fall back to
      // the raw response data so parseStructuredError can handle it downstream.
      const detail =
        parseResult.data.detail ??
        (error.data && typeof error.data === "object" && "error_code" in error.data
          ? error.data
          : undefined);

      return new RequestError(error.message, {
        status: error.status ?? undefined,
        statusText: error.statusText ?? undefined,
        data: error.data,
        request: error.request ?? undefined,
        response: error.response ?? undefined,
        detail: detail as
          | string
          | Record<string, unknown>
          | Array<{
              msg: string;
              type?: string;
              ctx?: Record<string, unknown>;
              loc?: (string | number)[];
              input?: unknown;
              [key: string]: unknown;
            }>,
        code: parseResult.data.code ?? undefined,
        type: parseResult.data.type ?? undefined,
        requestId,
      });
    }

    // Detect ofetch timeout (AbortController fired due to options.timeout):
    // ofetch wraps the underlying TimeoutError in FetchError.cause and prepends
    // "[TimeoutError]:" to the message.
    const cause = (error as { cause?: { name?: string } }).cause;
    if (cause?.name === "TimeoutError" || error.message?.includes("[TimeoutError]")) {
      // Put the actionable hint in `detail` so parseApiError's
      // extractPrimaryMessage surfaces it (it prefers detail over the bare
      // FetchError message like "[POST] ...: <no response>").
      const friendly =
        "Request timed out. The server did not respond in time. " +
        "Increase the timeout via createClient({ timeout }) or the CLI --timeout flag.";
      return new RequestError(friendly, {
        status: 0,
        statusText: "Request Timeout",
        data: error.data,
        request: error.request ?? undefined,
        response: error.response ?? undefined,
        detail: friendly,
        code: "TIMEOUT",
        requestId,
      });
    }

    // Fallback to raw error data — preserve the underlying error message so
    // callers see something actionable (e.g. ofetch's "[GET] ...: <no response>"
    // for network failures) instead of a generic "Unknown API error".
    return new RequestError(error.message, {
      status: error.status ?? undefined,
      statusText: error.statusText ?? undefined,
      data: error.data,
      request: error.request ?? undefined,
      response: error.response ?? undefined,
      detail: error.data?.detail || error.message || "Unknown API error",
      code: error.status?.toString() ?? undefined,
      requestId,
    });
  }

  /**
   * Create RequestError from generic Error
   */
  static fromError(error: Error, request?: FetchRequest): RequestError {
    return new RequestError(error.message, {
      request: request ?? undefined,
      detail: error.message,
    });
  }
}

/**
 * Validation error from FastAPI/Pydantic (422)
 * Use instanceof to check: if (error instanceof ValidationError) { ... }
 * Or use property: if (error.isValidationError) { ... }
 */
export class ValidationError extends PhalaCloudError {
  public readonly isValidationError = true as const;
  public readonly validationErrors: ValidationErrorItem[];

  constructor(
    message: string,
    data: {
      status: number;
      statusText: string;
      detail?:
        | string
        | Record<string, unknown>
        | Array<{
            msg: string;
            type?: string;
            ctx?: Record<string, unknown>;
            loc?: (string | number)[];
            input?: unknown;
            [key: string]: unknown;
          }>;
      validationErrors: ValidationErrorItem[];
    },
  ) {
    super(message, data);
    this.validationErrors = data.validationErrors;
  }
}

/**
 * Authentication/Authorization error (401, 403)
 * Use instanceof to check: if (error instanceof AuthError) { ... }
 * Or use property: if (error.isAuthError) { ... }
 */
export class AuthError extends PhalaCloudError {
  public readonly isAuthError = true as const;
}

/**
 * Business logic error (400, 409, etc.)
 * Use instanceof to check: if (error instanceof BusinessError) { ... }
 * Or use property: if (error.isBusinessError) { ... }
 */
export class BusinessError extends PhalaCloudError {
  public readonly isBusinessError = true as const;
}

/**
 * Server error (500+)
 * Use instanceof to check: if (error instanceof ServerError) { ... }
 * Or use property: if (error.isServerError) { ... }
 */
export class ServerError extends PhalaCloudError {
  public readonly isServerError = true as const;
}

/**
 * Unknown error (network issues, etc.)
 * Use instanceof to check: if (error instanceof UnknownError) { ... }
 * Or use property: if (error.isUnknownError) { ... }
 */
export class UnknownError extends PhalaCloudError {
  public readonly isUnknownError = true as const;
}

/**
 * FastAPI validation error detail structure
 */
interface FastApiValidationErrorItem {
  loc?: (string | number)[]; // Optional: some backends may not include location
  msg: string;
  type: string;
  ctx?: Record<string, unknown>;
  input?: unknown; // Optional: input value that failed validation
}

/**
 * Extract field path from Pydantic location array
 * @example ["body", "name"] => "name"
 * @example ["query", "page"] => "page"
 * @example ["body", "resources", "memory"] => "resources.memory"
 */
function extractFieldPath(loc: (string | number)[] | undefined | null): string {
  // Handle undefined or null loc
  if (!loc || !Array.isArray(loc)) {
    return "unknown";
  }

  // Remove location prefixes like "body", "query", "path"
  const filtered = loc.filter((part) => {
    if (typeof part === "string") {
      return !["body", "query", "path", "header"].includes(part);
    }
    return true;
  });

  // Join remaining parts with dots
  return filtered.length > 0 ? filtered.join(".") : "unknown";
}

/**
 * Parse FastAPI/Pydantic validation errors (422)
 */
function parseValidationErrors(detail: unknown): {
  errors: ValidationErrorItem[];
  message: string;
} {
  // FastAPI validation errors are always an array
  if (!Array.isArray(detail)) {
    return {
      errors: [],
      message: typeof detail === "string" ? detail : "Validation error",
    };
  }

  const errors: ValidationErrorItem[] = detail.map(
    (item: FastApiValidationErrorItem, index: number) => {
      const field = extractFieldPath(item.loc);

      // If field is "unknown" and we have type info, use that
      let displayField = field;
      if (field === "unknown" && item.type) {
        // Convert type like "missing" to something more descriptive
        displayField = item.type === "missing" ? "required field" : item.type;
      }

      return {
        field: displayField,
        message: item.msg,
        type: item.type,
        context: item.ctx,
      };
    },
  );

  // Generate summary message
  const count = errors.length;
  const message =
    count === 1
      ? `Validation failed: ${errors[0]!.message}`
      : `Validation failed (${count} issue${count > 1 ? "s" : ""})`;

  return { errors, message };
}

/**
 * Categorize error type based on status code
 */
function categorizeErrorType(
  status: number,
): "validation" | "auth" | "business" | "server" | "unknown" {
  // Validation errors (422)
  if (status === 422) {
    return "validation";
  }

  // Authentication errors (401)
  if (status === 401) {
    return "auth";
  }

  // Authorization errors (403)
  if (status === 403) {
    return "auth";
  }

  // Business logic errors (400, 409, etc.)
  if (status >= 400 && status < 500) {
    return "business";
  }

  // Server errors (500+)
  if (status >= 500) {
    return "server";
  }

  return "unknown";
}

/**
 * Extract primary message from error detail
 */
function extractPrimaryMessage(status: number, detail: unknown, defaultMessage: string): string {
  // For validation errors, use the parsed message
  if (status === 422 && Array.isArray(detail)) {
    const { message } = parseValidationErrors(detail);
    return message;
  }

  // For string details, use directly
  if (typeof detail === "string") {
    return detail;
  }

  // For object details, try to extract a message
  if (detail && typeof detail === "object" && "message" in detail) {
    const msg = (detail as { message: unknown }).message;
    if (typeof msg === "string") {
      return msg;
    }
  }

  // Fallback to default message
  return defaultMessage;
}

/**
 * Parse RequestError into PhalaCloudError instance
 *
 * Returns the appropriate error subclass based on status code:
 * - New structured errors (with error_code) → ResourceError
 * - 422 → ValidationError (with validationErrors array)
 * - 401, 403 → AuthError
 * - 400, 409, etc. → BusinessError
 * - 500+ → ServerError
 * - Other → UnknownError
 *
 * @param requestError - The RequestError from API call
 * @returns PhalaCloudError subclass instance
 *
 * @example
 * ```typescript
 * try {
 *   await client.post('/cvms', data);
 * } catch (error) {
 *   if (error instanceof ResourceError) {
 *     // New structured error with error code
 *     console.error(`Error [${error.errorCode}]: ${error.message}`);
 *     if (error.suggestions) {
 *       error.suggestions.forEach(s => console.log(s));
 *     }
 *   } else if (error instanceof ValidationError) {
 *     // TypeScript knows error.validationErrors exists
 *     error.validationErrors.forEach(e => {
 *       console.error(`${e.field}: ${e.message}`);
 *     });
 *   } else if (error instanceof AuthError) {
 *     // Handle auth error
 *   }
 * }
 * ```
 */
export function parseApiError(requestError: RequestError): PhalaCloudError {
  const status = requestError.status ?? 0;
  const statusText = requestError.statusText ?? "Unknown Error";
  const detail = requestError.detail;

  // Try to parse as structured error first (new format with error codes)
  const structured = parseStructuredError(detail);
  if (structured) {
    return new ResourceError(structured.message, {
      status,
      statusText,
      detail,
      requestId: structured.request_id ?? requestError.requestId,
      errorCode: structured.error_code,
      structuredDetails: structured.details,
      suggestions: structured.suggestions,
      links: structured.links,
    });
  }

  // Fallback to original logic for backward compatibility
  const errorType = categorizeErrorType(status);
  const message = extractPrimaryMessage(status, detail, requestError.message);
  const commonData = { status, statusText, detail, requestId: requestError.requestId };

  // Return appropriate error subclass
  if (errorType === "validation" && Array.isArray(detail)) {
    const { errors } = parseValidationErrors(detail);
    return new ValidationError(message, {
      ...commonData,
      validationErrors: errors,
    });
  }

  if (errorType === "auth") {
    return new AuthError(message, commonData);
  }

  if (errorType === "business") {
    return new BusinessError(message, commonData);
  }

  if (errorType === "server") {
    return new ServerError(message, commonData);
  }

  return new UnknownError(message, commonData);
}

/**
 * Extract all field names from validation errors
 *
 * @deprecated Use `error instanceof ValidationError` and `error.validationErrors` directly
 */
export function getValidationFields(error: PhalaCloudError): string[] {
  if (error instanceof ValidationError) {
    return error.validationErrors.map((e) => e.field);
  }
  return [];
}

/**
 * Format validation errors for display
 *
 * @param errors - Array of validation error items
 * @param options - Formatting options
 * @returns Formatted string for display
 *
 * @example
 * ```typescript
 * if (error instanceof ValidationError) {
 *   const formatted = formatValidationErrors(error.validationErrors, {
 *     numbered: true,
 *     indent: 2
 *   });
 *   console.error(formatted);
 * }
 * // Output:
 * //   1. name: String should have at least 4 characters
 * //   2. memory: Input should be greater than or equal to 1024
 * ```
 */
export function formatValidationErrors(
  errors: ValidationErrorItem[],
  options?: {
    /** Add numbers to each error (default: true) */
    numbered?: boolean;
    /** Indent size in spaces (default: 2) */
    indent?: number;
    /** Show field names (default: true) */
    showFields?: boolean;
  },
): string {
  const { numbered = true, indent = 2, showFields = true } = options ?? {};

  const indentStr = " ".repeat(indent);

  return errors
    .map((error, index) => {
      const prefix = numbered ? `${index + 1}. ` : "• ";
      const field = showFields ? `${error.field}: ` : "";
      return `${indentStr}${prefix}${field}${error.message}`;
    })
    .join("\n");
}

/**
 * Create a user-friendly error message from PhalaCloudError
 *
 * @param error - Phala Cloud API error
 * @param options - Formatting options
 * @returns Formatted error message
 *
 * @example
 * ```typescript
 * try {
 *   await client.post('/cvms', data);
 * } catch (error) {
 *   if (error instanceof PhalaCloudError) {
 *     console.error(formatErrorMessage(error));
 *   }
 * }
 * // Output:
 * // Validation failed (2 issues)
 * //
 * //   1. name: String should have at least 4 characters
 * //   2. memory: Input should be greater than or equal to 1024
 * ```
 */
export function formatErrorMessage(
  error: PhalaCloudError,
  options?: {
    /** Include field names in validation errors (default: true) */
    showFields?: boolean;
    /** Include error class name in output (default: false) */
    showType?: boolean;
  },
): string {
  const { showFields = true, showType = false } = options ?? {};

  const parts: string[] = [];

  // Add error type if requested
  if (showType) {
    parts.push(`[${error.constructor.name.toUpperCase()}]`);
  }

  // Add primary message
  parts.push(error.message);

  // Add validation errors if present
  if (error instanceof ValidationError && error.validationErrors.length > 0) {
    parts.push("");
    parts.push(formatValidationErrors(error.validationErrors, { showFields }));
  }

  return parts.join("\n");
}

/**
 * Extract error message from API error
 *
 * @param error - API error object
 * @returns Error message string
 */
export function getErrorMessage(error: ApiError): string {
  if (typeof error.detail === "string") {
    return error.detail;
  }

  if (Array.isArray(error.detail)) {
    if (error.detail.length > 0) {
      return error.detail[0]?.msg || "Validation error";
    }
    return "Validation error";
  }

  if (typeof error.detail === "object" && error.detail !== null) {
    return JSON.stringify(error.detail);
  }

  return "Unknown error occurred";
}

/**
 * Structured error detail from new error format (ERR-xxxx codes)
 */
export interface StructuredErrorDetail {
  field?: string;
  value?: unknown;
  message?: string;
}

/**
 * Error link from structured error response
 */
export interface ErrorLink {
  url: string;
  label: string;
}

/**
 * New structured error response format with unique error codes
 */
export interface StructuredErrorResponse {
  error_code: string; // e.g., "ERR-01-001"
  message: string;
  request_id?: string;
  details?: StructuredErrorDetail[];
  suggestions?: string[];
  links?: ErrorLink[];
}

/**
 * Resource provisioning error with structured details
 * Extends BusinessError to handle new error format from backend
 *
 * Use instanceof to check: if (error instanceof ResourceError) { ... }
 * Or use property: if (error.isResourceError) { ... }
 */
export class ResourceError extends BusinessError {
  public readonly isResourceError = true as const;
  public readonly errorCode?: string;
  public readonly structuredDetails?: StructuredErrorDetail[];
  public readonly suggestions?: string[];
  public readonly links?: ErrorLink[];

  constructor(
    message: string,
    data: {
      status: number;
      statusText: string;
      detail?:
        | string
        | Record<string, unknown>
        | Array<{
            msg: string;
            type?: string;
            ctx?: Record<string, unknown>;
            loc?: (string | number)[];
            input?: unknown;
            [key: string]: unknown;
          }>;
      requestId?: string;
      errorCode?: string;
      structuredDetails?: StructuredErrorDetail[];
      suggestions?: string[];
      links?: ErrorLink[];
    },
  ) {
    super(message, data);
    this.errorCode = data.errorCode;
    this.structuredDetails = data.structuredDetails;
    this.suggestions = data.suggestions;
    this.links = data.links;
  }
}

/**
 * Parse structured error response (new format with ERR-xxxx codes)
 */
function parseStructuredError(detail: unknown): StructuredErrorResponse | null {
  if (!detail || typeof detail !== "object") {
    return null;
  }

  const obj = detail as Record<string, unknown>;

  // Check if it's the new structured error format
  if (
    obj.error_code &&
    typeof obj.error_code === "string" &&
    obj.message &&
    typeof obj.message === "string"
  ) {
    return {
      error_code: obj.error_code,
      message: obj.message,
      request_id: typeof obj.request_id === "string" ? obj.request_id : undefined,
      details: obj.details as StructuredErrorDetail[] | undefined,
      suggestions: obj.suggestions as string[] | undefined,
      links: obj.links as ErrorLink[] | undefined,
    };
  }

  return null;
}

/**
 * Format structured error for display
 *
 * @param error - Resource error with structured details
 * @param options - Formatting options
 * @returns Formatted error message
 *
 * @example
 * ```typescript
 * try {
 *   await client.provisionCvm(payload);
 * } catch (error) {
 *   if (error instanceof ResourceError) {
 *     console.error(formatStructuredError(error));
 *   }
 * }
 * // Output:
 * // Error [ERR-01-001]: The requested instance type does not exist
 * //
 * // Details:
 * //   - Instance type 'invalid' is not recognized
 * //
 * // Suggestions:
 * //   - Use a valid instance type: tdx.small, tdx.medium, or tdx.large
 * //   - Alternatively, specify CPU and memory requirements manually
 * //
 * // Learn more:
 * //   - View available instance types: https://cloud.phala.com/instances
 * //   - Contact support: https://cloud.phala.com/support
 * ```
 */
export function formatStructuredError(
  error: ResourceError,
  options?: {
    /** Show error code in output (default: true) */
    showErrorCode?: boolean;
    /** Show suggestions (default: true) */
    showSuggestions?: boolean;
    /** Show links (default: true) */
    showLinks?: boolean;
  },
): string {
  const { showErrorCode = true, showSuggestions = true, showLinks = true } = options ?? {};

  const parts: string[] = [];

  // Error code and message
  if (showErrorCode && error.errorCode) {
    parts.push(`Error [${error.errorCode}]: ${error.message}`);
  } else {
    parts.push(error.message);
  }

  if (error.requestId) {
    parts.push(`Request ID: ${error.requestId}`);
  }

  // Details
  if (error.structuredDetails && error.structuredDetails.length > 0) {
    parts.push("");
    parts.push("Details:");
    error.structuredDetails.forEach((d) => {
      if (d.message) {
        parts.push(`  - ${d.message}`);
      } else if (d.field && d.value !== undefined) {
        parts.push(`  - ${d.field}: ${d.value}`);
      }
    });
  }

  // Suggestions
  if (showSuggestions && error.suggestions && error.suggestions.length > 0) {
    parts.push("");
    parts.push("Suggestions:");
    error.suggestions.forEach((s) => {
      parts.push(`  - ${s}`);
    });
  }

  // Links
  if (showLinks && error.links && error.links.length > 0) {
    parts.push("");
    parts.push("Learn more:");
    error.links.forEach((link) => {
      parts.push(`  - ${link.label}: ${link.url}`);
    });
  }

  return parts.join("\n");
}

/**
 * Check if an error is a conflict error (409).
 */
export function isConflictError(error: PhalaCloudError): boolean {
  return error.status === 409;
}

/**
 * Check if an error is an app_id conflict from idempotent CVM creation.
 * This means the app_id already has an active CVM with a different compose_hash.
 */
export function isAppIdConflictError(error: PhalaCloudError): error is ResourceError {
  return error instanceof ResourceError && error.errorCode === "ERR-03-007";
}
