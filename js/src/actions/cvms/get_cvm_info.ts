import { z } from "zod";
import { type Client, type SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";
import { CvmDetailV20251028Schema } from "../../types/cvm_info_v20251028";
import type { CvmDetailV20251028 } from "../../types/cvm_info_v20251028";
import {
  type CvmGpuStatus,
  CvmGpuStatusSchema,
  CvmInfoDetailV20260121Schema,
  CvmInfoDetailV20260522Schema,
} from "../../types/cvm_info_v20260121";
import type {
  CvmInfoDetailV20260121,
  CvmInfoDetailV20260522,
} from "../../types/cvm_info_v20260121";
import { CvmIdObjectSchema, CvmIdSchema, type CvmIdInput } from "../../types/cvm_id";
import type { GetCvmInfoResponse } from "../../types/version-mappings";

export const GetCvmInfoRequestSchema = CvmIdObjectSchema.extend({
  cvmId: z.string().optional(),
  include_compose: z.boolean().optional(),
}).transform((request, ctx) => {
  const result = CvmIdSchema.safeParse({ ...request, id: request.cvmId ?? request.id });
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
    }
    return z.NEVER;
  }
  return { ...result.data, include_compose: request.include_compose };
});
export type GetCvmInfoRequest = CvmIdInput & { cvmId?: string; include_compose?: boolean };

function getSchemaForVersion(version: ApiVersion) {
  if (version === "2025-10-28") return CvmDetailV20251028Schema;
  if (version === "2026-01-21") return CvmInfoDetailV20260121Schema;
  return CvmInfoDetailV20260522Schema;
}

/**
 * Get information about a specific CVM
 *
 * @param client - The API client
 * @param request - Request parameters
 * @param request.cvmId - ID of the CVM to get information for
 * @returns CVM information with type based on client API version
 *
 * @example
 * ```typescript
 * const info = await getCvmInfo(client, { cvmId: "cvm-123" })
 * ```
 */
export function getCvmInfo<V extends ApiVersion>(
  client: Client<V>,
  request: GetCvmInfoRequest,
): Promise<GetCvmInfoResponse<V>>;
export async function getCvmInfo<V extends ApiVersion>(
  client: Client<V>,
  request: GetCvmInfoRequest,
): Promise<GetCvmInfoResponse<V>> {
  const validated = GetCvmInfoRequestSchema.parse(request);
  const { cvmId } = validated;
  const response =
    validated.include_compose === undefined
      ? await client.get(`/cvms/${cvmId}`)
      : await client.get(`/cvms/${cvmId}`, {
          params: { include_compose: validated.include_compose },
        });
  const schema = getSchemaForVersion(client.config.version);
  return schema.parse(response) as GetCvmInfoResponse<V>;
}

export async function getCvmGpuStatus(
  client: Client<ApiVersion>,
  request: { cvmId: string },
): Promise<CvmGpuStatus> {
  const { cvmId } = z.object({ cvmId: z.string().min(1) }).parse(request);
  return CvmGpuStatusSchema.parse(await client.get(`/cvms/${cvmId}/gpu-status`));
}

export async function safeGetCvmGpuStatus(
  client: Client<ApiVersion>,
  request: { cvmId: string },
): Promise<SafeResult<CvmGpuStatus>> {
  try {
    return { success: true, data: await getCvmGpuStatus(client, request) };
  } catch (error) {
    if (error && typeof error === "object" && ("status" in error || "issues" in error)) {
      return { success: false, error } as SafeResult<CvmGpuStatus>;
    }
    return {
      success: false,
      error: {
        name: "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    } as SafeResult<CvmGpuStatus>;
  }
}

/**
 * Safe version of getCvmInfo that returns a SafeResult instead of throwing
 */
export function safeGetCvmInfo<V extends ApiVersion>(
  client: Client<V>,
  request: GetCvmInfoRequest,
): Promise<SafeResult<GetCvmInfoResponse<V>>>;
export async function safeGetCvmInfo<V extends ApiVersion>(
  client: Client<V>,
  request: GetCvmInfoRequest,
): Promise<SafeResult<GetCvmInfoResponse<V>>> {
  try {
    const data = await getCvmInfo(client, request);
    return { success: true, data };
  } catch (error) {
    if (error && typeof error === "object" && ("status" in error || "issues" in error)) {
      return { success: false, error } as SafeResult<GetCvmInfoResponse<V>>;
    }
    return {
      success: false,
      error: {
        name: "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    } as SafeResult<GetCvmInfoResponse<V>>;
  }
}
