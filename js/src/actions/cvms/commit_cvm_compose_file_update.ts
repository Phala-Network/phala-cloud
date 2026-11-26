import { z } from "zod";
import { type Client } from "../../client";
import {
  ConfirmFinalityReplacementSchema,
  CvmFinalityWaitAcceptedSchema,
  finalityReplacementHeaders,
} from "../../types/cvm_finality";
import { defineAction } from "../../utils/define-action";

/**
 * Commit CVM compose file update
 *
 * Finalizes a CVM compose file update by committing the previously provisioned changes.
 * This should be called after `provisionCvmComposeFileUpdate` to complete the update process.
 *
 * @example
 * ```typescript
 * import { createClient, commitCvmComposeFileUpdate } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 * await commitCvmComposeFileUpdate(client, {
 *   cvmId: 'cvm-123',
 *   request: {
 *     compose_hash: 'abc123...'
 *   }
 * })
 * // Request accepted, update will be processed asynchronously
 * ```
 *
 * ## Returns
 *
 * The update is processed asynchronously. If the response includes a correlation ID,
 * the SDK returns the acknowledgment, including any usable `finality_wait` data.
 * Older servers may return no body; the default return value in that case is `undefined`.
 *
 * ## Parameters
 *
 * ### request (required)
 * - **Type:** `CommitCvmComposeFileUpdateRequest`
 *
 * Provide the CVM ID, the provisioned compose hash, and the registration transaction
 * hash if the update requires an on-chain registration.
 *
 * ### parameters (optional)
 * - **Type:** `CommitCvmComposeFileUpdateParameters`
 *
 * Optional behavior parameters for schema validation.
 *
 * ```typescript
 * // Use the default response schema
 * await commitCvmComposeFileUpdate(client, { cvmId: 'cvm-123', request: commitRequest })
 *
 * // Return raw data without validation
 * const raw = await commitCvmComposeFileUpdate(client, { cvmId: 'cvm-123', request: commitRequest }, { schema: false })
 *
 * // Use custom schema
 * const customSchema = z.object({ status: z.string() })
 * const custom = await commitCvmComposeFileUpdate(client, { cvmId: 'cvm-123', request: commitRequest }, { schema: customSchema })
 * ```
 *
 * ## Safe Version
 *
 * Use `safeCommitCvmComposeFileUpdate` for error handling without exceptions:
 *
 * ```typescript
 * import { safeCommitCvmComposeFileUpdate } from '@phala/cloud'
 *
 * const result = await safeCommitCvmComposeFileUpdate(client, { cvmId: 'cvm-123', request: commitRequest })
 * if (result.success) {
 *   console.log('Compose file update committed successfully')
 * } else {
 *   if ("isRequestError" in result.error) {
 *     console.error(`HTTP ${result.error.status}: ${result.error.message}`)
 *   } else {
 *     console.error(`Validation error: ${result.error.issues}`)
 *   }
 * }
 * ```
 */

export const CommitCvmComposeFileUpdateRequestSchema = z
  .object({
    id: z.string().optional(),
    uuid: z
      .string()
      .regex(/^[0-9a-f]{8}[-]?[0-9a-f]{4}[-]?4[0-9a-f]{3}[-]?[89ab][0-9a-f]{3}[-]?[0-9a-f]{12}$/i)
      .optional(),
    app_id: z
      .string()
      .refine(
        (val) => !val.startsWith("app_") && val.length === 40,
        "app_id should be 40 characters without prefix",
      )
      .transform((val) => (val.startsWith("app_") ? val : `app_${val}`))
      .optional(),
    instance_id: z
      .string()
      .refine(
        (val) => !val.startsWith("instance_") && val.length === 40,
        "instance_id should be 40 characters without prefix",
      )
      .transform((val) => (val.startsWith("instance_") ? val : `instance_${val}`))
      .optional(),
    compose_hash: z.string().min(1, "Compose hash is required"),
    transaction_hash: z.string().optional(),
    encrypted_env: z.string().optional(),
    env_keys: z.array(z.string()).optional(),
    update_env_vars: z.boolean().optional().nullable(),
    confirmFinalityReplacement: ConfirmFinalityReplacementSchema,
  })
  .refine(
    (data) => !!(data.id || data.uuid || data.app_id || data.instance_id),
    "One of id, uuid, app_id, or instance_id must be provided",
  )
  .transform((data) => ({
    cvmId: data.id || data.uuid || data.app_id || data.instance_id,
    compose_hash: data.compose_hash,
    transaction_hash: data.transaction_hash,
    encrypted_env: data.encrypted_env,
    env_keys: data.env_keys,
    update_env_vars: data.update_env_vars ?? undefined,
    confirmFinalityReplacement: data.confirmFinalityReplacement,
    _raw: data,
  }));

export const CommitCvmComposeFileUpdateSchema = z.unknown().transform((value) => {
  const accepted = CvmFinalityWaitAcceptedSchema.safeParse(value);
  return accepted.success && accepted.data.correlation_id.trim() ? accepted.data : undefined;
});

export type CommitCvmComposeFileUpdateRequest = z.input<typeof CommitCvmComposeFileUpdateRequestSchema>;
export type CommitCvmComposeFileUpdate = z.infer<typeof CommitCvmComposeFileUpdateSchema>;

const { action: commitCvmComposeFileUpdate, safeAction: safeCommitCvmComposeFileUpdate } =
  defineAction<CommitCvmComposeFileUpdateRequest, typeof CommitCvmComposeFileUpdateSchema>(
    CommitCvmComposeFileUpdateSchema,
    async (client, request) => {
      const validatedRequest = CommitCvmComposeFileUpdateRequestSchema.parse(request);

      return await client.patch(
        `/cvms/${validatedRequest.cvmId}/compose_file`,
        {
          compose_hash: validatedRequest.compose_hash,
          ...(validatedRequest.transaction_hash === undefined
            ? {}
            : { transaction_hash: validatedRequest.transaction_hash }),
          encrypted_env: validatedRequest.encrypted_env,
          env_keys: validatedRequest.env_keys,
          update_env_vars: validatedRequest.update_env_vars,
        },
        { headers: finalityReplacementHeaders(validatedRequest.confirmFinalityReplacement) },
      );
    },
  );

export { commitCvmComposeFileUpdate, safeCommitCvmComposeFileUpdate };
