import { z } from "zod";

// Keep autocomplete for known values without rejecting future strings from the API.
export function openEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.union([
    z.enum(values),
    z.custom<string & Record<never, never>>((value) => typeof value === "string"),
  ]);
}

export const CvmFinalityWaitPhaseSchema = openEnum(["awaiting_finality", "applying"]);
export type CvmFinalityWaitPhase = z.infer<typeof CvmFinalityWaitPhaseSchema>;

export const CvmFinalityStageSchema = openEnum(["submitted", "safe", "finalized"]);
export type CvmFinalityStage = z.infer<typeof CvmFinalityStageSchema>;

const CvmFinalityTimelineStageSchema = openEnum(["submitted", "safe", "finalized", "applying"]);

const CvmFinalityTransactionSchema = z.object({
  hash: z.string(),
  block_number: z.number().int().nonnegative(),
  chain_id: z.number().int().positive(),
});

const CvmFinalityProgressSchema = z.object({
  block_tag: openEnum(["latest", "safe", "finalized"]).nullable(),
  policy_block_number: z.number().int().nonnegative().nullable(),
  blocks_remaining: z.number().int().nonnegative().nullable(),
  eta_seconds: z.number().int().nonnegative().nullable(),
});

/** Phala Cloud's latest view of an accepted on-chain CVM operation. */
export const CvmFinalityWaitSchema = z.object({
  operation: openEnum(["create", "update"]),
  correlation_id: z.string(),
  phase: CvmFinalityWaitPhaseSchema,
  stage: CvmFinalityStageSchema,
  // Optional display order for this policy. An invalid list does not invalidate the wait.
  stages: z.array(CvmFinalityTimelineStageSchema).optional().catch(undefined),
  // Null when Phala Cloud tracks the on-chain state without a known transaction.
  transaction: CvmFinalityTransactionSchema.nullable(),
  finality: CvmFinalityProgressSchema,
});
export type CvmFinalityWait = z.infer<typeof CvmFinalityWaitSchema>;

// A response can still be used (and polled by correlation ID) without progress data.
export const OptionalCvmFinalityWaitSchema = CvmFinalityWaitSchema.nullish().catch(undefined);

export const CvmFinalityWaitAcceptedSchema = z.object({
  status: openEnum(["in_progress"]),
  message: z.string().optional(),
  correlation_id: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
  finality_wait: OptionalCvmFinalityWaitSchema,
});
export type CvmFinalityWaitAccepted = z.infer<typeof CvmFinalityWaitAcceptedSchema>;

export const CvmFinalityFailureSchema = z.object({
  operation: openEnum(["create", "update"]),
  correlation_id: z.string(),
  failure_reason: z.string(),
  failed_at: z.string(),
});
export type CvmFinalityFailure = z.infer<typeof CvmFinalityFailureSchema>;
export const OptionalCvmFinalityFailureSchema = CvmFinalityFailureSchema.nullish().catch(undefined);

/**
 * Optional `confirmFinalityReplacement` request field shared by every update action.
 *
 * - Omitted: no header is sent and a new update silently replaces a waiting one.
 * - `"none"`: fail with HTTP 412 (`ERR-03-067`) if another update is still waiting.
 * - The waiting update's correlation ID: confirm that it may be replaced.
 */
export const ConfirmFinalityReplacementSchema = z.string().optional();

/** Build the request headers for `confirmFinalityReplacement`. Empty when omitted. */
export function finalityReplacementHeaders(
  confirmFinalityReplacement: string | undefined,
): Record<string, string> {
  return confirmFinalityReplacement === undefined
    ? {}
    : { "X-Confirm-Finality-Replacement": confirmFinalityReplacement };
}

export const FINALITY_REPLACEMENT_REQUIRED_ERROR_CODE = "ERR-03-067";

export interface FinalityReplacementRequired {
  /** Correlation ID of the update that is still waiting. Pass it to confirm the replacement. */
  correlationId: string;
  stage: CvmFinalityStage;
}

/**
 * Read the waiting update from an `ERR-03-067` (HTTP 412) error.
 * Returns `undefined` for any other error. Works with the error thrown by an action and
 * with `error` from a `safe*` action result.
 */
export function readFinalityReplacementRequired(
  error: unknown,
): FinalityReplacementRequired | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { status, errorCode, detail } = error as {
    status?: unknown;
    errorCode?: unknown;
    detail?: unknown;
  };
  if (status !== 412 || errorCode !== FINALITY_REPLACEMENT_REQUIRED_ERROR_CODE) return undefined;
  if (typeof detail !== "object" || detail === null) return undefined;
  const items: unknown = (detail as { details?: unknown }).details;
  if (!Array.isArray(items)) return undefined;

  const fields = new Map<string, unknown>();
  for (const item of items) {
    if (typeof item === "object" && item !== null && "field" in item && "value" in item) {
      fields.set(String(item.field), item.value);
    }
  }
  const correlationId = fields.get("correlation_id");
  const stage = fields.get("stage");
  if (typeof correlationId !== "string" || !correlationId) return undefined;
  if (typeof stage !== "string") return undefined;
  return { correlationId, stage };
}
