import { z } from "zod";
import {
  ConfirmFinalityReplacementSchema,
  finalityReplacementHeaders,
} from "../../types/cvm_finality";
import { CvmIdObjectSchema, CvmIdSchema, refineCvmId } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";
import { CvmUpdateAcceptedFieldsSchema, readCvmUpdateAcceptance } from "./cvm_update_response";

/**
 * Commit CVM update (token-based, no auth required)
 *
 * Submits a two-phase CVM update using a one-time commit token generated
 * during a prepare-only request. The update may still be awaiting finality.
 * The token enables multisig workflows where the signer is different from
 * the original API caller.
 *
 * @example
 * ```typescript
 * import { createClient, patchCvm, commitCvmUpdate } from '@phala/cloud'
 *
 * const client = createClient()
 *
 * // Phase 1: prepare-only
 * const result = await patchCvm(client, {
 *   id: 'my-cvm',
 *   docker_compose_file: newComposeYaml,
 *   prepareOnly: true,
 * })
 *
 * if (result.requiresOnChainHash && result.commitToken) {
 *   // ... multisig approval happens externally ...
 *
 *   // Phase 2: commit with token
 *   const committed = await commitCvmUpdate(client, {
 *     id: 'my-cvm',
 *     token: result.commitToken,
 *     composeHash: result.composeHash,
 *     transactionHash: '0x...',
 *   })
 *   console.log(`Update started: ${committed.correlationId}`)
 * }
 * ```
 */

export const CommitCvmUpdateRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    token: z.string().describe("One-time commit token from prepare-only flow"),
    composeHash: z.string().describe("Compose hash from Phase 1 response"),
    transactionHash: z.string().describe("Transaction hash proving on-chain registration"),
    confirmFinalityReplacement: ConfirmFinalityReplacementSchema,
  }),
);

export type CommitCvmUpdateRequest = z.input<typeof CommitCvmUpdateRequestSchema>;

const CommitCvmUpdateResultSchema = CvmUpdateAcceptedFieldsSchema.extend({
  status: z.string(),
});

export type CommitCvmUpdateResult = z.infer<typeof CommitCvmUpdateResultSchema>;

const { action: commitCvmUpdate, safeAction: safeCommitCvmUpdate } = defineAction<
  CommitCvmUpdateRequest,
  typeof CommitCvmUpdateResultSchema
>(CommitCvmUpdateResultSchema, async (client, request) => {
  const parsed = CommitCvmUpdateRequestSchema.parse(request);
  const { cvmId } = CvmIdSchema.parse(parsed);

  const response = await client.post(
    `/cvms/${cvmId}/commit-update`,
    {
      token: parsed.token,
      compose_hash: parsed.composeHash,
      transaction_hash: parsed.transactionHash,
    },
    { headers: finalityReplacementHeaders(parsed.confirmFinalityReplacement) },
  );
  return readCvmUpdateAcceptance(response);
});

export { commitCvmUpdate, safeCommitCvmUpdate };
