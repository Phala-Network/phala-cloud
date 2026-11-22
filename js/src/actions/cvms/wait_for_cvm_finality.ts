import { z } from "zod";
import type { ApiVersion, Client, SafeResult } from "../../client";
import {
  type CvmFinalityWait,
  OptionalCvmFinalityWaitSchema,
  openEnum,
} from "../../types/cvm_finality";
import { type CvmIdInput, CvmIdSchema } from "../../types/cvm_id";
import { PhalaCloudError } from "../../utils/errors";

const MAX_TIMER_MS = 2_147_483_647;
const TimerMsSchema = z.number().int().min(1).max(MAX_TIMER_MS);
const WaitTimingSchema = z.object({
  timeoutMs: TimerMsSchema.default(30 * 60 * 1000),
  pollIntervalMs: TimerMsSchema.default(15_000),
});

export const CvmFinalityOperationSchema = z
  .object({
    correlation_id: z.string(),
    operation_type: z.string(),
    status: openEnum(["in_progress", "completed", "failed", "cancelled"]),
    finality_wait: OptionalCvmFinalityWaitSchema,
    failure_reason: z.string().nullish(),
    error_message: z.string().nullish(),
  })
  .transform((operation) => {
    if (
      operation.finality_wait &&
      operation.finality_wait.correlation_id !== operation.correlation_id
    ) {
      return { ...operation, finality_wait: undefined };
    }
    return operation;
  });
export type CvmFinalityOperation = z.infer<typeof CvmFinalityOperationSchema>;

const OperationPageSchema = z.object({ items: z.array(z.unknown()) });

export type WaitForCvmFinalityRequest = CvmIdInput & {
  /** The correlation ID returned when Phala Cloud accepted the operation. */
  correlationId: string;
};

export interface WaitForCvmFinalityOptions {
  /** Maximum local wait in milliseconds (default: 30 minutes). Does not cancel the operation. */
  timeoutMs?: number;
  /** Time between reads in milliseconds (default: 15 seconds), before server retry guidance. */
  pollIntervalMs?: number;
  /** Stops waiting locally without canceling the operation. */
  signal?: AbortSignal;
  /** Called on the first reported stage and whenever the stage or phase changes. */
  onStage?: (status: CvmFinalityWait) => void;
}

export type WaitForCvmFinalityResult = CvmFinalityOperation & { status: "completed" };

const OperationFailureReasonSchema = z.enum([
  "tx_reverted",
  "tx_dropped",
  "superseded",
  "outdated",
  "cancelled",
  "apply_failed",
  "boot_failed",
]);

export type CvmFinalityWaitErrorReason =
  | z.infer<typeof OperationFailureReasonSchema>
  | "failed"
  | "timeout"
  | "aborted"
  | "callback_failed"
  | "unexpected";

export class CvmFinalityWaitError extends Error {
  constructor(
    public readonly reason: CvmFinalityWaitErrorReason,
    message: string,
    /** Terminal operation, including the raw server failure reason if it is unrecognized. */
    public readonly operation?: CvmFinalityOperation,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CvmFinalityWaitError";
  }
}

export type WaitForCvmFinalityError = CvmFinalityWaitError | PhalaCloudError | z.ZodError;

function parseRetryAfter(value: string | null | undefined): number {
  if (!value) return 0;
  const delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now();
  return Number.isNaN(delay) ? 0 : Math.max(0, Math.min(delay, MAX_TIMER_MS));
}

type TransientPollError = PhalaCloudError | TypeError;

async function readOperation(
  client: Client<ApiVersion>,
  path: string,
  correlationId: string,
  signal: AbortSignal,
): Promise<{
  operation?: CvmFinalityOperation;
  retryAfterMs: number;
  transientError?: TransientPollError;
}> {
  let retryAfterMs = 0;
  let data: unknown;
  try {
    data = await client.get(path, {
      query: { correlation_id: correlationId },
      signal,
      // Retries belong to the polling loop so aborts and Retry-After share its deadline.
      retry: 0,
      ignoreResponseError: false,
      onResponse: ({ response }) => {
        retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"));
      },
    });
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof PhalaCloudError) {
      const { status } = error;
      if (status >= 400 && status < 500 && status !== 408 && status !== 425 && status !== 429) {
        throw error;
      }
      // Fetch failures are wrapped as status 0 by the client.
      const retryAfterMs =
        status === 429 || (status >= 500 && status < 600)
          ? parseRetryAfter(error.response?.headers.get("Retry-After"))
          : 0;
      return { retryAfterMs, transientError: error };
    }
    if (error instanceof TypeError) return { retryAfterMs: 0, transientError: error };
    throw error;
  }
  signal.throwIfAborted();
  const { items } = OperationPageSchema.parse(data);
  const match = items.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "correlation_id" in item &&
      item.correlation_id === correlationId,
  );
  return {
    operation: match === undefined ? undefined : CvmFinalityOperationSchema.parse(match),
    retryAfterMs,
  };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Wait for the operation identified by its acceptance correlation ID to complete.
 * On-chain finality alone is not completion: Phala Cloud still has to apply the change.
 * A missing operation or an absent finality status is not a terminal result.
 * If the correlation ID does not appear in the operation history, polling continues
 * until `timeoutMs`; there is no separate grace period. A timeout error's `cause`
 * is the last transient polling error, if there was one.
 */
