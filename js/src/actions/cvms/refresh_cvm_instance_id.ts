import { z } from "zod";
import { type Client, type SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";
import { CvmIdObjectSchema, CvmIdSchema, refineCvmId } from "../../types/cvm_id";
import type { RefreshCvmInstanceIdResponse } from "../../types/version-mappings";

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

function getSchemaForVersion(version: ApiVersion) {
  if (version === "2026-01-21") return InstanceIdRefreshResultV20260121Schema;
  return InstanceIdRefreshResultV20260522Schema;
}

export function refreshCvmInstanceId<V extends ApiVersion>(
  client: Client<V>,
  request: RefreshCvmInstanceIdRequest,
): Promise<RefreshCvmInstanceIdResponse<V>>;
export async function refreshCvmInstanceId<V extends ApiVersion>(
  client: Client<V>,
  request: RefreshCvmInstanceIdRequest,
): Promise<RefreshCvmInstanceIdResponse<V>> {
  const parsed = RefreshCvmInstanceIdRequestSchema.parse(request);
  const { cvmId } = CvmIdSchema.parse(parsed);
  const { overwrite, dry_run } = parsed;
  const response = await client.patch(`/cvms/${cvmId}/instance-id`, { overwrite, dry_run });
  return getSchemaForVersion(client.config.version).parse(
    response,
  ) as RefreshCvmInstanceIdResponse<V>;
}

export function safeRefreshCvmInstanceId<V extends ApiVersion>(
  client: Client<V>,
  request: RefreshCvmInstanceIdRequest,
): Promise<SafeResult<RefreshCvmInstanceIdResponse<V>>>;
export async function safeRefreshCvmInstanceId<V extends ApiVersion>(
  client: Client<V>,
  request: RefreshCvmInstanceIdRequest,
): Promise<SafeResult<RefreshCvmInstanceIdResponse<V>>> {
  try {
    const data = await refreshCvmInstanceId(client, request);
    return { success: true, data };
  } catch (error) {
    if (error && typeof error === "object" && ("status" in error || "issues" in error)) {
      return { success: false, error } as SafeResult<RefreshCvmInstanceIdResponse<V>>;
    }
    return {
      success: false,
      error: {
        name: "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    } as SafeResult<RefreshCvmInstanceIdResponse<V>>;
  }
}
