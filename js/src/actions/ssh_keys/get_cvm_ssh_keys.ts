import { z } from "zod";
import { type CvmIdInput, CvmIdSchema } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";

export const CvmSshKeySchema = z.object({
  id: z.string(),
  owner_user_id: z.string(),
  owner_username: z.string(),
  added_by_user_id: z.string(),
  name: z.string(),
  public_key: z.string(),
  fingerprint: z.string(),
  key_type: z.string(),
});

export type CvmSshKey = z.infer<typeof CvmSshKeySchema>;

export const CvmSshKeysResponseSchema = z.object({
  keys: z.array(CvmSshKeySchema),
  restart_required: z.boolean(),
});

export type CvmSshKeysResponse = z.infer<typeof CvmSshKeysResponseSchema>;

export const GetCvmSshKeysRequestSchema = CvmIdSchema;

export type GetCvmSshKeysRequest = CvmIdInput;

/**
 * List the SSH keys a CVM is configured to authorize.
 *
 * This is the stored set. It reaches the guest at the next power-on; read
 * `getCvmUserConfig` for what the running VM actually has.
 *
 * @example
 * ```typescript
 * import { createClient, getCvmSshKeys } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 * const result = await getCvmSshKeys(client, { id: 'app_123' })
 * for (const key of result.keys) {
 *   console.log(key.owner_username, key.fingerprint)
 * }
 * ```
 *
 * ## Safe Version
 *
 * ```typescript
 * const result = await safeGetCvmSshKeys(client, { id: 'app_123' })
 * if (result.success) {
 *   console.log(result.data.restart_required)
 * } else {
 *   console.error(result.error.message)
 * }
 * ```
 */
const { action: getCvmSshKeys, safeAction: safeGetCvmSshKeys } = defineAction<
  GetCvmSshKeysRequest,
  typeof CvmSshKeysResponseSchema
>(CvmSshKeysResponseSchema, async (client, request) => {
  const { cvmId } = GetCvmSshKeysRequestSchema.parse(request);
  return await client.get(`/cvms/${cvmId}/ssh-keys`);
});

export { getCvmSshKeys, safeGetCvmSshKeys };
