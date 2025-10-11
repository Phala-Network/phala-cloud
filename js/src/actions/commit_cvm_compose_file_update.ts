import { z } from "zod";
import { type Client } from "../client";
import { defineAction } from "../utils/define-action";

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
 * `void | unknown`
 *
 * No response body (HTTP 202 Accepted). The update is processed asynchronously. Return type depends on schema parameter.
 *
 * ## Parameters
 *
 * ### request (required)
 * - **Type:** `CommitCvmComposeFileUpdateRequestData`
 *
 * Request parameters containing the CVM ID and commit request data.
 *
 * ### parameters (optional)
 * - **Type:** `CommitCvmComposeFileUpdateParameters`
 *
 * Optional behavior parameters for schema validation.
 *
 * ```typescript
 * // Use default schema (void response)
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
    encrypted_env: z.string().optional(),
    env_keys: z.array(z.string()).optional(),
    update_env_vars: z.boolean().optional().nullable(),
  })
  .refine(
    (data) => !!(data.id || data.uuid || data.app_id || data.instance_id),
    "One of id, uuid, app_id, or instance_id must be provided",
  )
  .transform((data) => ({
    cvmId: data.id || data.uuid || data.app_id || data.instance_id,
    compose_hash: data.compose_hash,
    encrypted_env: data.encrypted_env,
    env_keys: data.env_keys,
    update_env_vars: !!data.update_env_vars,
    _raw: data,
  }));

export const CommitCvmComposeFileUpdateSchema = z.any().transform(() => undefined);

export type CommitCvmComposeFileUpdateRequest = Omit<
  z.infer<typeof CommitCvmComposeFileUpdateRequestSchema>,
  "cvmId" | "_raw" | "update_env_vars"
> & {
  id?: string;
  uuid?: string;
  app_id?: string;
  instance_id?: string;
  update_env_vars?: boolean | null;
};
export type CommitCvmComposeFileUpdate = undefined;

const { action: commitCvmComposeFileUpdate, safeAction: safeCommitCvmComposeFileUpdate } =
  defineAction<CommitCvmComposeFileUpdateRequest, typeof CommitCvmComposeFileUpdateSchema>(
    CommitCvmComposeFileUpdateSchema,
    async (client, request) => {
      const validatedRequest = CommitCvmComposeFileUpdateRequestSchema.parse(request);

      return await client.patch(`/cvms/${validatedRequest.cvmId}/compose_file`, {
        compose_hash: validatedRequest.compose_hash,
        encrypted_env: validatedRequest.encrypted_env,
        env_keys: validatedRequest.env_keys,
      });
    },
  );

export { commitCvmComposeFileUpdate, safeCommitCvmComposeFileUpdate };
