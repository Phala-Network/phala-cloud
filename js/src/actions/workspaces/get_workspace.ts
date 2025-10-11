import { z } from "zod";
import { type Client } from "../../client";
import { defineAction } from "../../utils/define-action";
import { WorkspaceResponseSchema, type WorkspaceResponse } from "./list_workspaces";

/**
 * Get specific workspace information by team slug
 *
 * Returns detailed information about a specific workspace.
 *
 * @example
 * ```typescript
 * import { createClient, getWorkspace } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 * const workspace = await getWorkspace(client, 'team-slug')
 * // Output: { id: '...', name: '...', slug: 'team-slug', ... }
 * ```
 *
 * ## Returns
 *
 * `WorkspaceResponse | unknown`
 *
 * Information about the workspace. Return type depends on schema parameter.
 *
 * ## Parameters
 *
 * ### teamSlug (required)
 * - **Type:** `string`
 *
 * The slug identifier of the workspace to retrieve.
 *
 * ### parameters (optional)
 * - **Type:** `GetWorkspaceParameters`
 *
 * Optional behavior parameters for schema validation.
 *
 * ```typescript
 * // Use default schema
 * const workspace = await getWorkspace(client, 'team-slug')
 *
 * // Return raw data without validation
 * const raw = await getWorkspace(client, 'team-slug', { schema: false })
 *
 * // Use custom schema
 * const customSchema = z.object({ id: z.string(), name: z.string() })
 * const custom = await getWorkspace(client, 'team-slug', { schema: customSchema })
 * ```
 *
 * ## Safe Version
 *
 * Use `safeGetWorkspace` for error handling without exceptions:
 *
 * ```typescript
 * import { safeGetWorkspace } from '@phala/cloud'
 *
 * const result = await safeGetWorkspace(client, 'team-slug')
 * if (result.success) {
 *   console.log(result.data.name)
 * } else {
 *   if ("isRequestError" in result.error) {
 *     console.error(`HTTP ${result.error.status}: ${result.error.message}`)
 *   } else {
 *     console.error(`Validation error: ${result.error.issues}`)
 *   }
 * }
 * ```
 */

const { action: getWorkspace, safeAction: safeGetWorkspace } = defineAction<
  string,
  typeof WorkspaceResponseSchema
>(WorkspaceResponseSchema, async (client, teamSlug) => {
  return await client.get(`/workspaces/${teamSlug}`);
});

export { getWorkspace, safeGetWorkspace };
