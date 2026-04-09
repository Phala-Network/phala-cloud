import { z } from "zod";
import { type Client } from "../../client";
import { CvmIdObjectSchema, CvmIdSchema, refineCvmId } from "../../types/cvm_id";
import { KmsInfoSchema } from "../../types/kms_info";
import { defineAction } from "../../utils/define-action";
import { PhalaCloudError } from "../../utils/errors";

/**
 * Update CVM Docker Compose file
 *
 * Updates the Docker Compose configuration for a CVM. Supports two scenarios:
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
 * import { createClient, updateDockerCompose } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 *
 * const composeYaml = `
 * version: '3'
 * services:
 *   web:
 *     image: nginx:latest
 *     ports:
 *       - "80:80"
 * `
 *
 * // Phase 1: Initial update (may return precondition_required for contract-owned KMS)
 * const result = await updateDockerCompose(client, {
 *   id: 'cvm-123',
 *   docker_compose_file: composeYaml
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
 *   const finalResult = await updateDockerCompose(client, {
 *     id: 'cvm-123',
 *     docker_compose_file: composeYaml,
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
 * `UpdateDockerComposeResult | unknown`
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
 * - **Type:** `UpdateDockerComposeRequest`
 *
 * Request parameters containing CVM ID, docker_compose_file content, and optional compose_hash/transaction_hash.
 *
 * ### parameters (optional)
 * - **Type:** `UpdateDockerComposeParameters`
 *
 * Optional behavior parameters for schema validation.
 *
 * ```typescript
 * // Use default schema
 * const result = await updateDockerCompose(client, {
 *   id: 'cvm-123',
 *   docker_compose_file: composeYaml
 * })
 *
 * // Return raw data without validation
 * const raw = await updateDockerCompose(client, request, { schema: false })
 *
 * // Use custom schema
 * const customSchema = z.object({ status: z.string() })
 * const custom = await updateDockerCompose(client, request, { schema: customSchema })
 * ```
 *
 * ## Safe Version
 *
 * Use `safeUpdateDockerCompose` for error handling without exceptions:
 *
 * ```typescript
 * import { safeUpdateDockerCompose } from '@phala/cloud'
 *
 * const result = await safeUpdateDockerCompose(client, {
 *   id: 'cvm-123',
 *   docker_compose_file: composeYaml
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

export const UpdateDockerComposeRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    docker_compose_file: z.string().describe("Docker Compose YAML content"),
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
      docker_compose_file: data.docker_compose_file,
      compose_hash: data.compose_hash,
      transaction_hash: data.transaction_hash,
    },
    _raw: data,
  };
});

// Response when update is successfully initiated (202)
const UpdateDockerComposeInProgressSchema = z.object({
  status: z.literal("in_progress"),
  message: z.string(),
  correlation_id: z.string(),
});

// Response when compose hash verification is required (465)
const UpdateDockerComposePreconditionRequiredSchema = z.object({
  status: z.literal("precondition_required"),
  message: z.string(),
  compose_hash: z.string(),
  app_id: z.string(),
  device_id: z.string(),
  kms_info: KmsInfoSchema,
});

// Union type for the result
export const UpdateDockerComposeResultSchema = z.union([
  UpdateDockerComposeInProgressSchema,
  UpdateDockerComposePreconditionRequiredSchema,
]);

export type UpdateDockerComposeRequest = z.input<typeof UpdateDockerComposeRequestSchema>;
export type UpdateDockerComposeResult = z.infer<typeof UpdateDockerComposeResultSchema>;
export type UpdateDockerComposeInProgress = z.infer<typeof UpdateDockerComposeInProgressSchema>;
export type UpdateDockerComposePreconditionRequired = z.infer<
  typeof UpdateDockerComposePreconditionRequiredSchema
>;

/**
 * Update CVM Docker Compose file
 *
 * @param client - The API client
 * @param request - Request parameters containing CVM ID and Docker Compose content
 * @param parameters - Optional behavior parameters
 * @returns Update result (either in_progress or precondition_required)
 */
const { action: updateDockerCompose, safeAction: safeUpdateDockerCompose } = defineAction<
  UpdateDockerComposeRequest,
  typeof UpdateDockerComposeResultSchema
>(UpdateDockerComposeResultSchema, async (client, request) => {
  const validatedRequest = UpdateDockerComposeRequestSchema.parse(request);

  // Prepare headers for compose_hash and transaction_hash
  const headers: Record<string, string> = {
    "Content-Type": "text/yaml",
  };

  if (validatedRequest.request.compose_hash) {
    headers["X-Compose-Hash"] = validatedRequest.request.compose_hash;
  }

  if (validatedRequest.request.transaction_hash) {
    headers["X-Transaction-Hash"] = validatedRequest.request.transaction_hash;
  }

  try {
    // Make the PATCH request with YAML body and headers
    const response = await client.patch<UpdateDockerComposeInProgress>(
      `/cvms/${validatedRequest.cvmId}/docker-compose`,
      validatedRequest.request.docker_compose_file,
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

export { updateDockerCompose, safeUpdateDockerCompose };
