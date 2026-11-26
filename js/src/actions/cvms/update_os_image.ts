import { z } from "zod";
import {
  CvmFinalityWaitAcceptedSchema,
  type CvmFinalityWaitAccepted,
} from "../../types/cvm_finality";
import { CvmIdSchema, CvmIdObjectSchema, refineCvmId } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";

/**
 * Update CVM OS image
 *
 * This action initiates an asynchronous OS image update operation.
 * The CVM will be shut down, the OS image updated, and then restarted.
 * This operation may take several minutes to complete.
 *
 * Returns the accepted response (HTTP 202) with `status`, `message` and the
 * `correlation_id` that identifies the running operation.
 *
 * @example
 * ```typescript
 * import { createClient, updateOsImage } from '@phala/cloud'
 *
 * const client = createClient();
 * const accepted = await updateOsImage(client, {
 *   id: 'my-cvm-id',
 *   os_image_name: 'prod-0.3.5'
 * });
 * console.log(`OS image update accepted: ${accepted.correlation_id}`);
 * ```
 */

export const UpdateOsImageRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    os_image_name: z.string().min(1, "OS image name is required"),
  }),
);

export type UpdateOsImageRequest = z.infer<typeof UpdateOsImageRequestSchema>;

export type UpdateOsImageResponse = CvmFinalityWaitAccepted;

// PATCH /cvms/{id}/os-image returns 202 Accepted with { message, correlation_id, status }
const { action: updateOsImage, safeAction: safeUpdateOsImage } = defineAction<
  UpdateOsImageRequest,
  typeof CvmFinalityWaitAcceptedSchema
>(CvmFinalityWaitAcceptedSchema, async (client, request) => {
  const parsed = UpdateOsImageRequestSchema.parse(request);
  const { cvmId } = CvmIdSchema.parse(parsed);
  const { os_image_name } = parsed;
  return await client.patch(`/cvms/${cvmId}/os-image`, { os_image_name });
});

export { updateOsImage, safeUpdateOsImage };
