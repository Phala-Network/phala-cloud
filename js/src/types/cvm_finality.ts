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
  // Null when Phala Cloud tracks the on-chain state without a known transaction.
  transaction: CvmFinalityTransactionSchema.nullable(),
  finality: CvmFinalityProgressSchema,
});
export type CvmFinalityWait = z.infer<typeof CvmFinalityWaitSchema>;

// A response can still be used (and polled by correlation ID) without progress data.
export const OptionalCvmFinalityWaitSchema = CvmFinalityWaitSchema.nullish().catch(undefined);

export const CvmFinalityWaitAcceptedSchema = z.object({
  status: z.literal("awaiting_finality"),
  correlation_id: z.string(),
  finality_wait: OptionalCvmFinalityWaitSchema,
});
export type CvmFinalityWaitAccepted = z.infer<typeof CvmFinalityWaitAcceptedSchema>;
