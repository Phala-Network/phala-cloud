import { ofetch, type FetchOptions, type FetchRequest, FetchError } from "ofetch";
import debug from "debug";
import { type SafeResult, RequestError, type ClientConfig } from "./types/client";
import type { Prettify } from "./types/common";
export type { SafeResult } from "./types/client";

const SUPPORTED_API_VERSIONS = ["2025-05-31"];
const logger = debug("phala::api-client");

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

  constructor(config: ClientConfig = {}) {
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
      resolvedConfig.version && SUPPORTED_API_VERSIONS.includes(resolvedConfig.version)
        ? resolvedConfig.version!
        : SUPPORTED_API_VERSIONS[0]!;

    this.config = resolvedConfig;

    // Validate that we have an API key (unless using cookie auth)
    if (!resolvedConfig.useCookieAuth && !resolvedConfig.apiKey) {
      throw new Error(
        "API key is required. Provide it via config.apiKey or set PHALA_CLOUD_API_KEY environment variable.",
      );
    }

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

  // ===== Direct methods (throw on error) =====

  /**
   * Perform GET request (throws on error)
   */
  async get<T = unknown>(
    request: FetchRequest,
    options?: Omit<FetchOptions, "method">,
  ): Promise<T> {
    // Note: Type assertion needed due to ofetch's complex generic type system
    return this.fetchInstance<T>(request, {
      ...options,
      method: "GET",
    } as Parameters<typeof this.fetchInstance<T>>[1]);
  }

  /**
   * Perform POST request (throws on error)
   */
  async post<T = unknown>(
    request: FetchRequest,
    body?: RequestInit["body"] | Record<string, unknown>,
    options?: Omit<FetchOptions, "method" | "body">,
  ): Promise<T> {
    // Note: Type assertion needed due to ofetch's complex generic type system
    return this.fetchInstance<T>(request, {
      ...options,
      method: "POST",
      body,
    } as Parameters<typeof this.fetchInstance<T>>[1]);
  }

  /**
   * Perform PUT request (throws on error)
   */
  async put<T = unknown>(
    request: FetchRequest,
    body?: RequestInit["body"] | Record<string, unknown>,
    options?: Omit<FetchOptions, "method" | "body">,
  ): Promise<T> {
    // Note: Type assertion needed due to ofetch's complex generic type system
    return this.fetchInstance<T>(request, {
      ...options,
      method: "PUT",
      body,
    } as Parameters<typeof this.fetchInstance<T>>[1]);
  }

  /**
   * Perform PATCH request (throws on error)
   */
  async patch<T = unknown>(
    request: FetchRequest,
    body?: RequestInit["body"] | Record<string, unknown>,
    options?: Omit<FetchOptions, "method" | "body">,
  ): Promise<T> {
    // Note: Type assertion needed due to ofetch's complex generic type system
    return this.fetchInstance<T>(request, {
      ...options,
      method: "PATCH",
      body,
    } as Parameters<typeof this.fetchInstance<T>>[1]);
  }

  /**
   * Perform DELETE request (throws on error)
   */
  async delete<T = unknown>(
    request: FetchRequest,
    options?: Omit<FetchOptions, "method">,
  ): Promise<T> {
    // Note: Type assertion needed due to ofetch's complex generic type system
    return this.fetchInstance<T>(request, {
      ...options,
      method: "DELETE",
    } as Parameters<typeof this.fetchInstance<T>>[1]);
  }

  // ===== Safe methods (return SafeResult) =====

  /**
   * Safe wrapper for any request method (zod-style result)
   */
  private async safeRequest<T>(fn: () => Promise<T>): Promise<SafeResult<T, RequestError>> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      if (error && typeof error === "object" && "data" in error) {
        const requestError = RequestError.fromFetchError(error as FetchError);
        return { success: false, error: requestError };
      }
      if (error instanceof Error) {
        const requestError = RequestError.fromError(error);
        return { success: false, error: requestError };
      }
      const requestError = new RequestError("Unknown error occurred", {
        detail: "Unknown error occurred",
      });
      return { success: false, error: requestError };
    }
  }

  /**
   * Safe GET request (returns SafeResult)
   */
  async safeGet<T = unknown>(
    request: FetchRequest,
    options?: Omit<FetchOptions, "method">,
  ): Promise<SafeResult<T, RequestError>> {
    return this.safeRequest(() => this.get<T>(request, options));
  }

  /**
   * Safe POST request (returns SafeResult)
   */
  async safePost<T = unknown>(
    request: FetchRequest,
    body?: RequestInit["body"] | Record<string, unknown>,
    options?: Omit<FetchOptions, "method" | "body">,
  ): Promise<SafeResult<T, RequestError>> {
    return this.safeRequest(() => this.post<T>(request, body, options));
  }

  /**
   * Safe PUT request (returns SafeResult)
   */
  async safePut<T = unknown>(
    request: FetchRequest,
    body?: RequestInit["body"] | Record<string, unknown>,
    options?: Omit<FetchOptions, "method" | "body">,
  ): Promise<SafeResult<T, RequestError>> {
    return this.safeRequest(() => this.put<T>(request, body, options));
  }

  /**
   * Safe PATCH request (returns SafeResult)
   */
  async safePatch<T = unknown>(
    request: FetchRequest,
    body?: RequestInit["body"] | Record<string, unknown>,
    options?: Omit<FetchOptions, "method" | "body">,
  ): Promise<SafeResult<T, RequestError>> {
    return this.safeRequest(() => this.patch<T>(request, body, options));
  }

  /**
   * Safe DELETE request (returns SafeResult)
   */
  async safeDelete<T = unknown>(
    request: FetchRequest,
    options?: Omit<FetchOptions, "method">,
  ): Promise<SafeResult<T, RequestError>> {
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
