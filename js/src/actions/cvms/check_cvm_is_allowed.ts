import { z } from "zod";
import { defineAction } from "../../utils/define-action";
import { CvmIdSchema, type CvmIdInput } from "../../types/cvm_id";

const IsAllowedResultBaseSchema = z.object({
  app_contract_address: z.string(),
  compose_hash: z.string(),
  device_id: z.string(),
  compose_hash_allowed: z.boolean(),
  allow_any_device: z.boolean(),
  device_id_allowed: z.boolean().nullable().optional(),
  is_allowed: z.boolean(),
  error: z.string().nullable().optional(),
});

export const IsAllowedResultV20260121Schema = IsAllowedResultBaseSchema.extend({
  cvm_id: z.number().optional(),
});
export type IsAllowedResultV20260121 = z.infer<typeof IsAllowedResultV20260121Schema>;

export const IsAllowedResultV20260522Schema = IsAllowedResultBaseSchema.extend({
  cvm_id: z.string().optional(),
});
export type IsAllowedResultV20260522 = z.infer<typeof IsAllowedResultV20260522Schema>;

export const IsAllowedResultAnySchema = z.union([
  IsAllowedResultV20260121Schema,
  IsAllowedResultV20260522Schema,
]);
export const IsAllowedResultSchema = IsAllowedResultV20260522Schema;
export type IsAllowedResult = z.infer<typeof IsAllowedResultSchema>;

const CheckCvmIsAllowedInputSchema = z.object({
  cvmId: z.string().min(1),
  compose_hash: z.string().optional(),
  node_id: z.number().optional(),
  device_id: z.string().optional(),
});

export const CheckCvmIsAllowedRequestSchema = CheckCvmIsAllowedInputSchema;

export type CheckCvmIsAllowedRequest = z.infer<typeof CheckCvmIsAllowedInputSchema>;

/**
 * Check if a CVM deployment is allowed by its on-chain DStack App contract.
 *
 * @param client - The API client
 * @param request - Request parameters
 * @param request.cvmId - CVM identifier
 * @param request.compose_hash - Optional compose hash override
 * @param request.node_id - Optional node ID override (resolves device_id)
 * @param request.device_id - Optional device ID override
 * @returns On-chain allowance check result
 */
const { action: checkCvmIsAllowed, safeAction: safeCheckCvmIsAllowed } = defineAction<
  CheckCvmIsAllowedRequest,
  typeof IsAllowedResultSchema,
  IsAllowedResult
>(IsAllowedResultSchema, async (client, request) => {
  const { cvmId, ...body } = CheckCvmIsAllowedRequestSchema.parse(request);
  return await client.post(`/cvms/${cvmId}/is-allowed`, body);
});

export { checkCvmIsAllowed, safeCheckCvmIsAllowed };
