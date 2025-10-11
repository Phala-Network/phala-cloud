import { z } from "zod";
import { type Client } from "../client";
import { CvmLegacyDetailSchema } from "../types/cvm_info";
import { type KmsInfo } from "../types/kms_info";
import { defineAction } from "../utils/define-action";

export { CvmLegacyDetailSchema };

export type GetCvmInfoResponse = z.infer<typeof CvmLegacyDetailSchema> & { kms_info: KmsInfo };

export const GetCvmInfoRequestSchema = z
  .object({
    id: z.string().optional(),
    uuid: z
      .string()
      .regex(/^[0-9a-f]{8}[-]?[0-9a-f]{4}[-]?4[0-9a-f]{3}[-]?[89ab][0-9a-f]{3}[-]?[0-9a-f]{12}$/i)
      .optional(),
    app_id: z
      .string()
      .refine(
        (val) => !val.startsWith("app_") && val.length === 40,
        "app_id should be 40 characters without prefix",
      )
      .transform((val) => (val.startsWith("app_") ? val : `app_${val}`))
      .optional(),
    instance_id: z
      .string()
      .refine(
        (val) => !val.startsWith("instance_") && val.length === 40,
        "instance_id should be 40 characters without prefix",
      )
      .transform((val) => (val.startsWith("instance_") ? val : `instance_${val}`))
      .optional(),
  })
  .refine(
    (data) => !!(data.id || data.uuid || data.app_id || data.instance_id),
    "One of id, uuid, app_id, or instance_id must be provided",
  )
  .transform((data) => ({
    cvmId: data.id || data.uuid || data.app_id || data.instance_id,
    _raw: data,
  }));

export type GetCvmInfoRequest = {
  id?: string;
  uuid?: string;
  app_id?: string;
  instance_id?: string;
};

/**
 * Get information about a specific CVM
 *
 * @param client - The API client
 * @param request - Request parameters
 * @param request.cvmId - ID of the CVM to get information for
 * @param parameters - Optional behavior parameters
 * @returns CVM information
 *
 * @example
 * ```typescript
 * const info = await getCvmInfo(client, { cvmId: "cvm-123" })
 * ```
 */
const { action: getCvmInfo, safeAction: safeGetCvmInfo } = defineAction<
  GetCvmInfoRequest,
  typeof CvmLegacyDetailSchema
>(CvmLegacyDetailSchema, async (client, request) => {
  const validatedRequest = GetCvmInfoRequestSchema.parse(request);
  return await client.get(`/cvms/${validatedRequest.cvmId}`);
});

export { getCvmInfo, safeGetCvmInfo };
