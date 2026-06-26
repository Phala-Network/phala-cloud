import { z } from "zod";
import type { FetchOptions, FetchRequest } from "ofetch";
import type { PhalaCloudError } from "../utils/errors";

/**
 * Supported API versions
 */
export type ApiVersion = "2025-10-28" | "2026-01-21" | "2026-05-22" | "2026-06-23";

/**
 * Default API version (latest stable)
 */
export type DefaultApiVersion = "2026-06-23";

/**
 * Full HTTP response including status, headers, and parsed body
 */
export interface FullResponse<T = unknown> {
  /** HTTP status code */
  status: number;
  /** HTTP status text */
  statusText: string;
  /** Response headers */
  headers: Headers;
  /** Parsed response body */
  data: T;
  /** Whether the response status is 2xx */
  ok: boolean;
}

/**
 * Options for the generic request method
 */
export interface RequestOptions extends Omit<FetchOptions, "method"> {
  /** HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, etc.) */
  method?: string;
  /** Request body (for POST, PUT, PATCH) */
  body?: RequestInit["body"] | Record<string, unknown>;
}

/**
 * Enhanced error type that includes both HTTP and validation errors
 */
export type SafeError = PhalaCloudError | z.ZodError;

/**
 * Result type for safe operations, similar to zod's SafeParseResult
 * Enhanced to handle both HTTP and validation errors by default
 */
export type SafeResult<T, E = SafeError> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E };

/**
 * Client configuration - extends FetchOptions and adds predefined API-specific options
 *
 * Environment Variables:
 * - PHALA_CLOUD_API_KEY: API key for authentication
 * - PHALA_CLOUD_API_PREFIX: Base URL prefix for the API
 */
export interface ClientConfig<V extends ApiVersion = ApiVersion> extends FetchOptions {
  /**
   * API key for authentication
   * If not provided, will read from PHALA_CLOUD_API_KEY environment variable
   * Not required when useCookieAuth is true
   */
  apiKey?: string;

  /**
   * Base URL for the API (overrides FetchOptions baseURL)
   * If not provided, will read from PHALA_CLOUD_API_PREFIX environment variable
   * Defaults to "https://cloud-api.phala.com/api/v1"
   */
  baseURL?: string;

  /** Default timeout in milliseconds (overrides FetchOptions timeout) */
  timeout?: number;

  /**
   * API version to use
   */
  version?: V;

  /**
   * Use cookie-based authentication instead of API key
   * When true, API key is not required and credentials: "include" is set
   */
  useCookieAuth?: boolean;

  /**
   * Custom response error handler
   * Will be called in addition to the default error logging
   */
  onResponseError?: (context: {
    request: FetchRequest;
    response: Response;
    options: FetchOptions;
  }) => void | Promise<void>;
}

/**
 * Resolved client configuration with version guaranteed
 */
export interface ResolvedClientConfig<V extends ApiVersion = ApiVersion>
  extends Omit<ClientConfig<V>, "version"> {
  version: V;
}
