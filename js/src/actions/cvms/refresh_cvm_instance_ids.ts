import { z } from "zod";
import { type Client, type SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";
import type { RefreshCvmInstanceIdsVersionedResponse } from "../../types/version-mappings";
import {
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
    items: z.array(
      z.union([InstanceIdRefreshResultV20260121Schema, InstanceIdRefreshResultV20260522Schema]),
    ),
  });

export const RefreshCvmInstanceIdsResponseSchema = RefreshCvmInstanceIdsResponseV20260522Schema;
export type RefreshCvmInstanceIdsResponse = z.infer<typeof RefreshCvmInstanceIdsResponseSchema>;

function getSchemaForVersion(version: ApiVersion) {
  if (version === "2026-01-21") return RefreshCvmInstanceIdsResponseV20260121Schema;
  return RefreshCvmInstanceIdsResponseV20260522Schema;
}

export function refreshCvmInstanceIds<V extends ApiVersion>(
  client: Client<V>,
  request: RefreshCvmInstanceIdsRequest,
): Promise<RefreshCvmInstanceIdsVersionedResponse<V>>;
export async function refreshCvmInstanceIds<V extends ApiVersion>(
  client: Client<V>,
  request: RefreshCvmInstanceIdsRequest,
): Promise<RefreshCvmInstanceIdsVersionedResponse<V>> {
  const parsed = RefreshCvmInstanceIdsRequestSchema.parse(request);
  const response = await client.patch("/cvms/instance-ids", parsed);
  return getSchemaForVersion(client.config.version).parse(
    response,
  ) as RefreshCvmInstanceIdsVersionedResponse<V>;
}

export function safeRefreshCvmInstanceIds<V extends ApiVersion>(
  client: Client<V>,
  request: RefreshCvmInstanceIdsRequest,
): Promise<SafeResult<RefreshCvmInstanceIdsVersionedResponse<V>>>;
export async function safeRefreshCvmInstanceIds<V extends ApiVersion>(
  client: Client<V>,
  request: RefreshCvmInstanceIdsRequest,
): Promise<SafeResult<RefreshCvmInstanceIdsVersionedResponse<V>>> {
  try {
    const data = await refreshCvmInstanceIds(client, request);
    return { success: true, data };
  } catch (error) {
    if (error && typeof error === "object" && ("status" in error || "issues" in error)) {
      return { success: false, error } as SafeResult<RefreshCvmInstanceIdsVersionedResponse<V>>;
    }
    return {
      success: false,
      error: {
        name: "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    } as SafeResult<RefreshCvmInstanceIdsVersionedResponse<V>>;
  }
}
