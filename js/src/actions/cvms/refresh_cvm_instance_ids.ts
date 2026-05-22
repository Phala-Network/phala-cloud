import { z } from "zod";
import { defineAction } from "../../utils/define-action";
import {
  InstanceIdRefreshResultSchema,
  InstanceIdRefreshResultV20260121Schema,
  InstanceIdRefreshResultV20260522Schema,
} from "./refresh_cvm_instance_id";

export const RefreshCvmInstanceIdsRequestSchema = z
  .object({
    cvm_ids: z.array(z.string()).optional(),
    running_only: z.boolean().optional(),
    missing_only: z.boolean().optional(),
    overwrite: z.boolean().optional(),
    limit: z.number().int().min(1).max(500).optional(),
    dry_run: z.boolean().optional(),
  })
  .strict();

export type RefreshCvmInstanceIdsRequest = z.infer<typeof RefreshCvmInstanceIdsRequestSchema>;

const RefreshCvmInstanceIdsResponseBaseSchema = z.object({
  total: z.number().int(),
  scanned: z.number().int(),
  updated: z.number().int(),
  unchanged: z.number().int(),
  skipped: z.number().int(),
  conflicts: z.number().int(),
  errors: z.number().int(),
});

export const RefreshCvmInstanceIdsResponseV20260121Schema =
  RefreshCvmInstanceIdsResponseBaseSchema.extend({
    items: z.array(InstanceIdRefreshResultV20260121Schema),
  });
export type RefreshCvmInstanceIdsResponseV20260121 = z.infer<
  typeof RefreshCvmInstanceIdsResponseV20260121Schema
>;

export const RefreshCvmInstanceIdsResponseV20260522Schema =
  RefreshCvmInstanceIdsResponseBaseSchema.extend({
    items: z.array(InstanceIdRefreshResultV20260522Schema),
  });
export type RefreshCvmInstanceIdsResponseV20260522 = z.infer<
  typeof RefreshCvmInstanceIdsResponseV20260522Schema
>;

export const RefreshCvmInstanceIdsResponseAnySchema =
  RefreshCvmInstanceIdsResponseBaseSchema.extend({
    items: z.array(InstanceIdRefreshResultSchema),
  });

export const RefreshCvmInstanceIdsResponseSchema = RefreshCvmInstanceIdsResponseV20260522Schema;
export type RefreshCvmInstanceIdsResponse = z.infer<typeof RefreshCvmInstanceIdsResponseSchema>;

const { action: refreshCvmInstanceIds, safeAction: safeRefreshCvmInstanceIds } = defineAction<
  RefreshCvmInstanceIdsRequest,
  typeof RefreshCvmInstanceIdsResponseSchema
>(RefreshCvmInstanceIdsResponseSchema, async (client, request) => {
  const parsed = RefreshCvmInstanceIdsRequestSchema.parse(request);
  return await client.patch("/cvms/instance-ids", parsed);
});

export { refreshCvmInstanceIds, safeRefreshCvmInstanceIds };
