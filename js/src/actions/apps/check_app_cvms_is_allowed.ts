import { z } from "zod";
import { defineAction } from "../../utils/define-action";
import { IsAllowedResultSchema } from "../cvms/check_cvm_is_allowed";

export const AppCvmsBatchIsAllowedResponseSchema = z.object({
  is_onchain: z.boolean(),
  results: z.array(IsAllowedResultSchema.extend({ cvm_id: z.string() })).default([]),
  total: z.number().default(0),
  allowed_count: z.number().default(0),
  denied_count: z.number().default(0),
  error_count: z.number().default(0),
  skipped_cvm_ids: z.array(z.string()).default([]),
});

export type AppCvmsBatchIsAllowedResponse = z.infer<typeof AppCvmsBatchIsAllowedResponseSchema>;

export const CheckAppCvmsIsAllowedRequestSchema = z.object({
  appId: z.string().min(1),
});

export type CheckAppCvmsIsAllowedRequest = z.infer<typeof CheckAppCvmsIsAllowedRequestSchema>;

/**
 * Batch check on-chain deployment allowance for all CVMs under an app.
 *
 * For on-chain KMS apps, queries the blockchain via multicall3 to check
 * compose hash and device allowance for each CVM.
 * For offchain KMS apps, returns is_onchain=false with no results.
 *
 * @param client - The API client
 * @param request - Request parameters
 * @param request.appId - The hex app identifier
 * @returns Batch allowance check results for all CVMs
 */
const { action: checkAppCvmsIsAllowed, safeAction: safeCheckAppCvmsIsAllowed } = defineAction<
  CheckAppCvmsIsAllowedRequest,
  typeof AppCvmsBatchIsAllowedResponseSchema,
  AppCvmsBatchIsAllowedResponse
>(AppCvmsBatchIsAllowedResponseSchema, async (client, request) => {
  const { appId } = CheckAppCvmsIsAllowedRequestSchema.parse(request);
  return await client.post(`/apps/${appId}/cvms/is-allowed`, {});
});

export { checkAppCvmsIsAllowed, safeCheckAppCvmsIsAllowed };
