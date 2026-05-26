import { z } from "zod";
import { type Client, type SafeResult } from "../../client";
import { DstackAppListResponseV20251028Schema } from "../../types/app_info_v20251028";
import type { DstackAppListResponseV20251028 } from "../../types/app_info_v20251028";
import {
  DstackAppListResponseV20260121Schema,
  DstackAppListResponseV20260522Schema,
} from "../../types/app_info_v20260121";
import type {
  DstackAppListResponseV20260121,
  DstackAppListResponseV20260522,
} from "../../types/app_info_v20260121";
import type { ApiVersion } from "../../types/client";
import type { GetAppListResponse } from "../../types/version-mappings";

export const GetAppListRequestSchema = z
  .object({
    page: z.number().int().min(1).optional(),
    page_size: z.number().int().min(1).max(100).optional(),
    search: z.string().optional(),
    status: z.array(z.string()).optional(),
    listed: z.boolean().optional(),
    base_image: z.string().optional(),
    instance_type: z.string().optional(),
    kms_slug: z.string().optional(),
    kms_type: z.string().optional(),
    node: z.string().optional(),
    region: z.string().optional(),
  })
  .strict();

export type GetAppListRequest = z.infer<typeof GetAppListRequestSchema>;

function getSchemaForVersion(version: ApiVersion) {
  if (version === "2025-10-28") return DstackAppListResponseV20251028Schema;
  if (version === "2026-01-21") return DstackAppListResponseV20260121Schema;
  return DstackAppListResponseV20260522Schema;
}

/**
 * Get a paginated list of apps
 *
 * @param client - The API client
 * @param request - Optional request parameters for pagination and filtering
 * @param request.page - Page number (1-based)
 * @param request.page_size - Number of items per page (max 100)
 * @param request.search - Search term to filter apps
 * @param request.status - Filter by CVM status
 * @param request.listed - Filter by listed status
 * @param request.base_image - Filter by base image
 * @param request.instance_type - Filter by instance type
 * @param request.kms_slug - Filter by KMS slug
 * @param request.kms_type - Filter by KMS type
 * @param request.node - Filter by node name
 * @param request.region - Filter by region
 * @returns Paginated list of apps with type based on client API version
 *
 * @example
 * ```typescript
 * // Get first page with default size
 * const list = await getAppList(client, { page: 1 })
 *
 * // Get with custom page size and search
 * const list = await getAppList(client, { page: 1, page_size: 20, search: "my-app" })
 * ```
 */
export function getAppList<V extends ApiVersion>(
  client: Client<V>,
  request?: GetAppListRequest,
): Promise<GetAppListResponse<V>>;
export async function getAppList<V extends ApiVersion>(
  client: Client<V>,
  request?: GetAppListRequest,
): Promise<GetAppListResponse<V>> {
  const validatedRequest = GetAppListRequestSchema.parse(request ?? {});
  const response = await client.get("/apps", { params: validatedRequest });
  const schema = getSchemaForVersion(client.config.version);
  return schema.parse(response) as GetAppListResponse<V>;
}

/**
 * Safe version of getAppList that returns a SafeResult instead of throwing
 */
export function safeGetAppList<V extends ApiVersion>(
  client: Client<V>,
  request?: GetAppListRequest,
): Promise<SafeResult<GetAppListResponse<V>>>;
export async function safeGetAppList<V extends ApiVersion>(
  client: Client<V>,
  request?: GetAppListRequest,
): Promise<SafeResult<GetAppListResponse<V>>> {
  try {
    const data = await getAppList(client, request);
    return { success: true, data };
  } catch (error) {
    if (error && typeof error === "object" && ("status" in error || "issues" in error)) {
      return { success: false, error } as SafeResult<GetAppListResponse<V>>;
    }
    return {
      success: false,
      error: {
        name: "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    } as SafeResult<GetAppListResponse<V>>;
  }
}
