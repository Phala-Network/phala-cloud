import { z } from "zod";
import { type Client, type SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";
import { PaginatedCvmInfosV20251028Schema } from "../../types/cvm_info_v20251028";
import type { PaginatedCvmInfosV20251028 } from "../../types/cvm_info_v20251028";
import {
  PaginatedCvmInfosV20260121Schema,
  PaginatedCvmInfosV20260522Schema,
} from "../../types/cvm_info_v20260121";
import type {
  PaginatedCvmInfosV20260121,
  PaginatedCvmInfosV20260522,
} from "../../types/cvm_info_v20260121";
import type { GetCvmListResponse } from "../../types/version-mappings";

export const GetCvmListRequestSchema = z
  .object({
    page: z.number().int().min(1).optional(),
    page_size: z.number().int().min(1).optional(),
    node_id: z.number().int().min(1).optional(),
    teepod_id: z.number().int().min(1).optional(),
    user_id: z.string().optional(),
    family: z.enum(["all", "cpu", "gpu"]).optional(),
    instance_types: z.array(z.string()).optional(),
  })
  .strict();

export type GetCvmListRequest = z.infer<typeof GetCvmListRequestSchema>;

function getSchemaForVersion(version: ApiVersion) {
  if (version === "2025-10-28") return PaginatedCvmInfosV20251028Schema;
  if (version === "2026-01-21") return PaginatedCvmInfosV20260121Schema;
  return PaginatedCvmInfosV20260522Schema;
}

/**
 * Get a paginated list of CVMs
 *
 * @param client - The API client
 * @param request - Optional request parameters for pagination and filtering
 * @param request.page - Page number (1-based)
 * @param request.page_size - Number of items per page
 * @param request.node_id - Filter by node ID
 * @returns Paginated list of CVMs with type based on client API version
 *
 * @example
 * ```typescript
 * // Get first page with default size
 * const list = await getCvmList(client, { page: 1 })
 *
 * // Get with custom page size
 * const list = await getCvmList(client, { page: 1, page_size: 20 })
 * ```
 */
export function getCvmList<V extends ApiVersion>(
  client: Client<V>,
  request?: GetCvmListRequest,
): Promise<GetCvmListResponse<V>>;
export async function getCvmList<V extends ApiVersion>(
  client: Client<V>,
  request?: GetCvmListRequest,
): Promise<GetCvmListResponse<V>> {
  const validatedRequest = GetCvmListRequestSchema.parse(request ?? {});
  const response = await client.get("/cvms/paginated", { params: validatedRequest });
  const schema = getSchemaForVersion(client.config.version);
  return schema.parse(response) as GetCvmListResponse<V>;
}

/**
 * Safe version of getCvmList that returns a SafeResult instead of throwing
 */
export function safeGetCvmList<V extends ApiVersion>(
  client: Client<V>,
  request?: GetCvmListRequest,
): Promise<SafeResult<GetCvmListResponse<V>>>;
export async function safeGetCvmList<V extends ApiVersion>(
  client: Client<V>,
  request?: GetCvmListRequest,
): Promise<SafeResult<GetCvmListResponse<V>>> {
  try {
    const data = await getCvmList(client, request);
    return { success: true, data };
  } catch (error) {
    if (error && typeof error === "object" && ("status" in error || "issues" in error)) {
      return { success: false, error } as SafeResult<GetCvmListResponse<V>>;
    }
    return {
      success: false,
      error: {
        name: "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    } as SafeResult<GetCvmListResponse<V>>;
  }
}
