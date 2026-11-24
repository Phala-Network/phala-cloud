import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "../../client";
import type { CvmFinalityWait } from "../../types/cvm_finality";
import {
  CvmFinalityWaitError,
  safeWaitForCvmFinality,
  waitForCvmFinality,
} from "./wait_for_cvm_finality";

const request = { id: "cvm-123", correlationId: "a+b&c" };
const client = new Client({ baseURL: "https://example.test/api/v1" });

function operation(status: string, fields: Record<string, unknown> = {}) {
  return {
    correlation_id: request.correlationId,
    operation_type: "update",
    status,
    finality_wait: null,
    failure_reason: null,
    error_message: null,
    ...fields,
  };
}

function operations(...items: unknown[]) {
  return Response.json({ items, next_cursor: null, total: items.length });
}

function waitStatus(
  stage: CvmFinalityWait["stage"],
  phase: CvmFinalityWait["phase"] = "awaiting_finality",
): CvmFinalityWait {
  return {
    operation: "update",
    correlation_id: request.correlationId,
    phase,
    stage,
    transaction: null,
    finality: {
      block_tag: "finalized",
      policy_block_number: 240,
      blocks_remaining: null,
      eta_seconds: null,
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("waitForCvmFinality", () => {
  it("reads the exact correlation and ignores invalid unrelated rows", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        operations(
          { correlation_id: "different-operation", status: "future_status", finality_wait: 3 },
          null,
          operation("completed"),
        ),
      );
    vi.stubGlobal("fetch", fetch);

    await expect(waitForCvmFinality(client, request)).resolves.toMatchObject({
      correlation_id: "a+b&c",
      status: "completed",
    });
    const [url, options] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://example.test/api/v1/cvms/cvm-123/operations?correlation_id=a%2Bb%26c",
    );
    expect(options?.method).toBe("GET");
  });

  it("reports stage and phase changes without treating finality or a missing wait as completion", async () => {
    vi.useFakeTimers();
    const pending = (finality_wait: CvmFinalityWait | null) =>
      operations(operation("in_progress", { finality_wait, target_state: "running" }));
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(pending(waitStatus("submitted")))
      .mockResolvedValueOnce(pending(waitStatus("submitted")))
      .mockResolvedValueOnce(pending(waitStatus("safe")))
      .mockResolvedValueOnce(pending(waitStatus("finalized")))
      .mockResolvedValueOnce(pending(waitStatus("finalized", "applying")))
      .mockResolvedValueOnce(pending(null))
      .mockResolvedValueOnce(operations(operation("completed", { correlation_id: "other" })))
      .mockResolvedValueOnce(operations(operation("completed")));
    vi.stubGlobal("fetch", fetch);
    const onStage = vi.fn<(status: CvmFinalityWait) => void>();
    const completed = vi.fn();
    const result = waitForCvmFinality(client, request, { pollIntervalMs: 1000, onStage });
    void result.then(completed, () => {});

    await vi.advanceTimersByTimeAsync(6000);
    expect(completed).not.toHaveBeenCalled();
    expect(onStage.mock.calls).toEqual([
      [waitStatus("submitted")],
      [waitStatus("safe")],
      [waitStatus("finalized")],
      [waitStatus("finalized", "applying")],
    ]);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toMatchObject({ status: "completed" });
  });

  it("retries a fetch TypeError and a 502 at the polling interval", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("Bad Gateway", { status: 502 }))
      .mockResolvedValueOnce(operations(operation("completed")));
    vi.stubGlobal("fetch", fetch);

    const result = waitForCvmFinality(client, request, { pollIntervalMs: 100, timeoutMs: 1000 });
    const completion = expect(result).resolves.toMatchObject({ status: "completed" });
    await vi.advanceTimersByTimeAsync(99);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(3);
    await completion;
  });

  it.each(["missing correlation", "server error"] as const)(
    "polls until timeoutMs after a %s",
    async (scenario) => {
      vi.useFakeTimers();
      const fetch = vi.fn<typeof globalThis.fetch>(async () =>
        scenario === "server error"
          ? new Response(null, { status: 502 })
          : operations(operation("completed", { correlation_id: "other-operation" })),
      );
      vi.stubGlobal("fetch", fetch);

      const result = waitForCvmFinality(client, request, { pollIntervalMs: 100, timeoutMs: 250 });
      const rejection = expect(result).rejects.toMatchObject({ reason: "timeout" });
      await vi.advanceTimersByTimeAsync(250);
      await rejection;
      expect(fetch).toHaveBeenCalledTimes(3);
    },
  );

  it.each([0, 408, 425, 429, 502])("attaches the last transient error (%i) to a timeout", async (status) => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValueOnce(new TypeError("First network error"));
    if (status === 0) {
      fetch.mockRejectedValueOnce(new TypeError("Last network error"));
    } else {
      fetch.mockResolvedValueOnce(Response.json({ detail: "Last HTTP error" }, { status }));
    }
    fetch.mockResolvedValueOnce(operations(operation("in_progress")));
    vi.stubGlobal("fetch", fetch);

    const result = safeWaitForCvmFinality(client, request, { pollIntervalMs: 100, timeoutMs: 250 });
    await vi.advanceTimersByTimeAsync(250);
    await expect(result).resolves.toMatchObject({
      success: false,
      error: { reason: "timeout", cause: { status, message: expect.stringContaining("Last ") } },
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("bounds even a request that never settles and aborts its transport", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetch);

    const result = waitForCvmFinality(client, request, { timeoutMs: 100 });
    const rejection = expect(result).rejects.toMatchObject({ reason: "timeout" });
    await vi.advanceTimersByTimeAsync(100);
    await rejection;
    expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it.each([
    ["failed", "tx_dropped", "tx_dropped"],
    ["failed", "registration_removed", "registration_removed"],
    ["failed", "superseded", "superseded"],
    ["failed", "cancelled", "cancelled"],
    ["failed", "boot_failed", "boot_failed"],
    ["failed", "new_server_reason", "failed"],
    ["cancelled", null, "cancelled"],
  ] as const)(
    "returns a typed safe failure for %s with reason %s",
    async (status, reason, expected) => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(
          operations(
            operation(status, {
              reason: "tx_reverted",
              failure_reason: reason,
              error_message: "The operation did not complete.",
            }),
          ),
        );
      vi.stubGlobal("fetch", fetch);

      const result = await safeWaitForCvmFinality(client, request);
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(CvmFinalityWaitError);
      expect(result.error).toMatchObject({
        reason: expected,
        operation: { correlation_id: request.correlationId, status, failure_reason: reason },
      });
      expect(result.error?.message).toContain("The operation did not complete.");
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps polling through unknown status and drops malformed or mismatched progress", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(operations(operation("queued", { finality_wait: { stage: 42 } })))
      .mockResolvedValueOnce(operations(operation("in_progress", {
        finality_wait: { ...waitStatus("submitted"), correlation_id: "other-operation" },
      })))
      .mockResolvedValueOnce(operations(operation("completed", { finality_wait: 42 })));
    vi.stubGlobal("fetch", fetch);
    const onStage = vi.fn();

    const result = waitForCvmFinality(client, request, { onStage, pollIntervalMs: 100 });
    const completion = expect(result).resolves.toMatchObject({ status: "completed", finality_wait: undefined });
    await vi.advanceTimersByTimeAsync(200);
    await completion;
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(onStage).not.toHaveBeenCalled();
  });

  it.each([429, 503])("honors Retry-After from HTTP %i and then from a pending response", async (status) => {
    vi.useFakeTimers();
    const start = Date.parse("2026-11-25T00:00:00Z");
    vi.setSystemTime(start);
    const pending = operations(operation("in_progress"));
    pending.headers.set("Retry-After", new Date(start + 5000).toUTCString());
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        Response.json(
          { detail: "Retry later" },
          {
            status,
            headers: { "Retry-After": "2" },
          },
        ),
      )
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(operations(operation("completed")));
    vi.stubGlobal("fetch", fetch);

    const result = waitForCvmFinality(client, request, { pollIntervalMs: 100 });
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2999);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toMatchObject({ status: "completed" });
  });

  it("does not retry a non-transient HTTP error", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ detail: "Forbidden" }, { status: 403 }));
    vi.stubGlobal("fetch", fetch);

    await expect(safeWaitForCvmFinality(client, request)).resolves.toMatchObject({
      success: false,
      error: { status: 403 },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("stops promptly when aborted during Retry-After", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        Response.json({ detail: "Unavailable" }, { status: 503, headers: { "Retry-After": "30" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();

    const result = safeWaitForCvmFinality(client, request, {
      pollIntervalMs: 100,
      signal: controller.signal,
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(1);
    controller.abort();

    await expect(result).resolves.toMatchObject({ success: false, error: { reason: "aborted" } });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports callback failure without retrying or mislabeling the operation", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        operations(operation("in_progress", { finality_wait: waitStatus("submitted") })),
      );
    vi.stubGlobal("fetch", fetch);
    const cause = new Error("Callback error");

    await expect(
      safeWaitForCvmFinality(client, request, {
        onStage: async () => {
          throw cause;
        },
      }),
    ).resolves.toMatchObject({ success: false, error: { reason: "callback_failed", cause } });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not send a request when already aborted", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    controller.abort();

    await expect(
      waitForCvmFinality(client, request, { signal: controller.signal }),
    ).rejects.toMatchObject({
      reason: "aborted",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
