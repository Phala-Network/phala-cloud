import { z } from "zod";
import { CvmIdObjectSchema, CvmIdSchema, refineCvmId } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";
import { CvmSshKeysResponseSchema } from "./get_cvm_ssh_keys";

export const UpdateCvmSshKeysRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    ssh_key_ids: z.array(z.string()),
    usernames: z.array(z.string()).optional(),
    apply_now: z.boolean().optional(),
  }),
);

export type UpdateCvmSshKeysRequest = z.input<typeof UpdateCvmSshKeysRequestSchema>;

/**
 * Replace the SSH keys a CVM authorizes.
 *
 * `ssh_key_ids` is the replacement set. Optional `usernames` are resolved
 * server-side to that member's keys and unioned into the set. Keys take
 * effect at the next power-on, or immediately when `apply_now` restarts the CVM.
 *
 * @example
 * ```typescript
 * import { createClient, updateCvmSshKeys } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 * const result = await updateCvmSshKeys(client, {
 *   id: 'app_123',
 *   ssh_key_ids: ['sshkey_abc'],
 *   usernames: ['alice'],
 *   apply_now: false,
 * })
 * ```
 *
 * ## Safe Version
 *
 * ```typescript
 * const result = await safeUpdateCvmSshKeys(client, {
 *   id: 'app_123',
 *   ssh_key_ids: ['sshkey_abc'],
 * })
 * if (!result.success) {
 *   console.error(result.error.message)
 * }
 * ```
 */
const { action: updateCvmSshKeys, safeAction: safeUpdateCvmSshKeys } = defineAction<
  UpdateCvmSshKeysRequest,
  typeof CvmSshKeysResponseSchema
>(CvmSshKeysResponseSchema, async (client, request) => {
  const parsed = UpdateCvmSshKeysRequestSchema.parse(request);
  const { cvmId } = CvmIdSchema.parse(parsed);
  return await client.put(`/cvms/${cvmId}/ssh-keys`, {
    ssh_key_ids: parsed.ssh_key_ids,
    ...(parsed.usernames !== undefined ? { usernames: parsed.usernames } : {}),
    apply_now: parsed.apply_now ?? false,
  });
});

export { updateCvmSshKeys, safeUpdateCvmSshKeys };
