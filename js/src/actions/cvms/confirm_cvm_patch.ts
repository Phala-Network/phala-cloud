import { z } from "zod";
import { CvmIdObjectSchema, CvmIdSchema, refineCvmId } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";
import {
  CvmUpdateAcceptedFieldsSchema,
  cvmUpdateCommitHeaders,
  readCvmUpdateAcceptance,
} from "./cvm_update_response";

/**
 * Confirm CVM patch (Phase 2 of on-chain KMS update)
 *
 * Submits a two-phase CVM update by providing the compose hash and transaction
 * hash proving on-chain registration. The update may still be awaiting finality.
 * Call this after `patchCvm` returns `{ requiresOnChainHash: true }` and you
 * have registered the compose hash on-chain.
 *
 * @example
 * ```typescript
 * import { createClient, patchCvm, confirmCvmPatch, addComposeHash } from '@phala/cloud'
 *
 * const client = createClient()
 *
 * const result = await patchCvm(client, {
 *   id: 'my-cvm',
 *   docker_compose_file: newComposeYaml,
 * })
 *
 * if (result.requiresOnChainHash) {
 *   const tx = await addComposeHash(client, {
 *     composeHash: result.composeHash,
 *     kmsContractAddress: result.kmsInfo.kms_contract_address,
 *     // ... wallet config
 *   })
 *
 *   const confirmed = await confirmCvmPatch(client, {
 *     id: 'my-cvm',
 *     composeHash: result.composeHash,
 *     transactionHash: tx.transactionHash,
 *   })
 *   console.log(`Update started: ${confirmed.correlationId}`)
 * }
 * ```
 */

export const ConfirmCvmPatchRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    composeHash: z.string().describe("Compose hash from patchCvm Phase 1 response"),
    transactionHash: z.string().describe("Transaction hash proving on-chain registration"),
  }),
);

export type ConfirmCvmPatchRequest = z.input<typeof ConfirmCvmPatchRequestSchema>;

const ConfirmCvmPatchResultSchema = CvmUpdateAcceptedFieldsSchema;

export type ConfirmCvmPatchResult = z.infer<typeof ConfirmCvmPatchResultSchema>;

const { action: confirmCvmPatch, safeAction: safeConfirmCvmPatch } = defineAction<
  ConfirmCvmPatchRequest,
  typeof ConfirmCvmPatchResultSchema
>(ConfirmCvmPatchResultSchema, async (client, request) => {
  const parsed = ConfirmCvmPatchRequestSchema.parse(request);
  const { cvmId } = CvmIdSchema.parse(parsed);

  const response = await client.patch(
    `/cvms/${cvmId}`,
    {},
    {
      headers: cvmUpdateCommitHeaders(parsed.composeHash, parsed.transactionHash),
    },
  );
  const { status: _status, ...accepted } = readCvmUpdateAcceptance(response);
  return accepted;
});

export { confirmCvmPatch, safeConfirmCvmPatch };
