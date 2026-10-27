import { z } from "zod";
import type { Client, SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";

export const SshKeySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  public_key: z.string(),
  fingerprint: z.string(),
  key_type: z.string(),
  source: z.string(),
  key_metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  last_synced_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type SshKey = z.infer<typeof SshKeySchema>;

export const ListSshKeysResponseSchema = z.array(SshKeySchema);

export type ListSshKeysResponse = z.infer<typeof ListSshKeysResponseSchema>;

/**
 * List SSH keys for the current user
 *
 * Returns all active (non-revoked) SSH keys belonging to the authenticated user,
 * ordered by creation date descending.
 *
 * @example
 * ```typescript
 * import { createClient, listSshKeys } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 * const keys = await listSshKeys(client)
 * for (const key of keys) {
 *   console.log(key.name, key.key_type, key.fingerprint)
 * }
 * ```
 */
export async function listSshKeys(client: Client<ApiVersion>): Promise<ListSshKeysResponse> {
  const response = await client.get("/user/ssh-keys");
  return ListSshKeysResponseSchema.parse(response);
}

/**
 * Safe version of listSshKeys that returns a SafeResult instead of throwing
 */
export async function safeListSshKeys(
  client: Client<ApiVersion>,
): Promise<SafeResult<ListSshKeysResponse>> {
  try {
    const data = await listSshKeys(client);
    return { success: true, data };
  } catch (error) {
    if (error && typeof error === "object" && ("status" in error || "issues" in error)) {
      return { success: false, error } as SafeResult<ListSshKeysResponse>;
    }
    return {
      success: false,
      error: {
        name: "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    } as SafeResult<ListSshKeysResponse>;
  }
}
