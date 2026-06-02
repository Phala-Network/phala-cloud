import { z } from "zod";
import { type Client, type SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";
import type { CheckAppCvmsIsAllowedResponse } from "../../types/version-mappings";
import {
  IsAllowedResultV20260121Schema,
  IsAllowedResultV20260522Schema,
} from "../cvms/check_cvm_is_allowed";

const AppCvmsBatchIsAllowedResponseBaseSchema = z.object({
  is_onchain: z.boolean(),
  total: z.number().default(0),
  allowed_count: z.number().default(0),
  denied_count: z.number().default(0),
  error_count: z.number().default(0),
});

export const AppCvmsBatchIsAllowedResponseV20260121Schema =
  AppCvmsBatchIsAllowedResponseBaseSchema.extend({
    results: z.array(IsAllowedResultV20260121Schema.extend({ cvm_id: z.number() })).default([]),
    skipped_cvm_ids: z.array(z.number()).default([]),
  });
export type AppCvmsBatchIsAllowedResponseV20260121 = z.infer<
  typeof AppCvmsBatchIsAllowedResponseV20260121Schema
>;

export const AppCvmsBatchIsAllowedResponseV20260522Schema =
  AppCvmsBatchIsAllowedResponseBaseSchema.extend({
    results: z.array(IsAllowedResultV20260522Schema.extend({ cvm_id: z.string() })).default([]),
    skipped_cvm_ids: z.array(z.string()).default([]),
  });
export type AppCvmsBatchIsAllowedResponseV20260522 = z.infer<
  typeof AppCvmsBatchIsAllowedResponseV20260522Schema
>;

export const AppCvmsBatchIsAllowedResponseAnySchema = z.union([
  AppCvmsBatchIsAllowedResponseV20260121Schema,
  AppCvmsBatchIsAllowedResponseV20260522Schema,
]);
export const AppCvmsBatchIsAllowedResponseSchema = AppCvmsBatchIsAllowedResponseV20260522Schema;
export type AppCvmsBatchIsAllowedResponse = z.infer<typeof AppCvmsBatchIsAllowedResponseSchema>;

export const CheckAppCvmsIsAllowedRequestSchema = z.object({
  appId: z.string().min(1),
});

export type CheckAppCvmsIsAllowedRequest = z.infer<typeof CheckAppCvmsIsAllowedRequestSchema>;

function getSchemaForVersion(version: ApiVersion) {
  if (version === "2026-01-21") return AppCvmsBatchIsAllowedResponseV20260121Schema;
  return AppCvmsBatchIsAllowedResponseV20260522Schema;
}

/**
 * Batch check on-chain deployment allowance for all CVMs under an app.
 *
 * For on-chain KMS apps, queries the blockchain via multicall3 to check
 * compose hash and device allowance for each CVM.
 * For offchain KMS apps, returns is_onchain=false with no results.
 *
 * @param client - The API client
 * @param request - Request parameters
 * @param request.appId - The hex app identifier
 * @returns Batch allowance check results for all CVMs
 */
export function checkAppCvmsIsAllowed<V extends ApiVersion>(
  client: Client<V>,
  request: CheckAppCvmsIsAllowedRequest,
): Promise<CheckAppCvmsIsAllowedResponse<V>>;
export async function checkAppCvmsIsAllowed<V extends ApiVersion>(
  client: Client<V>,
  request: CheckAppCvmsIsAllowedRequest,
): Promise<CheckAppCvmsIsAllowedResponse<V>> {
  const { appId } = CheckAppCvmsIsAllowedRequestSchema.parse(request);
  const response = await client.post(`/apps/${appId}/cvms/is-allowed`, {});
  return getSchemaForVersion(client.config.version).parse(
    response,
  ) as CheckAppCvmsIsAllowedResponse<V>;
}

export function safeCheckAppCvmsIsAllowed<V extends ApiVersion>(
  client: Client<V>,
  request: CheckAppCvmsIsAllowedRequest,
): Promise<SafeResult<CheckAppCvmsIsAllowedResponse<V>>>;
export async function safeCheckAppCvmsIsAllowed<V extends ApiVersion>(
  client: Client<V>,
  request: CheckAppCvmsIsAllowedRequest,
): Promise<SafeResult<CheckAppCvmsIsAllowedResponse<V>>> {
  try {
    const data = await checkAppCvmsIsAllowed(client, request);
    return { success: true, data };
  } catch (error) {
    if (error && typeof error === "object" && ("status" in error || "issues" in error)) {
      return { success: false, error } as SafeResult<CheckAppCvmsIsAllowedResponse<V>>;
    }
    return {
      success: false,
      error: {
        name: "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    } as SafeResult<CheckAppCvmsIsAllowedResponse<V>>;
  }
}
