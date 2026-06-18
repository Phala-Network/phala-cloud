import { z } from "zod";
import { CvmIdSchema, CvmIdObjectSchema, refineCvmId } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";

/**
 * Update CVM resources (resize)
 *
 * This action updates the resource allocation (CPU, memory, disk) for a CVM.
 * Returns 202 Accepted as the operation may take time to complete.
 *
 * @example
 * ```typescript
 * import { createClient, updateCvmResources } from '@phala/cloud'
 *
 * const client = createClient();
 * await updateCvmResources(client, {
 *   id: 'my-cvm-id',
 *   vcpu: 4,
 *   memory: 8192,
 *   disk_size: 50,
 *   allow_restart: true
 * });
 * console.log('Resource update initiated');
 * ```
 */

export const UpdateCvmResourcesRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    vcpu: z.number().optional(),
    memory: z.number().optional(),
    disk_size: z.number().optional(),
    instance_type: z.string().optional(),
    allow_restart: z.boolean().optional(),
  }),
);

export type UpdateCvmResourcesRequest = z.infer<typeof UpdateCvmResourcesRequestSchema>;

const UpdateCvmResourcesResponseSchema = z.object({
  message: z.string(),
  correlation_id: z.string(),
  status: z.string(),
});

export type UpdateCvmResourcesResponse = z.infer<typeof UpdateCvmResourcesResponseSchema>;

const { action: updateCvmResources, safeAction: safeUpdateCvmResources } = defineAction<
  UpdateCvmResourcesRequest,
  typeof UpdateCvmResourcesResponseSchema
>(UpdateCvmResourcesResponseSchema, async (client, request) => {
  const parsed = UpdateCvmResourcesRequestSchema.parse(request);
  const { cvmId } = CvmIdSchema.parse(parsed);
  const { ...body } = parsed;
  return await client.patch(`/cvms/${cvmId}`, body);
});

export { updateCvmResources, safeUpdateCvmResources };
