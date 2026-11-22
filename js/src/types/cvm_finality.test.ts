import { expect, expectTypeOf, it } from "vitest";
import { type CvmFinalityStage, CvmFinalityWaitAcceptedSchema, CvmFinalityWaitSchema } from "./cvm_finality";

const finalityWait = {
  operation: "create",
  correlation_id: "create-correlation-id",
  phase: "awaiting_finality",
  stage: "safe",
  transaction: { hash: `0x${"a1".repeat(32)}`, block_number: 39133800, chain_id: 8453 },
  finality: {
    block_tag: "finalized",
    policy_block_number: 39133700,
    blocks_remaining: 100,
    eta_seconds: 90,
  },
} as const;

it("parses finality progress for a create operation without changing the wire fields", () => {
  const response = {
    status: "awaiting_finality",
    correlation_id: finalityWait.correlation_id,
    finality_wait: finalityWait,
  };
  expect(CvmFinalityWaitAcceptedSchema.parse(response)).toEqual(response);
});

it("keeps future finality strings without accepting non-string enums", () => {
  const stateBasedWait = {
    ...finalityWait,
    operation: "update",
    stage: "submitted",
    transaction: null,
    finality: {
      block_tag: null,
      policy_block_number: null,
      blocks_remaining: null,
      eta_seconds: null,
    },
  };
  expect(CvmFinalityWaitSchema.parse(stateBasedWait)).toEqual(stateBasedWait);
  const futureWait = {
    ...stateBasedWait,
    operation: "redeploy",
    stage: "verified",
    phase: "queued",
    finality: { ...stateBasedWait.finality, block_tag: "confirmed" },
  };
  expect(CvmFinalityWaitSchema.parse(futureWait)).toEqual(futureWait);
  expect(CvmFinalityWaitSchema.safeParse({ ...stateBasedWait, stage: 3 }).success).toBe(false);
  expectTypeOf<CvmFinalityStage>().toEqualTypeOf<
    "submitted" | "safe" | "finalized" | (string & Record<never, never>)
  >();
});

it("retains the acceptance correlation ID when progress is missing or malformed", () => {
  const acceptance = { status: "awaiting_finality", correlation_id: "update-correlation-id" };
  expect(CvmFinalityWaitAcceptedSchema.parse(acceptance)).toEqual(acceptance);
  expect(CvmFinalityWaitAcceptedSchema.parse({ ...acceptance, finality_wait: { stage: 3 } })).toEqual(acceptance);
});
