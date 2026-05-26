import { z } from "zod";
import { type Client, type SafeResult } from "../../client";
import { DstackAppWithCvmResponseV20251028Schema } from "../../types/app_info_v20251028";
import type { DstackAppWithCvmResponseV20251028 } from "../../types/app_info_v20251028";
import {
  DstackAppWithCvmResponseV20260121Schema,
  DstackAppWithCvmResponseV20260522Schema,
} from "../../types/app_info_v20260121";
import type {
  DstackAppWithCvmResponseV20260121,
  DstackAppWithCvmResponseV20260522,
} from "../../types/app_info_v20260121";
import type { ApiVersion } from "../../types/client";
import type { GetAppInfoResponse } from "../../types/version-mappings";

export const GetAppInfoRequestSchema = z
  .object({
    appId: z.string().min(1),
  })
  .strict();

export type GetAppInfoRequest = z.infer<typeof GetAppInfoRequestSchema>;

function getSchemaForVersion(version: ApiVersion) {
  if (version === "2025-10-28") return DstackAppWithCvmResponseV20251028Schema;
  if (version === "2026-01-21") return DstackAppWithCvmResponseV20260121Schema;
  return DstackAppWithCvmResponseV20260522Schema;
}

/**
 * Get information about a specific app
 *
 * @param client - The API client
 * @param request - Request parameters
 * @param request.appId - The app ID to get information for
 * @returns App information with type based on client API version
 *
 * @example
 * ```typescript
 * const info = await getAppInfo(client, { appId: "my-app-id" })
 * ```
 */
export function getAppInfo<V extends ApiVersion>(
  client: Client<V>,
  request: GetAppInfoRequest,
): Promise<GetAppInfoResponse<V>>;
export async function getAppInfo<V extends ApiVersion>(
  client: Client<V>,
  request: GetAppInfoRequest,
): Promise<GetAppInfoResponse<V>> {
  const { appId } = GetAppInfoRequestSchema.parse(request);
  const response = await client.get(`/apps/${appId}`);
  const schema = getSchemaForVersion(client.config.version);
  return schema.parse(response) as GetAppInfoResponse<V>;
}

/**
 * Safe version of getAppInfo that returns a SafeResult instead of throwing
 */
export function safeGetAppInfo<V extends ApiVersion>(
  client: Client<V>,
  request: GetAppInfoRequest,
): Promise<SafeResult<GetAppInfoResponse<V>>>;
export async function safeGetAppInfo<V extends ApiVersion>(
  client: Client<V>,
  request: GetAppInfoRequest,
): Promise<SafeResult<GetAppInfoResponse<V>>> {
  try {
    const data = await getAppInfo(client, request);
    return { success: true, data };
  } catch (error) {
    if (error && typeof error === "object" && ("status" in error || "issues" in error)) {
      return { success: false, error } as SafeResult<GetAppInfoResponse<V>>;
    }
    return {
      success: false,
      error: {
        name: "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    } as SafeResult<GetAppInfoResponse<V>>;
  }
}
