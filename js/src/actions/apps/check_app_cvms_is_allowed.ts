import { z } from "zod";
import { defineAction } from "../../utils/define-action";
import {
  IsAllowedResultSchema,
  IsAllowedResultV20260121Schema,
  IsAllowedResultV20260522Schema,
} from "../cvms/check_cvm_is_allowed";

const AppCvmsBatchIsAllowedResponseBaseSchema = z.object({
  is_onchain: z.boolean(),
  total: z.number().default(0),
  allowed_count: z.number().default(0),
  denied_count: z.number().default(0),
  error_count: z.number().default(0),
});

export const AppCvmsBatchIsAllowedResponseV20260121Schema =
  AppCvmsBatchIsAllowedResponseBaseSchema.extend({
    results: z.array(IsAllowedResultV20260121Schema.extend({ cvm_id: z.number() })).default([]),
    skipped_cvm_ids: z.array(z.number()).default([]),
  });
export type AppCvmsBatchIsAllowedResponseV20260121 = z.infer<
  typeof AppCvmsBatchIsAllowedResponseV20260121Schema
>;

export const AppCvmsBatchIsAllowedResponseV20260522Schema =
  AppCvmsBatchIsAllowedResponseBaseSchema.extend({
    results: z.array(IsAllowedResultV20260522Schema.extend({ cvm_id: z.string() })).default([]),
    skipped_cvm_ids: z.array(z.string()).default([]),
  });
export type AppCvmsBatchIsAllowedResponseV20260522 = z.infer<
  typeof AppCvmsBatchIsAllowedResponseV20260522Schema
>;

export const AppCvmsBatchIsAllowedResponseSchema = z.union([
  AppCvmsBatchIsAllowedResponseV20260121Schema,
  AppCvmsBatchIsAllowedResponseV20260522Schema,
]);
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
