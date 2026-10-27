import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "../../client";
import {
  watchCvmState,
  WatchAbortedError,
  MaxRetriesExceededError,
  WatchCvmStateRequestSchema,
  type SSEEvent,
} from "./watch_cvm_state";

// Helper to create SSE stream
function createSSEStream(messages: Array<{ event: string; data: string }>) {
  const encoder = new TextEncoder();
  let messageIndex = 0;

  return new ReadableStream({
    start(controller) {
      // Store controller for external control
      (this as any).controller = controller;
    },
    pull(controller) {
      if (messageIndex < messages.length) {
        const msg = messages[messageIndex++];
        const sseMessage = `event: ${msg.event}\ndata: ${msg.data}\n\n`;
        controller.enqueue(encoder.encode(sseMessage));
      } else {
        controller.close();
      }
    },
  });
}

// Helper to create controllable stream
function createControllableStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
  });

  return {
    stream,
    send(event: string, data: string) {
      const sseMessage = `event: ${event}\ndata: ${data}\n\n`;
      controller.enqueue(encoder.encode(sseMessage));
    },
    close() {
      controller.close();
    },
  };
}

describe("watchCvmState", () => {
  let client: Client;
  let nativeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Client({
      apiKey: "test-key",
      baseURL: "https://test-api.example.com",
    });

    // Mock client.raw.native()
    nativeMock = vi.fn();
    client.raw.native = nativeMock as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should watch CVM state until target is reached", async () => {
    const events: SSEEvent[] = [];

    const stream = createSSEStream([
      { event: "state", data: JSON.stringify({ status: "starting", derived_status: "starting" }) },
      { event: "state", data: JSON.stringify({ status: "running", derived_status: "running" }) },
      { event: "complete", data: JSON.stringify({ status: "running", elapsed: 10.5, target: "running" }) },
    ]);

    nativeMock.mockResolvedValue({
      ok: true,
      body: stream,
    });

    const result = await watchCvmState(
      client,
      {
        id: "cvm-123",
        target: "running",
        interval: 5,
        timeout: 60,
      },
      {
        onEvent: (event) => events.push(event),
      },
    );

    expect(result?.status).toBe("running");
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe("state");
    expect(events[1].type).toBe("state");
    expect(events[2].type).toBe("complete");
  });

  it("should retry on timeout", async () => {
    let attemptCount = 0;
    let callCount = 0;

    nativeMock.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First attempt - timeout
        const stream = createSSEStream([
          { event: "timeout", data: JSON.stringify({ error: "Timeout", elapsed: 60, target: "running" }) },
        ]);
        return Promise.resolve({ ok: true, body: stream });
      } else {
        // Second attempt - success
        const stream = createSSEStream([
          { event: "state", data: JSON.stringify({ status: "running", derived_status: "running" }) },
          { event: "complete", data: JSON.stringify({ status: "running", elapsed: 5, target: "running" }) },
        ]);
        return Promise.resolve({ ok: true, body: stream });
      }
    });

    const result = await watchCvmState(
      client,
      {
        id: "cvm-123",
        target: "running",
        maxRetries: 2,
        retryDelay: 10,
      },
      {
        onEvent: (event) => {
          if (event.type === "timeout") attemptCount++;
        },
      },
    );

    expect(result?.status).toBe("running");
    expect(attemptCount).toBe(1);
    expect(callCount).toBe(2);
  });

  it("should abort when signal is triggered", async () => {
    const controller = new AbortController();

    // Mock to reject when aborted
    nativeMock.mockImplementation((url, options) => {
      return new Promise((resolve, reject) => {
        const signal = options?.signal as AbortSignal;
        if (signal) {
          signal.addEventListener("abort", () => {
            reject(new Error("The operation was aborted"));
          });
        }
      });
    });

    const promise = watchCvmState(
      client,
      {
        id: "cvm-123",
        target: "running",
      },
      {
        signal: controller.signal,
      },
    );

    // Wait a bit then abort
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();

    await expect(promise).rejects.toThrow(WatchAbortedError);
  });

  it("should throw MaxRetriesExceededError when retries exhausted", async () => {
    nativeMock.mockImplementation(() => {
      const stream = createSSEStream([
        { event: "timeout", data: JSON.stringify({ error: "Timeout", elapsed: 60, target: "running" }) },
      ]);
      return Promise.resolve({ ok: true, body: stream });
    });

    const promise = watchCvmState(
      client,
      {
        id: "cvm-123",
        target: "running",
        maxRetries: 2,
        retryDelay: 10,
      },
    );

    await expect(promise).rejects.toThrow(MaxRetriesExceededError);
  });

  it("should handle error events", async () => {
    const events: SSEEvent[] = [];

    nativeMock.mockRejectedValue(new Error("Connection failed"));

    const promise = watchCvmState(
      client,
      {
        id: "cvm-123",
        target: "running",
        maxRetries: 1,
        retryDelay: 10,
      },
      {
        onEvent: (event) => events.push(event),
      },
    );

    await expect(promise).rejects.toThrow("Connection failed");
  });

  it("should construct correct SSE URL with parameters", async () => {
    const stream = createSSEStream([
      { event: "state", data: JSON.stringify({ status: "stopped", derived_status: "stopped" }) },
      { event: "complete", data: JSON.stringify({ status: "stopped", elapsed: 0, target: "stopped" }) },
    ]);

    nativeMock.mockResolvedValue({
      ok: true,
      body: stream,
    });

    await watchCvmState(client, {
      id: "cvm-456",
      target: "stopped",
      interval: 10,
      timeout: 120,
    });

    // Check that native was called with correct URL and options
    expect(nativeMock).toHaveBeenCalled();
    const [url, options] = nativeMock.mock.calls[0];

    // Check URL contains path and query parameters
    expect(url).toContain("/cvms/cvm-456/state");
    expect(url).toContain("target=stopped");
    expect(url).toContain("interval=10");
    expect(url).toContain("timeout=120");

    // Check headers
    expect(options.headers["Accept"]).toBe("text/event-stream");
  });
});

describe("WatchCvmStateRequestSchema maxRetries", () => {
  it("defaults to unlimited retries", () => {
    const parsed = WatchCvmStateRequestSchema.parse({ target: "running" });
    expect(parsed.maxRetries).toBe(Number.POSITIVE_INFINITY);
  });

  it("accepts an explicit Infinity", () => {
    const parsed = WatchCvmStateRequestSchema.parse({
      target: "running",
      maxRetries: Number.POSITIVE_INFINITY,
    });
    expect(parsed.maxRetries).toBe(Number.POSITIVE_INFINITY);
  });

  it("rejects negative values", () => {
    expect(WatchCvmStateRequestSchema.safeParse({ target: "running", maxRetries: -1 }).success).toBe(false);
  });
});
