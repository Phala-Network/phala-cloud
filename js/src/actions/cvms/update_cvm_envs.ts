import { z } from "zod";
import { type Client } from "../../client";
import { CvmIdObjectSchema, CvmIdSchema, refineCvmId } from "../../types/cvm_id";
import { KmsInfoSchema } from "../../types/kms_info";
import { defineAction } from "../../utils/define-action";
import { PhalaCloudError } from "../../utils/errors";

/**
 * Update CVM environment variables
 *
 * Updates environment variables for a CVM. Supports two scenarios:
 * 1. Encrypted environment only: Direct update without compose hash verification
 * 2. Allowed environment keys change: Requires compose hash verification (two-phase)
 *
 * When allowed_envs changes and compose_hash/transaction_hash are not provided,
 * the API returns HTTP 465 with the compose hash to sign.
 * The client should then register the compose hash on-chain and retry the request
 * with both compose_hash and transaction_hash.
 *
 * @example
 * ```typescript
 * import { createClient, updateCvmEnvs } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 *
 * // Phase 1: Initial update (may return precondition_required)
 * const result = await updateCvmEnvs(client, {
 *   id: 'cvm-123',
 *   encrypted_env: 'hex-encoded-encrypted-data',
 *   env_keys: ['API_KEY', 'DATABASE_URL']
 * })
 *
 * if (result.status === 'precondition_required') {
 *   // Register compose hash on-chain and get transaction hash
 *   const txHash = await registerComposeHashOnChain(
 *     result.compose_hash,
 *     result.kms_info
 *   )
 *
 *   // Phase 2: Retry with compose hash and transaction hash
 *   const finalResult = await updateCvmEnvs(client, {
 *     id: 'cvm-123',
 *     encrypted_env: 'hex-encoded-encrypted-data',
 *     env_keys: ['API_KEY', 'DATABASE_URL'],
 *     compose_hash: result.compose_hash,
 *     transaction_hash: txHash
 *   })
 *
 *   if (finalResult.status === 'in_progress') {
 *     console.log(`Update started: ${finalResult.correlation_id}`)
 *   }
 * }
 * ```
 *
 * ## Returns
 *
 * `UpdateCvmEnvsResult | unknown`
 *
 * Returns either:
 * - `{ status: "in_progress", ... }` - Update initiated successfully
 * - `{ status: "precondition_required", compose_hash: "...", ... }` - Compose hash verification required
 *
 * Return type depends on schema parameter.
 *
 * ## Parameters
 *
 * ### request (required)
 * - **Type:** `UpdateCvmEnvsRequest`
 *
 * Request parameters containing CVM ID, encrypted environment, and optional env_keys/compose_hash.
 *
 * ### parameters (optional)
 * - **Type:** `UpdateCvmEnvsParameters`
 *
 * Optional behavior parameters for schema validation.
 *
 * ```typescript
 * // Use default schema
 * const result = await updateCvmEnvs(client, {
 *   id: 'cvm-123',
 *   encrypted_env: 'hex-data'
 * })
 *
 * // Return raw data without validation
 * const raw = await updateCvmEnvs(client, request, { schema: false })
 *
 * // Use custom schema
 * const customSchema = z.object({ status: z.string() })
 * const custom = await updateCvmEnvs(client, request, { schema: customSchema })
 * ```
 *
 * ## Safe Version
 *
 * Use `safeUpdateCvmEnvs` for error handling without exceptions:
 *
 * ```typescript
 * import { safeUpdateCvmEnvs } from '@phala/cloud'
 *
 * const result = await safeUpdateCvmEnvs(client, {
 *   id: 'cvm-123',
 *   encrypted_env: 'hex-data',
 *   env_keys: ['API_KEY']
 * })
 *
 * if (result.success) {
 *   if (result.data.status === 'precondition_required') {
 *     console.log(`Compose hash: ${result.data.compose_hash}`)
 *     console.log(`App ID: ${result.data.app_id}`)
 *     // Register on-chain and retry with transaction_hash
 *   } else {
 *     console.log(`Update started: ${result.data.correlation_id}`)
 *   }
 * } else {
 *   if ("isRequestError" in result.error) {
 *     console.error(`HTTP ${result.error.status}: ${result.error.message}`)
 *   } else {
 *     console.error(`Validation error: ${result.error.issues}`)
 *   }
 * }
 * ```
 */