export async function waitForCvmFinality(
  client: Client<ApiVersion>,
  request: WaitForCvmFinalityRequest,
  options: WaitForCvmFinalityOptions = {},
): Promise<WaitForCvmFinalityResult> {
  const { cvmId } = CvmIdSchema.parse(request);
  const correlationId = z.string().min(1).parse(request.correlationId);
  const { pollIntervalMs, timeoutMs } = WaitTimingSchema.parse(options);
  const { onStage, signal } = options;
  const path = `/cvms/${encodeURIComponent(cvmId)}/operations`;
  const controller = new AbortController();
  const onAbort = () =>
    controller.abort(
      new CvmFinalityWaitError(
        "aborted",
        "Stopped waiting for the CVM operation. The operation was not canceled.",
        undefined,
        signal?.reason,
      ),
    );
  if (signal?.aborted) onAbort();
  const pollSignal = controller.signal;
  pollSignal.throwIfAborted();
  signal?.addEventListener("abort", onAbort, { once: true });
  let lastTransientError: TransientPollError | undefined;

  async function poll(): Promise<WaitForCvmFinalityResult> {
    let previousStage: CvmFinalityWait["stage"] | undefined;
    let previousPhase: CvmFinalityWait["phase"] | undefined;
    for (;;) {
      pollSignal.throwIfAborted();
      const { operation, retryAfterMs, transientError } = await readOperation(
        client,
        path,
        correlationId,
        pollSignal,
      );
      pollSignal.throwIfAborted();
      if (transientError) lastTransientError = transientError;
      if (operation?.status === "completed") {
        return { ...operation, status: "completed" };
      }
      if (operation?.status === "failed" || operation?.status === "cancelled") {
        const terminalStatus = operation.status === "failed" ? "failed" : "cancelled";
        const reason =
          OperationFailureReasonSchema.safeParse(operation.failure_reason).data ?? terminalStatus;
        const detail = reason === terminalStatus ? "" : ` (${reason})`;
        const message = `CVM operation ${correlationId} ${terminalStatus}${detail}.`;
        throw new CvmFinalityWaitError(
          reason,
          operation.error_message ? `${message} ${operation.error_message}` : message,
          operation,
        );
      }
      const status = operation?.finality_wait;
      if (status && (status.stage !== previousStage || status.phase !== previousPhase)) {
        previousStage = status.stage;
        previousPhase = status.phase;
        try {
          await onStage?.(status);
        } catch (error) {
          throw new CvmFinalityWaitError(
            "callback_failed",
            "The finality stage callback failed.",
            undefined,
            error,
          );
        }
      }
      await sleep(Math.max(pollIntervalMs, retryAfterMs), pollSignal);
    }
  }

  const timer = setTimeout(
    () =>
      controller.abort(
        new CvmFinalityWaitError(
          "timeout",
          `Stopped waiting for CVM operation ${correlationId} after ${timeoutMs} ms. The operation may still be in progress.`,
          undefined,
          lastTransientError,
        ),
      ),
    timeoutMs,
  );
  try {
    // Race the whole wait so a stalled transport or SDK hook cannot delay cancellation.
    const stopped = new Promise<never>((_, reject) => {
      pollSignal.addEventListener("abort", () => reject(pollSignal.reason), { once: true });
    });
    return await Promise.race([poll(), stopped]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Like waitForCvmFinality, but returns the failure instead of throwing. */
export async function safeWaitForCvmFinality(
  client: Client<ApiVersion>,
  request: WaitForCvmFinalityRequest,
  options?: WaitForCvmFinalityOptions,
): Promise<SafeResult<WaitForCvmFinalityResult, WaitForCvmFinalityError>> {
  try {
    return { success: true, data: await waitForCvmFinality(client, request, options) };
  } catch (error) {
    if (
      error instanceof CvmFinalityWaitError ||
      error instanceof PhalaCloudError ||
      error instanceof z.ZodError
    ) {
      return { success: false, error };
    }
    return {
      success: false,
      error: new CvmFinalityWaitError(
        "unexpected",
        "Could not wait for the CVM operation.",
        undefined,
        error,
      ),
    };
  }
}
