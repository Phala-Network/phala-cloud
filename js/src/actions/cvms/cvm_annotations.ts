import { z } from "zod";
import { CvmIdObjectSchema, CvmIdSchema, refineCvmId, type CvmIdInput } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";

/**
 * CVM annotations: opaque key/value metadata for host-side tooling, stored by
 * the node's dstack VMM (>= 0.6.1). Not passed to the guest, not measured and
 * not part of the compose hash, so attestation does not cover them; do not rely
 * on them for security. Phala Cloud keeps no copy: a replica starts without
 * annotations. Needs the `cvm_annotations` feature flag.
 */
export const CvmAnnotationsSchema = z.object({
  annotations: z.record(z.string(), z.string()),
});

export type CvmAnnotations = z.infer<typeof CvmAnnotationsSchema>;

export const GetCvmAnnotationsRequestSchema = CvmIdSchema;

export type GetCvmAnnotationsRequest = CvmIdInput;

/**
 * Get the annotations the node's VMM stores for a CVM
 *
 * @example
 * ```typescript
 * import { createClient, getCvmAnnotations } from '@phala/cloud'
 *
 * const client = createClient()
 * const { annotations } = await getCvmAnnotations(client, { id: 'my-cvm' })
 * ```
 */
const { action: getCvmAnnotations, safeAction: safeGetCvmAnnotations } = defineAction<
  GetCvmAnnotationsRequest,
  typeof CvmAnnotationsSchema
>(CvmAnnotationsSchema, async (client, request) => {
  const { cvmId } = GetCvmAnnotationsRequestSchema.parse(request);
  return await client.get(`/cvms/${cvmId}/annotations`);
});

export const UpdateCvmAnnotationsRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    annotations: z.record(z.string(), z.string()),
  }),
);

export type UpdateCvmAnnotationsRequest = z.input<typeof UpdateCvmAnnotationsRequestSchema>;

/**
 * Replace every annotation of a CVM; an empty object clears them
 *
 * The VMM applies the change at once, without a restart. Host tools that read
 * annotations only when QEMU launches see the new values after the CVM restarts.
 *
 * @example
 * ```typescript
 * import { createClient, getCvmAnnotations, updateCvmAnnotations } from '@phala/cloud'
 *
 * const client = createClient()
 * const { annotations } = await getCvmAnnotations(client, { id: 'my-cvm' })
 * await updateCvmAnnotations(client, {
 *   id: 'my-cvm',
 *   annotations: { ...annotations, memory_tier: 'fast' },
 * })
 * ```
 */
const { action: updateCvmAnnotations, safeAction: safeUpdateCvmAnnotations } = defineAction<
  UpdateCvmAnnotationsRequest,
  typeof CvmAnnotationsSchema
>(CvmAnnotationsSchema, async (client, request) => {
  const parsed = UpdateCvmAnnotationsRequestSchema.parse(request);
  const { cvmId } = CvmIdSchema.parse(parsed);
  return await client.put(`/cvms/${cvmId}/annotations`, { annotations: parsed.annotations });
});

export { getCvmAnnotations, safeGetCvmAnnotations, updateCvmAnnotations, safeUpdateCvmAnnotations };
