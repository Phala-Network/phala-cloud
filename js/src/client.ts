import { ofetch, type FetchOptions, type FetchRequest, FetchError } from "ofetch";
import debug from "debug";
import mitt, { type Emitter, type Handler } from "mitt";
import { type SafeResult, type ClientConfig } from "./types/client";
import type { Prettify } from "./types/common";
import { parseApiError, PhalaCloudError, RequestError } from "./utils/errors";
export type { SafeResult } from "./types/client";

export const SUPPORTED_API_VERSIONS = ["2025-05-31", "2025-10-28"] as const;
const logger = debug("phala::api-client");

/**
 * Client event types
 */
type ClientEvents = {
  error: PhalaCloudError;
};

/**
 * Format headers for cURL-like output
 */
function formatHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([key, value]) => `    -H "${key}: ${value}"`)
    .join("\n");
}

/**
 * Format request body for cURL-like output
 */
function formatBody(body: unknown): string {
  if (!body) return "";

  const bodyStr = typeof body === "string" ? body : JSON.stringify(body, null, 2);
  return `    -d '${bodyStr.replace(/'/g, "\\'")}'`;
}

/**
 * Format response for cURL-like output
 */
function formatResponse(
  status: number,
  statusText: string,
  headers: Headers,
  body: unknown,
): string {
  const headerEntries: string[] = [];
  headers.forEach((value, key) => {
    headerEntries.push(`${key}: ${value}`);
  });
  const headerStr = headerEntries.join("\n");

  const bodyStr = typeof body === "string" ? body : JSON.stringify(body, null, 2);

  return [
    `< HTTP/1.1 ${status} ${statusText}`,
    headerStr ? `< ${headerStr.replace(/\n/g, "\n< ")}` : "",
    "",
    bodyStr,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * HTTP Client class with ofetch compatibility
 */
export class Client {
  protected fetchInstance: typeof ofetch;
  public readonly config: ClientConfig;
  private emitter: Emitter<ClientEvents>;

  constructor(config: ClientConfig = {}) {
    // Initialize event emitter
    this.emitter = mitt<ClientEvents>();
    // Resolve configuration with environment variables
    const resolvedConfig: ClientConfig = {
      ...config,
      apiKey: config.apiKey || process?.env?.PHALA_CLOUD_API_KEY,
      baseURL:
        config.baseURL ||
        process?.env?.PHALA_CLOUD_API_PREFIX ||
        "https://cloud-api.phala.network/api/v1",
    };

    const version =
      resolvedConfig.version &&
      (SUPPORTED_API_VERSIONS as readonly string[]).includes(resolvedConfig.version)
        ? resolvedConfig.version!
        : SUPPORTED_API_VERSIONS[SUPPORTED_API_VERSIONS.length - 1]!; // Default to latest version

    this.config = resolvedConfig;

    // Extract our custom options and pass the rest to ofetch
    const { apiKey, baseURL, timeout, headers, useCookieAuth, onResponseError, ...fetchOptions } =
      resolvedConfig;

    const requestHeaders: Record<string, string> = {
      "X-Phala-Version": version,
      "Content-Type": "application/json",
    };

    // Merge additional headers if provided
    if (headers && typeof headers === "object") {
      Object.entries(headers).forEach(([key, value]) => {
        if (typeof value === "string") {
          requestHeaders[key] = value;
        }
      });
    }

    // Only add API key header when not using cookie auth
    if (!useCookieAuth && apiKey) {
      requestHeaders["X-API-Key"] = apiKey;
    }

    this.fetchInstance = ofetch.create({
      baseURL,
      timeout: timeout || 30000,
      headers: requestHeaders,
      ...(useCookieAuth ? { credentials: "include" } : {}),
      ...fetchOptions,

      // Log request in cURL format
      onRequest({ request, options }) {
        if (logger.enabled) {
          const method = options.method || "GET";
          const url = typeof request === "string" ? request : request.url;
          const fullUrl = url.startsWith("http") ? url : `${baseURL}${url}`;

          // Convert headers to a plain object for formatting
          const headerObj: Record<string, string> = {};
          if (options.headers && typeof options.headers === "object") {
            Object.entries(options.headers).forEach(([key, value]) => {
              if (typeof value === "string") {
                headerObj[key] = value;
              }
            });
          }

          const curlCommand = [
            `> curl -X ${method} "${fullUrl}"`,
            formatHeaders(headerObj),
            options.body ? formatBody(options.body) : "",
          ]
            .filter(Boolean)
            .join("\n");

          logger("\n=== REQUEST ===\n%s\n", curlCommand);
        }
      },

      // Log response in cURL format
      onResponse({ request, response, options }) {
        if (logger.enabled) {
          const method = options.method || "GET";
          const url = typeof request === "string" ? request : request.url;

          logger(
            "\n=== RESPONSE [%s %s] (%dms) ===\n%s\n",
            method,
            url,
            response.headers.get("x-response-time") || "?",
            formatResponse(response.status, response.statusText, response.headers, response._data),
          );
        }
      },

      // Generic handlers for response error (similar to request.ts)
      onResponseError: ({ request, response, options }) => {
        console.warn(`HTTP ${response.status}: ${response.url}`);

        if (logger.enabled) {
          const method = options.method || "GET";
          const url = typeof request === "string" ? request : request.url;

          logger(
            "\n=== ERROR RESPONSE [%s %s] ===\n%s\n",
            method,
            url,
            formatResponse(response.status, response.statusText, response.headers, response._data),
          );
        }

        // Call custom error handler if provided
        if (onResponseError) {
          onResponseError({ request, response, options });
        }
      },
    });
  }

  /**
   * Get the underlying ofetch instance for advanced usage
   */
  get raw() {
    return this.fetchInstance;
  }

  // ===== Event handling methods =====

  /**
   * Listen for error events
   * @param type - Event type ('error' or '*' for all events)
   * @param handler - Event handler function
   *
   * @example
   * ```typescript
   * // Listen to error events
   * client.on('error', (error) => {
   *   console.error('API Error:', error.message);
   * });
   *
   * // Listen to all events
   * client.on('*', (type, error) => {
   *   console.log('Event:', type, error);
   * });
   * ```
   */
  on<K extends keyof ClientEvents>(type: K, handler: Handler<ClientEvents[K]>): void;
  on(type: "*", handler: Handler): void;
  on(type: keyof ClientEvents | "*", handler: Handler<ClientEvents[keyof ClientEvents]>): void {
    this.emitter.on(type as keyof ClientEvents, handler);
  }

  /**
   * Remove event listener
   * @param type - Event type ('error' or '*' for all events)
   * @param handler - Event handler function to remove
   *
   * @example
   * ```typescript
   * const errorHandler = (error) => console.error(error);
   * client.on('error', errorHandler);
   * client.off('error', errorHandler);
   * ```
   */
  off<K extends keyof ClientEvents>(type: K, handler?: Handler<ClientEvents[K]>): void;
  off(type: "*", handler?: Handler): void;
  off(type: keyof ClientEvents | "*", handler?: Handler<ClientEvents[keyof ClientEvents]>): void {
    this.emitter.off(type as keyof ClientEvents, handler);
  }

  /**
   * Listen for event once (automatically removed after first trigger)
   * @param type - Event type ('error' or '*' for all events)
   * @param handler - Event handler function
   *
   * @example
   * ```typescript
   * client.once('error', (error) => {
   *   console.error('First error:', error);
   * });
   * ```
   */
  once<K extends keyof ClientEvents>(type: K, handler: Handler<ClientEvents[K]>): void;
  once(type: "*", handler: Handler): void;
  once(type: keyof ClientEvents | "*", handler: Handler<ClientEvents[keyof ClientEvents]>): void {
    const wrappedHandler = (event: ClientEvents[keyof ClientEvents]) => {
      handler(event);
      this.emitter.off(type as keyof ClientEvents, wrappedHandler);
    };
    this.emitter.on(type as keyof ClientEvents, wrappedHandler);
  }

  // ===== Direct methods (throw on error) =====

  /**
   * Perform GET request (throws PhalaCloudError on error)
   */
  async get<T = unknown>(
    request: FetchRequest,
    options?: Omit<FetchOptions, "method">,
  ): Promise<T> {
    try {
      return await this.fetchInstance<T>(request, {
        ...options,
        method: "GET",
      } as Parameters<typeof this.fetchInstance<T>>[1]);
    } catch (error) {
      const requestError = this.convertToRequestError(error);
      const phalaCloudError = this.emitError(requestError);
      throw phalaCloudError;
    }
  }

  /**
   * Perform POST request (throws PhalaCloudError on error)
   */
  async post<T = unknown>(
    request: FetchRequest,
    body?: RequestInit["body"] | Record<string, unknown>,
    options?: Omit<FetchOptions, "method" | "body">,
  ): Promise<T> {
    try {
      return await this.fetchInstance<T>(request, {
        ...options,
        method: "POST",
        body,
      } as Parameters<typeof this.fetchInstance<T>>[1]);
    } catch (error) {
      const requestError = this.convertToRequestError(error);
      const phalaCloudError = this.emitError(requestError);
      throw phalaCloudError;
    }
  }

  /**
   * Perform PUT request (throws PhalaCloudError on error)
   */
  async put<T = unknown>(
    request: FetchRequest,
    body?: RequestInit["body"] | Record<string, unknown>,
    options?: Omit<FetchOptions, "method" | "body">,
  ): Promise<T> {
    try {
      return await this.fetchInstance<T>(request, {
        ...options,
        method: "PUT",
        body,
      } as Parameters<typeof this.fetchInstance<T>>[1]);
    } catch (error) {
      const requestError = this.convertToRequestError(error);
      const phalaCloudError = this.emitError(requestError);
      throw phalaCloudError;
    }
  }

  /**
   * Perform PATCH request (throws PhalaCloudError on error)
   */
  async patch<T = unknown>(
    request: FetchRequest,
    body?: RequestInit["body"] | Record<string, unknown>,
    options?: Omit<FetchOptions, "method" | "body">,
  ): Promise<T> {
    try {
      return await this.fetchInstance<T>(request, {
        ...options,
        method: "PATCH",
        body,
      } as Parameters<typeof this.fetchInstance<T>>[1]);
    } catch (error) {
      const requestError = this.convertToRequestError(error);
      const phalaCloudError = this.emitError(requestError);
      throw phalaCloudError;
    }
  }

  /**
   * Perform DELETE request (throws PhalaCloudError on error)
   */
  async delete<T = unknown>(
    request: FetchRequest,
    options?: Omit<FetchOptions, "method">,
  ): Promise<T> {
    try {
      return await this.fetchInstance<T>(request, {
        ...options,
        method: "DELETE",
      } as Parameters<typeof this.fetchInstance<T>>[1]);
    } catch (error) {
      const requestError = this.convertToRequestError(error);
      const phalaCloudError = this.emitError(requestError);
      throw phalaCloudError;
    }
  }

  // ===== Safe methods (return SafeResult) =====

  /**
   * Convert any error to RequestError
   */
  private convertToRequestError(error: unknown): RequestError {
    if (error && typeof error === "object" && "data" in error) {
      return RequestError.fromFetchError(error as FetchError);
    }
    if (error instanceof Error) {
      return RequestError.fromError(error);
    }
    return new RequestError("Unknown error occurred", {
      detail: "Unknown error occurred",
    });
  }

  /**
   * Broadcast error to event listeners (fire-and-forget)
   * @param requestError - The request error to handle
   * @returns PhalaCloudError instance to throw immediately
   */
  private emitError(requestError: RequestError): PhalaCloudError {
    // Parse error into PhalaCloudError subclass
    const phalaCloudError = parseApiError(requestError);

    // Emit error event to all listeners
    this.emitter.emit("error", phalaCloudError);

    return phalaCloudError;
  }

  /**
   * Safe wrapper for any request method (zod-style result)
   * Returns PhalaCloudError (all errors extend this base class)
   */
  private async safeRequest<T>(fn: () => Promise<T>): Promise<SafeResult<T, PhalaCloudError>> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      // All errors thrown by get/post/put/patch/delete are PhalaCloudError subclasses
      if (error instanceof PhalaCloudError) {
        return { success: false, error };
      }

      // Unexpected errors - convert to RequestError (which extends PhalaCloudError)
      const requestError = this.convertToRequestError(error);
      this.emitError(requestError);
      return { success: false, error: requestError };
    }
  }

  /**
   * Safe GET request (returns SafeResult)
   */
  async safeGet<T = unknown>(
    request: FetchRequest,
    options?: Omit<FetchOptions, "method">,
  ): Promise<SafeResult<T, PhalaCloudError>> {
    return this.safeRequest(() => this.get<T>(request, options));
  }

  /**
   * Safe POST request (returns SafeResult)
   */
  async safePost<T = unknown>(
    request: FetchRequest,
    body?: RequestInit["body"] | Record<string, unknown>,
    options?: Omit<FetchOptions, "method" | "body">,
  ): Promise<SafeResult<T, PhalaCloudError>> {
    return this.safeRequest(() => this.post<T>(request, body, options));
  }

  /**
   * Safe PUT request (returns SafeResult)
   */
  async safePut<T = unknown>(
    request: FetchRequest,
    body?: RequestInit["body"] | Record<string, unknown>,
    options?: Omit<FetchOptions, "method" | "body">,
  ): Promise<SafeResult<T, PhalaCloudError>> {
    return this.safeRequest(() => this.put<T>(request, body, options));
  }

  /**
   * Safe PATCH request (returns SafeResult)
   */
  async safePatch<T = unknown>(
    request: FetchRequest,
    body?: RequestInit["body"] | Record<string, unknown>,
    options?: Omit<FetchOptions, "method" | "body">,
  ): Promise<SafeResult<T, PhalaCloudError>> {
    return this.safeRequest(() => this.patch<T>(request, body, options));
  }

  /**
   * Safe DELETE request (returns SafeResult)
   */
  async safeDelete<T = unknown>(
    request: FetchRequest,
    options?: Omit<FetchOptions, "method">,
  ): Promise<SafeResult<T, PhalaCloudError>> {
    return this.safeRequest(() => this.delete<T>(request, options));
  }

  /**
   * Extend client with additional actions
   *
   * @example
   * ```typescript
   * const client = createClient({ apiKey: 'xxx' })
   *   .extend(publicActions)
   *   .extend(cvmActions)
   *
   * await client.getCurrentUser() // Method call instead of function call
   * ```
   */
  extend<TActions extends Record<string, unknown>>(
    actions: TActions | ((client: Client) => TActions),
  ): Prettify<
    this & {
      [K in keyof TActions]: TActions[K] extends (client: Client) => infer R
        ? () => R
        : TActions[K] extends (client: Client, ...args: infer P) => infer R
          ? (...args: P) => R
          : never;
    }
  > {
    const actionsObj = (typeof actions === "function" ? actions(this) : actions) as TActions;

    const extended = Object.create(this) as this & {
      [K in keyof TActions]: TActions[K] extends (client: Client) => infer R
        ? () => R
        : TActions[K] extends (client: Client, ...args: infer P) => infer R
          ? (...args: P) => R
          : never;
    };

    // Bind all actions to this client
    for (const [key, action] of Object.entries(actionsObj)) {
      if (typeof action === "function") {
        (extended as Record<string, unknown>)[key] = (...args: unknown[]) => action(this, ...args);
      }
    }

    return extended;
  }
}

/**
 * Create a new HTTP client instance
 *
 * Configuration can be provided via parameters or environment variables:
 * - PHALA_CLOUD_API_KEY: API key for authentication
 * - PHALA_CLOUD_API_PREFIX: Base URL prefix for the API
 *
 * Debug Logging:
 * - Set DEBUG=phala::api-client to enable cURL-like request/response logging
 * - This will print detailed information about each API call in a format similar to cURL
 *
 * @example
 * ```typescript
 * // Using explicit configuration
 * const client = createClient({
 *   apiKey: 'your-api-key',
 *   baseURL: 'https://custom-api.example.com'
 * })
 *
 * // Using environment variables (set PHALA_CLOUD_API_KEY)
 * const client = createClient()
 *
 * // To enable debug logging:
 * // DEBUG=phala::api-client node your-script.js
 * ```
 */
export function createClient(config: ClientConfig = {}): Client {
  return new Client(config);
}
