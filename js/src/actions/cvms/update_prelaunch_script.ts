import { z } from "zod";
import { type Client } from "../../client";
import { CvmIdObjectSchema, CvmIdSchema, refineCvmId } from "../../types/cvm_id";
import { KmsInfoSchema } from "../../types/kms_info";
import { defineAction } from "../../utils/define-action";
import { PhalaCloudError } from "../../utils/errors";

/**
 * Update CVM pre-launch script
 *
 * Updates the pre-launch script for a CVM. The pre-launch script runs before the main containers start.
 * Supports two scenarios:
 * 1. Legacy/offchain KMS: Direct update without compose hash verification
 * 2. Contract-owned KMS (ETHEREUM/BASE): Requires compose hash verification (two-phase)
 *
 * When using contract-owned KMS and compose_hash/transaction_hash are not provided,
 * the API returns HTTP 465 with the compose hash to sign.
 * The client should then register the compose hash on-chain and retry the request
 * with both compose_hash and transaction_hash.
 *
 * @example
 * ```typescript
 * import { createClient, updatePreLaunchScript } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 *
 * const script = `#!/bin/bash
 * echo "Initializing..."
 * # Your pre-launch commands here
 * `
 *
 * // Phase 1: Initial update (may return precondition_required for contract-owned KMS)
 * const result = await updatePreLaunchScript(client, {
 *   id: 'cvm-123',
 *   pre_launch_script: script
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
 *   const finalResult = await updatePreLaunchScript(client, {
 *     id: 'cvm-123',
 *     pre_launch_script: script,
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
 * `UpdatePreLaunchScriptResult | unknown`
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
 * - **Type:** `UpdatePreLaunchScriptRequest`
 *
 * Request parameters containing CVM ID, pre_launch_script content, and optional compose_hash/transaction_hash.
 *
 * ### parameters (optional)
 * - **Type:** `UpdatePreLaunchScriptParameters`
 *
 * Optional behavior parameters for schema validation.
 *
 * ```typescript
 * // Use default schema
 * const result = await updatePreLaunchScript(client, {
 *   id: 'cvm-123',
 *   pre_launch_script: script
 * })
 *
 * // Return raw data without validation
 * const raw = await updatePreLaunchScript(client, request, { schema: false })
 *
 * // Use custom schema
 * const customSchema = z.object({ status: z.string() })
 * const custom = await updatePreLaunchScript(client, request, { schema: customSchema })
 * ```
 *
 * ## Safe Version
 *
 * Use `safeUpdatePreLaunchScript` for error handling without exceptions:
 *
 * ```typescript
 * import { safeUpdatePreLaunchScript } from '@phala/cloud'
 *
 * const result = await safeUpdatePreLaunchScript(client, {
 *   id: 'cvm-123',
 *   pre_launch_script: script
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

export const UpdatePreLaunchScriptRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    pre_launch_script: z.string().describe("Pre-launch script content (shell script)"),
    compose_hash: z
      .string()
      .optional()
      .describe("Compose hash for verification (Phase 2, contract-owned KMS only)"),
    transaction_hash: z
      .string()
      .optional()
      .describe("On-chain transaction hash for verification (Phase 2, contract-owned KMS only)"),
  }),
).transform((data) => {
  // Use CvmIdSchema to normalize the CVM ID
  const { cvmId } = CvmIdSchema.parse(data);
  return {
    cvmId,
    request: {
      pre_launch_script: data.pre_launch_script,
      compose_hash: data.compose_hash,
      transaction_hash: data.transaction_hash,
    },
    _raw: data,
  };
});

// Response when update is successfully initiated (202)
const UpdatePreLaunchScriptInProgressSchema = z.object({
  status: z.literal("in_progress"),
  message: z.string(),
  correlation_id: z.string(),
});

// Response when compose hash verification is required (465)
const UpdatePreLaunchScriptPreconditionRequiredSchema = z.object({
  status: z.literal("precondition_required"),
  message: z.string(),
  compose_hash: z.string(),
  app_id: z.string(),
  device_id: z.string(),
  kms_info: KmsInfoSchema,
});

const UpdatePreLaunchScriptNoChangeSchema = z.object({
  status: z.literal("no_change"),
  message: z.string(),
});

// Union type for the result
export const UpdatePreLaunchScriptResultSchema = z.union([
  UpdatePreLaunchScriptInProgressSchema,
  UpdatePreLaunchScriptPreconditionRequiredSchema,
  UpdatePreLaunchScriptNoChangeSchema,
]);

export type UpdatePreLaunchScriptRequest = z.input<typeof UpdatePreLaunchScriptRequestSchema>;
export type UpdatePreLaunchScriptResult = z.infer<typeof UpdatePreLaunchScriptResultSchema>;
export type UpdatePreLaunchScriptInProgress = z.infer<typeof UpdatePreLaunchScriptInProgressSchema>;
export type UpdatePreLaunchScriptPreconditionRequired = z.infer<
  typeof UpdatePreLaunchScriptPreconditionRequiredSchema
>;

/**
 * Update CVM pre-launch script
 *
 * @param client - The API client
 * @param request - Request parameters containing CVM ID and pre-launch script content
 * @param parameters - Optional behavior parameters
 * @returns Update result (either in_progress or precondition_required)
 */
const { action: updatePreLaunchScript, safeAction: safeUpdatePreLaunchScript } = defineAction<
  UpdatePreLaunchScriptRequest,
  typeof UpdatePreLaunchScriptResultSchema
>(UpdatePreLaunchScriptResultSchema, async (client, request) => {
  const validatedRequest = UpdatePreLaunchScriptRequestSchema.parse(request);

  // Prepare headers for compose_hash and transaction_hash
  const headers: Record<string, string> = {
    "Content-Type": "text/plain",
  };

  if (validatedRequest.request.compose_hash) {
    headers["X-Compose-Hash"] = validatedRequest.request.compose_hash;
  }

  if (validatedRequest.request.transaction_hash) {
    headers["X-Transaction-Hash"] = validatedRequest.request.transaction_hash;
  }

  try {
    // Make the PATCH request with plain text body and headers
    const response = await client.patch<UpdatePreLaunchScriptInProgress>(
      `/cvms/${validatedRequest.cvmId}/pre-launch-script`,
      validatedRequest.request.pre_launch_script,
      { headers },
    );

    // Success case (202) - return as-is
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

export { updatePreLaunchScript, safeUpdatePreLaunchScript };
