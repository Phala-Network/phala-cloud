import { z } from "zod";
import { CvmIdObjectSchema, CvmIdSchema, refineCvmId } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";

export const InstanceIdRefreshResultSchema = z.object({
  cvm_id: z.string(),
  identifier: z.string(),
  status: z.enum(["updated", "unchanged", "skipped", "conflict", "error"]),
  old_instance_id: z.string().nullable().optional(),
  new_instance_id: z.string().nullable().optional(),
  source: z.enum(["teepod_state", "teepod_info", "gateway", "none"]),
  verified_with_gateway: z.boolean(),
  reason: z.string().nullable().optional(),
});

export type InstanceIdRefreshResult = z.infer<typeof InstanceIdRefreshResultSchema>;

export const RefreshCvmInstanceIdRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    overwrite: z.boolean().optional(),
    dry_run: z.boolean().optional(),
  }),
);

export type RefreshCvmInstanceIdRequest = z.infer<typeof RefreshCvmInstanceIdRequestSchema>;

const { action: refreshCvmInstanceId, safeAction: safeRefreshCvmInstanceId } = defineAction<
  RefreshCvmInstanceIdRequest,
  typeof InstanceIdRefreshResultSchema
>(InstanceIdRefreshResultSchema, async (client, request) => {
  const parsed = RefreshCvmInstanceIdRequestSchema.parse(request);
  const { cvmId } = CvmIdSchema.parse(parsed);
  const { overwrite, dry_run } = parsed;

  return await client.patch(`/cvms/${cvmId}/instance-id`, {
    overwrite,
    dry_run,
  });
});

export { refreshCvmInstanceId, safeRefreshCvmInstanceId };
