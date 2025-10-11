import { z } from "zod";
import type { Client } from "../client";
import { type KmsInfo, KmsInfoSchema } from "../types/kms_info";
import { defineAction } from "../utils/define-action";

export const GetKmsInfoRequestSchema = z.object({
  kms_id: z.string().min(1, "KMS ID is required"),
});

export type GetKmsInfoRequest = z.infer<typeof GetKmsInfoRequestSchema>;

/**
 * Get information about a specific KMS
 *
 * @param client - The API client
 * @param request - Request parameters
 * @param request.kms_id - ID of the KMS to get information for
 * @param parameters - Optional behavior parameters
 * @returns KMS information
 *
 * @example
 * ```typescript
 * const info = await getKmsInfo(client, { kms_id: "kms-123" })
 * ```
 */
const { action: getKmsInfo, safeAction: safeGetKmsInfo } = defineAction<
  GetKmsInfoRequest,
  typeof KmsInfoSchema
>(KmsInfoSchema, async (client, request) => {
  const validatedRequest = GetKmsInfoRequestSchema.parse(request);
  return await client.get(`/kms/${validatedRequest.kms_id}`);
});

export { getKmsInfo, safeGetKmsInfo };
