import { z } from "zod";
import { CvmIdObjectSchema, CvmIdSchema, refineCvmId } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";

const InstanceIdRefreshResultBaseSchema = z.object({
  identifier: z.string(),
  status: z.enum(["updated", "unchanged", "skipped", "conflict", "error"]),
  old_instance_id: z.string().nullable().optional(),
  new_instance_id: z.string().nullable().optional(),
  source: z.enum(["teepod_state", "teepod_info", "gateway", "none"]),
  verified_with_gateway: z.boolean(),
  reason: z.string().nullable().optional(),
});

export const InstanceIdRefreshResultV20260121Schema = InstanceIdRefreshResultBaseSchema.extend({
  cvm_id: z.number().nullable(),
});
export type InstanceIdRefreshResultV20260121 = z.infer<
  typeof InstanceIdRefreshResultV20260121Schema
>;

export const InstanceIdRefreshResultV20260522Schema = InstanceIdRefreshResultBaseSchema.extend({
  cvm_id: z.string().nullable(),
});
export type InstanceIdRefreshResultV20260522 = z.infer<
  typeof InstanceIdRefreshResultV20260522Schema
>;

export const InstanceIdRefreshResultAnySchema = z.union([
  InstanceIdRefreshResultV20260121Schema,
  InstanceIdRefreshResultV20260522Schema,
]);
export const InstanceIdRefreshResultSchema = InstanceIdRefreshResultV20260522Schema;
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
