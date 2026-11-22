import { expect, it } from "vitest";
import { CvmFinalityWaitAcceptedSchema, CvmFinalityWaitSchema } from "./cvm_finality";

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

it("accepts unknown state-based estimates but not an unknown stage", () => {
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
  expect(CvmFinalityWaitSchema.safeParse({ ...stateBasedWait, stage: "confirmed" }).success).toBe(false);
});
