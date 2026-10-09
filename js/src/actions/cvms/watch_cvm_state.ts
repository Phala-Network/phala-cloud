import { z } from "zod";
import { type Client } from "../../client";
import { CvmIdSchema, type CvmIdInput } from "../../types/cvm_id";
import { CvmStateSchema, type CvmState } from "./get_cvm_state";

/**
 * SSE event types from the backend
 */
type SSEEventType = "state" | "complete" | "timeout" | "error";

/**
 * SSE event data structures
 */
type SSEStateEvent = { type: "state"; data: CvmState };
type SSECompleteEvent = {
  type: "complete";
  data: { status: string; elapsed: number; target: string };
};
type SSETimeoutEvent = {
  type: "timeout";
  data: { error: string; elapsed: number; target: string };
};
type SSEErrorEvent = { type: "error"; data: { error: string; elapsed?: number; message?: string } };

export type SSEEvent = SSEStateEvent | SSECompleteEvent | SSETimeoutEvent | SSEErrorEvent;

/**
 * Watch CVM state request input (before transformation)
 */
export type WatchCvmStateRequest = CvmIdInput & {
  target: string;
  interval?: number;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
};

/**
 * Internal schema for parsing and validation
 */
const WatchCvmStateParamsSchema = z.object({
  target: z.string().describe("Target status to wait for (e.g., 'running', 'stopped')"),
  interval: z.number().min(5).max(30).default(5).describe("Polling interval in seconds"),
  timeout: z.number().min(10).max(600).default(300).describe("Timeout per attempt in seconds"),
  maxRetries: z
    .number()
    .min(0)
    .default(Number.POSITIVE_INFINITY)
    .describe("Maximum number of retry attempts (Infinity for unlimited)"),
  retryDelay: z.number().min(0).default(5000).describe("Delay between retries in milliseconds"),
});

export const WatchCvmStateRequestSchema = WatchCvmStateParamsSchema;

/**
 * Options for watch operation
 */
export interface WatchCvmStateOptions {
  signal?: AbortSignal;
  onEvent?: (event: SSEEvent) => void;
}

/**
 * Error thrown when watch operation is aborted
 */
export class WatchAbortedError extends Error {
  constructor() {
    super("Watch operation was aborted");
    this.name = "WatchAbortedError";
  }
}

/**
 * Error thrown when max retries exceeded
 */
export class MaxRetriesExceededError extends Error {
  constructor(public readonly attempts: number) {
    super(`Maximum retry attempts (${attempts}) exceeded`);
    this.name = "MaxRetriesExceededError";
  }
}

/**
 * Parse SSE event from raw text
 */
function parseSSEEvent(eventType: string, data: string): SSEEvent {
  try {
    const parsed = JSON.parse(data);
    return { type: eventType as SSEEventType, data: parsed } as SSEEvent;
  } catch {
    return { type: "error", data: { error: "Failed to parse SSE event" } };
  }
}

/**
 * Watch CVM state changes using Server-Sent Events (SSE)
 *
 * This action streams state updates from the backend until the target status is reached,
 * timeout occurs, or an error happens. It automatically retries on timeout/error up to
 * maxRetries times, providing unlimited watch capability.
 *
 * Key features:
 * - Streams real-time state updates via SSE
 * - Automatic retry on timeout (backend max 600s, but SDK can retry infinitely)
 * - AbortController support for cancellation
 * - Callback for each SSE event
 * - Resolves with final state when target reached
 *
 * @param client - The API client
 * @param request - Request parameters
 * @param request.id - CVM ID (or use uuid, app_id, instance_id)
 * @param request.target - Target status to wait for (e.g., "running")
 * @param request.interval - Polling interval in seconds (5-30, default: 5)
 * @param request.timeout - Timeout per attempt in seconds (10-600, default: 300)
 * @param request.maxRetries - Max retry attempts (default: Infinity)
 * @param request.retryDelay - Delay between retries in ms (default: 5000)
 * @param options - Optional behavior parameters
 * @param options.signal - AbortSignal for cancellation
 * @param options.onEvent - Callback invoked for each SSE event
 * @returns Promise that resolves with final CVM state when target is reached
 *
 * @throws {WatchAbortedError} If operation is aborted via signal
 * @throws {MaxRetriesExceededError} If max retries exceeded without reaching target
 * @throws {Error} For other unexpected errors
 *
 * @example
 * ```typescript
 * // Basic usage: wait for CVM to reach "running" status
 * const state = await watchCvmState(client, {
 *   id: "cvm-123",
 *   target: "running"
 * })
 * console.log("CVM is now running!")
 *
 * // With event callback and abort controller
 * const controller = new AbortController()
 * try {
 *   const state = await watchCvmState(
 *     client,
 *     {
 *       id: "cvm-123",
 *       target: "running",
 *       interval: 10,
 *       maxRetries: 5
 *     },
 *     {
 *       signal: controller.signal,
 *       onEvent: (event) => {
 *         if (event.type === "state") {
 *           console.log("Current status:", event.data.status)
 *         }
 *       }
 *     }
 *   )
 * } catch (error) {
 *   if (error instanceof WatchAbortedError) {
 *     console.log("Watch cancelled")
 *   }
 * }
 *
 * // Cancel after 30 seconds
 * setTimeout(() => controller.abort(), 30000)
 * ```
 */
