import { z } from "zod";
import { type Client } from "../client";
import { defineSimpleAction } from "../utils/define-action";

/**
 * Get current user information and validate API token
 *
 * Returns information about the current authenticated user.
 *
 * @example
 * ```typescript
 * import { createClient, getCurrentUser } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 * const user = await getCurrentUser(client)
 * // Output: { username: 'alice', email: 'alice@example.com', credits: 1000, ... }
 * ```
 *
 * ## Returns
 *
 * `CurrentUser | unknown`
 *
 * Information about the current user. Return type depends on schema parameter.
 *
 * ## Parameters
 *
 * ### parameters (optional)
 * - **Type:** `GetCurrentUserParameters`
 *
 * Optional behavior parameters for schema validation.
 *
 * ```typescript
 * // Use default schema
 * const user = await getCurrentUser(client)
 *
 * // Return raw data without validation
 * const raw = await getCurrentUser(client, { schema: false })
 *
 * // Use custom schema
 * const customSchema = z.object({ id: z.number(), name: z.string() })
 * const custom = await getCurrentUser(client, { schema: customSchema })
 * ```
 *
 * ## Safe Version
 *
 * Use `safeGetCurrentUser` for error handling without exceptions:
 *
 * ```typescript
 * import { safeGetCurrentUser } from '@phala/cloud'
 *
 * const result = await safeGetCurrentUser(client)
 * if (result.success) {
 *   console.log(result.data.username)
 * } else {
 *   if ("isRequestError" in result.error) {
 *     console.error(`HTTP ${result.error.status}: ${result.error.message}`)
 *   } else {
 *     console.error(`Validation error: ${result.error.issues}`)
 *   }
 * }
 * ```
 */

export const CurrentUserSchema = z
  .object({
    username: z.string(),
    email: z.string(),
    credits: z.number(),
    granted_credits: z.number(),
    avatar: z.string(),
    team_name: z.string(),
    team_tier: z.string(),
  })
  .passthrough();

export type CurrentUser = z.infer<typeof CurrentUserSchema>;

const { action: getCurrentUser, safeAction: safeGetCurrentUser } = defineSimpleAction(
  CurrentUserSchema,
  async (client) => {
    return await client.get("/auth/me");
  },
);

export { getCurrentUser, safeGetCurrentUser };
