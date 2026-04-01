import { type Client, type SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";
import { CvmDetailV20251028Schema } from "../../types/cvm_info_v20251028";
import type { CvmDetailV20251028 } from "../../types/cvm_info_v20251028";
import { CvmInfoDetailV20260121Schema } from "../../types/cvm_info_v20260121";
import type { CvmInfoDetailV20260121 } from "../../types/cvm_info_v20260121";
import { CvmIdObjectSchema, type CvmIdInput } from "../../types/cvm_id";
import type { GetCvmInfoResponse } from "../../types/version-mappings";

export const GetCvmInfoRequestSchema = CvmIdObjectSchema.refine(
  (data) => !!(data.id || data.uuid || data.app_id || data.instance_id || data.name),
  "One of id, uuid, app_id, instance_id, or name must be provided",
);
export type GetCvmInfoRequest = CvmIdInput;

function normalizeDirectIdentifier(rawId: string): string {
  if (/^[0-9a-f]{40}$/i.test(rawId)) {
    return rawId;
  }
  if (rawId.startsWith("app_")) {
    return rawId.slice(4);
  }
  if (rawId.startsWith("uuid_")) {
    return rawId.slice(5).replace(/-/g, "");
  }
  if (rawId.startsWith("instance_")) {
    return rawId;
  }
  if (
    /^[0-9a-f]{8}[-]?[0-9a-f]{4}[-]?4[0-9a-f]{3}[-]?[89ab][0-9a-f]{3}[-]?[0-9a-f]{12}$/i.test(rawId)
  ) {
    return rawId.replace(/-/g, "");
  }
  return rawId;
}

function resolveCvmInfoPath(request: GetCvmInfoRequest): string {
  const validatedRequest = GetCvmInfoRequestSchema.parse(request);

  if (validatedRequest.id) {
    return normalizeDirectIdentifier(validatedRequest.id);
  }
  if (validatedRequest.uuid) {
    return validatedRequest.uuid.replace(/-/g, "");
  }
  if (validatedRequest.app_id) {
    return validatedRequest.app_id.replace(/^app_/, "");
  }
  if (validatedRequest.instance_id) {
    return validatedRequest.instance_id.startsWith("instance_")
      ? validatedRequest.instance_id
      : `instance_${validatedRequest.instance_id}`;
  }
  return validatedRequest.name as string;
}

function getSchemaForVersion(version: ApiVersion) {
  return version === "2025-10-28" ? CvmDetailV20251028Schema : CvmInfoDetailV20260121Schema;
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
  const cvmPath = resolveCvmInfoPath(request);
  const response = await client.get(`/cvms/${cvmPath}`);
  const schema = getSchemaForVersion(client.config.version);
  return schema.parse(response) as GetCvmInfoResponse<V>;
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
