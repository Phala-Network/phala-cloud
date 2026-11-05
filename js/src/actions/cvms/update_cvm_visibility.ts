import { z } from "zod";
import { CvmIdSchema, CvmIdObjectSchema, refineCvmId } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";

/**
 * Update CVM visibility settings
 *
 * This action updates whether system info, logs and TCB info are publicly
 * accessible. It sends the flags to the unified `PATCH /cvms/{cvmId}` endpoint
 * and returns the accepted update (202) or `status: "no_change"` when the flags
 * already match.
 *
 * Visibility flags are part of the compose hash. For a CVM on contract-owned
 * KMS the request fails with HTTP 465 until the new compose hash is registered
 * on-chain; register it and call this action again, or use `patchCvm` and
 * `confirmCvmPatch` for the two-phase flow.
 *
 * @example
 * ```typescript
 * import { createClient, updateCvmVisibility } from '@phala/cloud'
 *
 * const client = createClient();
 * const result = await updateCvmVisibility(client, {
 *   id: 'my-cvm-id',
 *   public_sysinfo: true,
 *   public_logs: false
 * });
 * console.log(result.status, result.correlation_id);
 * ```
 */

export const UpdateCvmVisibilityRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    public_sysinfo: z.boolean(),
    public_logs: z.boolean(),
    public_tcbinfo: z.boolean().optional(),
  }),
);

export type UpdateCvmVisibilityRequest = z.infer<typeof UpdateCvmVisibilityRequestSchema>;

export const UpdateCvmVisibilityResponseSchema = z.object({
  message: z.string(),
  correlation_id: z.string(),
  status: z.string(),
});

export type UpdateCvmVisibilityResponse = z.infer<typeof UpdateCvmVisibilityResponseSchema>;

const { action: updateCvmVisibility, safeAction: safeUpdateCvmVisibility } = defineAction<
  UpdateCvmVisibilityRequest,
  typeof UpdateCvmVisibilityResponseSchema
>(UpdateCvmVisibilityResponseSchema, async (client, request) => {
  const parsed = UpdateCvmVisibilityRequestSchema.parse(request);
  const { cvmId } = CvmIdSchema.parse(parsed);
  const { public_sysinfo, public_logs, public_tcbinfo } = parsed;
  return await client.patch(`/cvms/${cvmId}`, {
    public_sysinfo,
    public_logs,
    public_tcbinfo,
  });
});

export { updateCvmVisibility, safeUpdateCvmVisibility };
