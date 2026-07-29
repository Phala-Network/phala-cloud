import { z } from "zod";
import { type CvmIdInput, CvmIdSchema } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";

/**
 * OS image variant (prod or dev)
 */
export const OSImageVariantSchema = z.object({
  name: z.string(),
  slug: z.string(),
  os_image_hash: z.string().nullable(),
  is_current: z.boolean(),
  enabled: z.boolean(),
});

export type OSImageVariant = z.infer<typeof OSImageVariantSchema>;

/**
 * Available OS image information with prod/dev variants
 */
export const AvailableOSImageSchema = z.object({
  version: z.union([
    z.tuple([z.number(), z.number(), z.number(), z.number()]),
    z.tuple([z.number(), z.number(), z.number()]),
  ]),
  prod: OSImageVariantSchema.nullable(),
  dev: OSImageVariantSchema.nullable(),
});

export type AvailableOSImage = z.infer<typeof AvailableOSImageSchema>;

/**
 * Response schema for available OS images
 */
export const GetAvailableOSImagesResponseSchema = z.array(AvailableOSImageSchema);

export type GetAvailableOSImagesResponse = z.infer<typeof GetAvailableOSImagesResponseSchema>;

export const GetAvailableOSImagesRequestSchema = CvmIdSchema;

export type GetAvailableOSImagesRequest = CvmIdInput;

/**
 * Get available OS images for CVM upgrade
 *
 * Returns list of OS images that this CVM can upgrade to.
 * The response includes only images that:
 * 1. Are deployed on the CVM's teepod
 * 2. Are allowed by the CVM's KMS if applicable
 * 3. Follow dev/non-dev upgrade rules
 * 4. Match GPU requirements
 *
 * @param client - The API client
 * @param request - Request parameters
 * @param request.cvmId - ID of the CVM
 * @returns Array of available OS images grouped by version
 *
 * @example
 * ```typescript
 * const images = await getAvailableOsImages(client, { cvmId: "cvm-123" })
 * console.log(images[0].version) // [0, 3, 5]
 * console.log(images[0].prod?.name) // "prod-0.3.5"
 * console.log(images[0].dev?.name) // "dev-0.3.5"
 * ```
 */
const { action: getAvailableOsImages, safeAction: safeGetAvailableOsImages } = defineAction<
  GetAvailableOSImagesRequest,
  typeof GetAvailableOSImagesResponseSchema,
  GetAvailableOSImagesResponse
>(GetAvailableOSImagesResponseSchema, async (client, request) => {
  const { cvmId } = GetAvailableOSImagesRequestSchema.parse(request);
  return await client.get(`/cvms/${cvmId}/available-os-images`);
});

export { getAvailableOsImages, safeGetAvailableOsImages };
