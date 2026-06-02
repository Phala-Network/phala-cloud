import { z } from "zod";
import { type Client, type SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";
import { CvmIdSchema, type CvmIdInput } from "../../types/cvm_id";
import type { CheckCvmIsAllowedResponse } from "../../types/version-mappings";

const IsAllowedResultBaseSchema = z.object({
  app_contract_address: z.string(),
  compose_hash: z.string(),
  device_id: z.string(),
  compose_hash_allowed: z.boolean(),
  allow_any_device: z.boolean(),
  device_id_allowed: z.boolean().nullable().optional(),
  is_allowed: z.boolean(),
  error: z.string().nullable().optional(),
});

export const IsAllowedResultV20260121Schema = IsAllowedResultBaseSchema.extend({
  cvm_id: z.number().optional(),
});
export type IsAllowedResultV20260121 = z.infer<typeof IsAllowedResultV20260121Schema>;

export const IsAllowedResultV20260522Schema = IsAllowedResultBaseSchema.extend({
  cvm_id: z.string().optional(),
});
export type IsAllowedResultV20260522 = z.infer<typeof IsAllowedResultV20260522Schema>;

export const IsAllowedResultAnySchema = z.union([
  IsAllowedResultV20260121Schema,
  IsAllowedResultV20260522Schema,
]);
export const IsAllowedResultSchema = IsAllowedResultV20260522Schema;
export type IsAllowedResult = z.infer<typeof IsAllowedResultSchema>;

const CheckCvmIsAllowedInputSchema = z.object({
  cvmId: z.string().min(1),
  compose_hash: z.string().optional(),
  node_id: z.number().optional(),
  device_id: z.string().optional(),
});

export const CheckCvmIsAllowedRequestSchema = CheckCvmIsAllowedInputSchema;

export type CheckCvmIsAllowedRequest = z.infer<typeof CheckCvmIsAllowedInputSchema>;

function getSchemaForVersion(version: ApiVersion) {
  if (version === "2026-01-21") return IsAllowedResultV20260121Schema;
  return IsAllowedResultV20260522Schema;
}

/**
 * Check if a CVM deployment is allowed by its on-chain DStack App contract.
 *
 * @param client - The API client
 * @param request - Request parameters
 * @param request.cvmId - CVM identifier
 * @param request.compose_hash - Optional compose hash override
 * @param request.node_id - Optional node ID override (resolves device_id)
 * @param request.device_id - Optional device ID override
 * @returns On-chain allowance check result
 */
export function checkCvmIsAllowed<V extends ApiVersion>(
  client: Client<V>,
  request: CheckCvmIsAllowedRequest,
): Promise<CheckCvmIsAllowedResponse<V>>;
export async function checkCvmIsAllowed<V extends ApiVersion>(
  client: Client<V>,
  request: CheckCvmIsAllowedRequest,
): Promise<CheckCvmIsAllowedResponse<V>> {
  const { cvmId, ...body } = CheckCvmIsAllowedRequestSchema.parse(request);
  const response = await client.post(`/cvms/${cvmId}/is-allowed`, body);
  return getSchemaForVersion(client.config.version).parse(response) as CheckCvmIsAllowedResponse<V>;
}

export function safeCheckCvmIsAllowed<V extends ApiVersion>(
  client: Client<V>,
  request: CheckCvmIsAllowedRequest,
): Promise<SafeResult<CheckCvmIsAllowedResponse<V>>>;
export async function safeCheckCvmIsAllowed<V extends ApiVersion>(
  client: Client<V>,
  request: CheckCvmIsAllowedRequest,
): Promise<SafeResult<CheckCvmIsAllowedResponse<V>>> {
  try {
    const data = await checkCvmIsAllowed(client, request);
    return { success: true, data };
  } catch (error) {
    if (error && typeof error === "object" && ("status" in error || "issues" in error)) {
      return { success: false, error } as SafeResult<CheckCvmIsAllowedResponse<V>>;
    }
    return {
      success: false,
      error: {
        name: "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    } as SafeResult<CheckCvmIsAllowedResponse<V>>;
  }
}