export const UpdateCvmEnvsRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    encrypted_env: z.string().describe("Encrypted environment variables (hex string)"),
    env_keys: z.array(z.string()).optional().describe("List of allowed environment variable keys"),
    compose_hash: z
      .string()
      .optional()
      .describe("Compose hash for verification (Phase 2, required when env_keys changes)"),
    transaction_hash: z
      .string()
      .optional()
      .describe(
        "On-chain transaction hash for verification (Phase 2, required when env_keys changes)",
      ),
  }),
).transform((data) => {
  // Use CvmIdSchema to normalize the CVM ID
  const { cvmId } = CvmIdSchema.parse(data);
  return {
    cvmId,
    request: {
      encrypted_env: data.encrypted_env,
      env_keys: data.env_keys,
      compose_hash: data.compose_hash,
      transaction_hash: data.transaction_hash,
    },
    _raw: data,
  };
});

// Response when update is successfully initiated (200)
const UpdateCvmEnvsInProgressSchema = z.object({
  status: z.literal("in_progress"),
  message: z.string(),
  correlation_id: z.string(),
  allowed_envs_changed: z.boolean(),
});

// Response when compose hash verification is required (428)
const UpdateCvmEnvsPreconditionRequiredSchema = z.object({
  status: z.literal("precondition_required"),
  message: z.string(),
  compose_hash: z.string(),
  app_id: z.string(),
  device_id: z.string(),
  kms_info: KmsInfoSchema,
});

// Union type for the result
export const UpdateCvmEnvsResultSchema = z.union([
  UpdateCvmEnvsInProgressSchema,
  UpdateCvmEnvsPreconditionRequiredSchema,
]);

export type UpdateCvmEnvsRequest = z.input<typeof UpdateCvmEnvsRequestSchema>;
export type UpdateCvmEnvsResult = z.infer<typeof UpdateCvmEnvsResultSchema>;
export type UpdateCvmEnvsInProgress = z.infer<typeof UpdateCvmEnvsInProgressSchema>;
export type UpdateCvmEnvsPreconditionRequired = z.infer<
  typeof UpdateCvmEnvsPreconditionRequiredSchema
>;

/**
 * Update CVM environment variables
 *
 * @param client - The API client
 * @param request - Request parameters containing CVM ID and environment data
 * @param parameters - Optional behavior parameters
 * @returns Update result (either in_progress or precondition_required)
 */
const { action: updateCvmEnvs, safeAction: safeUpdateCvmEnvs } = defineAction<
  UpdateCvmEnvsRequest,
  typeof UpdateCvmEnvsResultSchema
>(UpdateCvmEnvsResultSchema, async (client, request) => {
  const validatedRequest = UpdateCvmEnvsRequestSchema.parse(request);

  try {
    // Make the PATCH request
    const response = await client.patch<UpdateCvmEnvsInProgress>(
      `/cvms/${validatedRequest.cvmId}/envs`,
      validatedRequest.request,
    );

    // Success case (200) - return as-is
    return response;
  } catch (error) {
    // Check if it's a 465 (Hash Registration Required) error
    if (error instanceof PhalaCloudError && error.status === 465) {
      // Extract the 465 response data
      const detail = error.detail;

      // Validate it matches our expected 465 structure
      if (detail && typeof detail === "object") {
        const detailObj = detail as Record<string, unknown>;

        // Backend returns StructuredError format with fields in a details array:
        // { error_code, message, details: [{ field, value }, ...], suggestions, links }
        // Extract field values from the details array
        const detailsArray = detailObj.details as
          | Array<{ field: string; value: unknown }>
          | undefined;

        if (detailsArray && Array.isArray(detailsArray)) {
          const fieldMap = new Map(detailsArray.map((d) => [d.field, d.value]));
          const composeHash = fieldMap.get("compose_hash");
          const appId = fieldMap.get("app_id");
          const deviceId = fieldMap.get("device_id");
          const kmsInfo = fieldMap.get("kms_info");

          if (composeHash && appId) {
            return {
              status: "precondition_required" as const,
              message: (detailObj.message as string) || "Compose hash verification required",
              compose_hash: composeHash as string,
              app_id: appId as string,
              device_id: (deviceId as string) || "",
              kms_info: kmsInfo,
            };
          }
        }
      }
    }

    // Re-throw other errors
    throw error;
  }
});

export { updateCvmEnvs, safeUpdateCvmEnvs };
