import { ofetch, type FetchOptions, type FetchRequest, FetchError } from "ofetch";
import debug from "debug";
import mitt, { type Emitter, type Handler } from "mitt";
import {
  type SafeResult,
  type ClientConfig,
  type ResolvedClientConfig,
  type FullResponse,
  type RequestOptions,
  type ApiVersion,
  type DefaultApiVersion,
} from "./types/client";
import type { Prettify } from "./types/common";
import { parseApiError, PhalaCloudError, RequestError } from "./utils/errors";
export type {
  SafeResult,
  FullResponse,
  RequestOptions,
  ApiVersion,
  DefaultApiVersion,
} from "./types/client";

export const SUPPORTED_API_VERSIONS = [
  "2025-10-28",
  "2026-01-21",
  "2026-05-22",
  "2026-06-23",
] as const satisfies readonly ApiVersion[];
export const DEFAULT_API_VERSION: DefaultApiVersion = "2026-06-23";
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
export class Client<V extends ApiVersion = DefaultApiVersion> {
  protected fetchInstance: typeof ofetch;
  public readonly config: ResolvedClientConfig<V>;
  private emitter: Emitter<ClientEvents>;

  constructor(config: ClientConfig<V> = {} as ClientConfig<V>) {
    // Initialize event emitter
    this.emitter = mitt<ClientEvents>();
    // Resolve configuration with environment variables
    const resolvedApiKey = config.apiKey || process?.env?.PHALA_CLOUD_API_KEY;
    const resolvedBearerToken = config.bearerToken || process?.env?.PHALA_OIDC_TOKEN;
    const resolvedWorkspace = config.workspace || process?.env?.PHALA_CLOUD_WORKSPACE;
    const resolvedBaseURL =
      config.baseURL ||
      process?.env?.PHALA_CLOUD_API_PREFIX ||
      "https://cloud-api.phala.com/api/v1";

    const version = (
      config.version && (SUPPORTED_API_VERSIONS as readonly string[]).includes(config.version)
        ? config.version
        : DEFAULT_API_VERSION
    ) as V;

    this.config = {
      ...config,
      apiKey: resolvedApiKey,
      bearerToken: resolvedBearerToken,
      workspace: resolvedWorkspace,
      baseURL: resolvedBaseURL,
      version,
    } as ResolvedClientConfig<V>;

    // Extract our custom options and pass the rest to ofetch
    const {
      apiKey,
      bearerToken,
      workspace,
      baseURL,
      timeout,
      headers,
      useCookieAuth,
      onResponseError,
      ...fetchOptions
    } = this.config;

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

    // Only add API key / bearer headers when not using cookie auth.
    // Prefer X-API-Key when both are present so existing API-key flows stay unchanged.
    if (!useCookieAuth && apiKey) {
      requestHeaders["X-API-Key"] = apiKey;
    } else if (!useCookieAuth && bearerToken) {
      requestHeaders["Authorization"] = `Bearer ${bearerToken}`;
    }

    if (workspace && typeof workspace === "string" && workspace.trim().length > 0) {
      requestHeaders["X-Phala-Workspace"] = workspace.trim();
    }

    this.fetchInstance = ofetch.create({
      baseURL,
      timeout: timeout || 60000,
      headers: requestHeaders,
      ...(useCookieAuth ? { credentials: "include" } : {}),
      ...fetchOptions,

      // Strip Content-Type for FormData so the browser/runtime sets
      // the correct multipart/form-data boundary automatically.
      // This runs after ofetch merges instance and per-request headers,
      // so deleting here is final.
      onRequest({ request, options }) {
        if (options.body instanceof FormData) {
          const h = options.headers;
          if (h instanceof Headers) {
            h.delete("content-type");
          } else if (h && typeof h === "object" && !Array.isArray(h)) {
            delete (h as Record<string, string>)["Content-Type"];
            delete (h as Record<string, string>)["content-type"];
          }
        }
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
        if (logger.enabled) {
          console.warn(`HTTP ${response.status}: ${response.url}`);
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
   * Generic request method (throws PhalaCloudError on error)
   */
  async request<T = unknown>(url: string, options?: RequestOptions): Promise<T> {
    try {
      const method = options?.method || "GET";
      return await this.fetchInstance<T>(url, {
        ...options,
        method,
      } as Parameters<typeof this.fetchInstance<T>>[1]);
    } catch (error) {
      const requestError = this.convertToRequestError(error);
      const phalaCloudError = this.emitError(requestError);
      throw phalaCloudError;
    }
  }

  /**
   * Generic request method that returns the full response (status + headers + data)
   *
   * Unlike other direct methods, this does NOT throw for non-2xx HTTP statuses.
   * It only throws for network/transport/unexpected errors.
   */
  async requestFull<T = unknown>(url: string, options?: RequestOptions): Promise<FullResponse<T>> {
    try {
      const method = options?.method || "GET";
      const response = await this.fetchInstance.raw(url, {
        ...options,
        method,
        ignoreResponseError: true,
      } as Parameters<(typeof this.fetchInstance)["raw"]>[1]);

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: (response as unknown as { _data: T })._data,
        ok: response.ok,
      };
    } catch (error) {
      const requestError = this.convertToRequestError(error);
      const phalaCloudError = this.emitError(requestError);
      throw phalaCloudError;
    }
  }

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
   * Build request options, stripping Content-Type when body is FormData
   * so the browser/runtime sets the correct multipart boundary automatically.
   */
  // biome-ignore lint/suspicious/noExplicitAny: ofetch generic variance
  private buildRequestOptions<T = any>(
    method: string,
    body: RequestInit["body"] | Record<string, unknown> | undefined,
    options?: Omit<FetchOptions, "method" | "body">,
  ): Parameters<typeof this.fetchInstance<T>>[1] {
    const opts = { ...options, method, body } as Parameters<typeof this.fetchInstance<T>>[1];
    if (body instanceof FormData) {
      const existing = (opts as Record<string, unknown>).headers as
        | Record<string, string>
        | undefined;
      (opts as Record<string, unknown>).headers = {
        ...existing,
        "Content-Type": "",
      };
    }
    return opts;
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
      return await this.fetchInstance<T>(request, this.buildRequestOptions("POST", body, options));
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
      return await this.fetchInstance<T>(request, this.buildRequestOptions("PUT", body, options));
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
      return await this.fetchInstance<T>(request, this.buildRequestOptions("PATCH", body, options));
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
   * Safe wrapper around the generic request method (returns SafeResult)
   */
  async safeRequestMethod<T = unknown>(
    url: string,
    options?: RequestOptions,
  ): Promise<SafeResult<T, PhalaCloudError>> {
    return this.safeRequest(() => this.request<T>(url, options));
  }

  /**
   * Safe wrapper around requestFull (returns SafeResult)
   */
  async safeRequestFull<T = unknown>(
    url: string,
    options?: RequestOptions,
  ): Promise<SafeResult<FullResponse<T>, PhalaCloudError>> {
    return this.safeRequest(() => this.requestFull<T>(url, options));
  }

  /**
   * Create a new client with a different API version
   *
   * @example
   * ```typescript
   * const client = createClient(); // defaults to 2026-05-22
   * const legacyClient = client.withVersion("2025-10-28");
   * const data = await getCvmInfo(legacyClient, { id: "xxx" });
   * ```
   */
  withVersion<NewV extends ApiVersion>(version: NewV): Client<NewV> {
    return new Client<NewV>({
      ...this.config,
      version,
    } as ClientConfig<NewV>);
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
    actions: TActions | ((client: Client<V>) => TActions),
  ): Prettify<
    this & {
      [K in keyof TActions]: TActions[K] extends (client: Client<V>) => infer R
        ? () => R
        : TActions[K] extends (client: Client<V>, ...args: infer P) => infer R
          ? (...args: P) => R
          : never;
    }
  > {
    const actionsObj = (typeof actions === "function" ? actions(this) : actions) as TActions;

    const extended = Object.create(this) as this & {
      [K in keyof TActions]: TActions[K] extends (client: Client<V>) => infer R
        ? () => R
        : TActions[K] extends (client: Client<V>, ...args: infer P) => infer R
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
 * // Using a specific API version
 * const client = createClient({ version: '2025-10-28' })
 *
 * // To enable debug logging:
 * // DEBUG=phala::api-client node your-script.js
 * ```
 */
export function createClient(
  config: ClientConfig<"2026-06-23"> & { version: "2026-06-23" },
): Client<"2026-06-23">;
export function createClient(
  config: ClientConfig<"2026-05-22"> & { version: "2026-05-22" },
): Client<"2026-05-22">;
export function createClient(
  config: ClientConfig<"2026-01-21"> & { version: "2026-01-21" },
): Client<"2026-01-21">;
export function createClient(
  config: ClientConfig<"2025-10-28"> & { version: "2025-10-28" },
): Client<"2025-10-28">;
export function createClient(config?: ClientConfig): Client<DefaultApiVersion>;
export function createClient<V extends ApiVersion>(
  config: ClientConfig<V> = {} as ClientConfig<V>,
): Client<V> {
  return new Client<V>(config);
}
