import { z } from "zod";
import { defineSimpleAction } from "../../utils/define-action";

/**
 * Revoke the API token used to authenticate this client
 *
 * Permanently revokes the token presented in the request (self-revoke).
 * The target token is resolved server-side from the presented credential —
 * one token can never revoke another. This operation cannot be undone:
 * the client's API key stops working immediately.
 *
 * @example
 * ```typescript
 * import { createClient, revokeCurrentApiToken } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 * await revokeCurrentApiToken(client)
 * console.log('Token revoked')
 * ```
 *
 * ## Safe Version
 *
 * ```typescript
 * const result = await safeRevokeCurrentApiToken(client)
 * if (result.success) {
 *   console.log('Token revoked')
 * } else {
 *   console.error(result.error.message)
 * }
 * ```
 */
const { action: revokeCurrentApiToken, safeAction: safeRevokeCurrentApiToken } = defineSimpleAction(
  z.void(),
  async (client) => {
    await client.delete("/tokens/self");
    return undefined;
  },
);

export { revokeCurrentApiToken, safeRevokeCurrentApiToken };