export async function watchCvmState(
  client: Client,
  request: WatchCvmStateRequest,
  options: WatchCvmStateOptions = {},
): Promise<CvmState> {
  // Extract and validate cvmId using CvmIdSchema
  const { cvmId } = CvmIdSchema.parse(request);

  // Validate other parameters
  const { target, interval, timeout, maxRetries, retryDelay } =
    WatchCvmStateParamsSchema.parse(request);

  const { signal, onEvent } = options;

  let attempt = 0;

  while (attempt < maxRetries) {
    // Check if aborted before starting attempt
    if (signal?.aborted) {
      throw new WatchAbortedError();
    }

    attempt++;

    try {
      const result = await watchSingleAttempt(
        client,
        cvmId,
        target,
        interval,
        timeout,
        signal,
        onEvent,
      );

      if (result) {
        return result;
      }

      // Timeout occurred, retry if not at max
      if (attempt >= maxRetries) {
        throw new MaxRetriesExceededError(attempt);
      }

      // Wait before retry
      await sleep(retryDelay, signal);
    } catch (error) {
      // Check if aborted (fetch throws generic error on abort)
      if (signal?.aborted) {
        throw new WatchAbortedError();
      }

      if (error instanceof WatchAbortedError || error instanceof MaxRetriesExceededError) {
        throw error;
      }

      // For other errors, retry if possible
      if (attempt >= maxRetries) {
        throw error;
      }

      // Emit error event and retry
      if (onEvent) {
        onEvent({
          type: "error",
          data: { error: error instanceof Error ? error.message : String(error) },
        });
      }

      await sleep(retryDelay, signal);
    }
  }

  throw new MaxRetriesExceededError(attempt);
}

/**
 * Single SSE watch attempt using ofetch's native method
 * @returns CvmState if target reached, null if timeout, throws on error
 */
async function watchSingleAttempt(
  client: Client,
  cvmId: string,
  target: string,
  interval: number,
  timeout: number,
  signal: AbortSignal | undefined,
  onEvent: ((event: SSEEvent) => void) | undefined,
): Promise<CvmState | null> {
  // Build endpoint path with query parameters
  // native() doesn't support 'query' option, so we need to build the URL manually
  const params = new URLSearchParams({
    target,
    interval: String(interval),
    timeout: String(timeout),
  });

  // native() bypasses ofetch's URL construction, so we need to build the full URL manually
  const baseURL = client.config.baseURL || "";
  const fullUrl = `${baseURL}/cvms/${cvmId}/state?${params.toString()}`;

  // Build headers manually - native() may not inherit configured headers
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
  };

  // Add authentication header if not using cookie auth
  if (!client.config.useCookieAuth && client.config.apiKey) {
    headers["X-API-Key"] = client.config.apiKey;
  }

  // Add any user-provided headers
  if (client.config.headers) {
    Object.entries(client.config.headers).forEach(([key, value]) => {
      if (typeof value === "string") {
        headers[key] = value;
      }
    });
  }

  const response = await client.raw.native(fullUrl, {
    method: "GET",
    headers,
    signal,
    ...(client.config.useCookieAuth ? { credentials: "include" } : {}),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  return parseSSEStream(response.body, signal, onEvent);
}

/**
 * Parse SSE stream from ReadableStream
 */
async function parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined,
  onEvent: ((event: SSEEvent) => void) | undefined,
): Promise<CvmState | null> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalState: CvmState | null = null;

  // Current SSE message being assembled
  let currentEvent = "";
  let currentData = "";

  const processLine = (line: string) => {
    if (line.startsWith("event:")) {
      currentEvent = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      currentData = line.slice(5).trim();
    } else if (line === "") {
      // Empty line = end of message
      if (currentEvent && currentData) {
        const event = parseSSEEvent(currentEvent, currentData);

        if (event.type === "state") {
          finalState = event.data;
        }

        onEvent?.(event);

        // Check for terminal events
        if (event.type === "complete") {
          return "complete";
        }
        if (event.type === "timeout") {
          return "timeout";
        }
      }

      // Reset for next message
      currentEvent = "";
      currentData = "";
    }
    return null;
  };

  try {
    while (true) {
      // Check abort signal
      if (signal?.aborted) {
        throw new WatchAbortedError();
      }

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const result = processLine(line.trim());
        if (result === "complete") {
          return finalState;
        }
        if (result === "timeout") {
          return null; // Signal retry
        }
      }
    }

    // Stream ended without complete/timeout
    return finalState;
  } catch (error) {
    if (error instanceof WatchAbortedError) {
      throw error;
    }
    throw new Error(`SSE stream error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Sleep utility with abort support
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new WatchAbortedError());
      return;
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new WatchAbortedError());
      });
    }
  });
}
