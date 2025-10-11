import { z } from "zod";
import { type Client } from "../../client";
import { defineAction } from "../../utils/define-action";

/**
 * List workspaces accessible by the current user
 *
 * Returns a paginated list of workspaces with their basic information.
 *
 * @example
 * ```typescript
 * import { createClient, listWorkspaces } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 * const workspaces = await listWorkspaces(client)
 * // Output: { data: [{ id: '...', name: '...', ... }], pagination: { ... } }
 * ```
 *
 * ## Returns
 *
 * `ListWorkspaces | unknown`
 *
 * Information about accessible workspaces. Return type depends on schema parameter.
 *
 * ## Parameters
 *
 * ### parameters (optional)
 * - **Type:** `ListWorkspacesParameters`
 *
 * Optional behavior parameters for schema validation and pagination.
 *
 * ```typescript
 * // Use default schema
 * const workspaces = await listWorkspaces(client)
 *
 * // Return raw data without validation
 * const raw = await listWorkspaces(client, { schema: false })
 *
 * // Use custom schema
 * const customSchema = z.object({ data: z.array(z.object({ id: z.string() })) })
 * const custom = await listWorkspaces(client, { schema: customSchema })
 *
 * // With pagination
 * const page = await listWorkspaces(client, { limit: 20, cursor: 'next-page-cursor' })
 * ```
 *
 * ## Safe Version
 *
 * Use `safeListWorkspaces` for error handling without exceptions:
 *
 * ```typescript
 * import { safeListWorkspaces } from '@phala/cloud'
 *
 * const result = await safeListWorkspaces(client)
 * if (result.success) {
 *   console.log(result.data.data[0].name)
 * } else {
 *   if ("isRequestError" in result.error) {
 *     console.error(`HTTP ${result.error.status}: ${result.error.message}`)
 *   } else {
 *     console.error(`Validation error: ${result.error.issues}`)
 *   }
 * }
 * ```
 */

export const WorkspaceResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string().nullable(),
    tier: z.string(),
    role: z.string(),
    created_at: z.string(),
  })
  .passthrough();

export const PaginationMetadataSchema = z
  .object({
    has_more: z.boolean(),
    next_cursor: z.string().nullable(),
    total: z.number().nullable(),
  })
  .passthrough();

export const ListWorkspacesSchema = z
  .object({
    data: z.array(WorkspaceResponseSchema),
    pagination: PaginationMetadataSchema,
  })
  .passthrough();

export type WorkspaceResponse = z.infer<typeof WorkspaceResponseSchema>;
export type PaginationMetadata = z.infer<typeof PaginationMetadataSchema>;
export type ListWorkspaces = z.infer<typeof ListWorkspacesSchema>;

export type ListWorkspacesRequest = {
  cursor?: string;
  limit?: number;
};

const { action: listWorkspaces, safeAction: safeListWorkspaces } = defineAction<
  ListWorkspacesRequest | undefined,
  typeof ListWorkspacesSchema
>(ListWorkspacesSchema, async (client, request) => {
  const queryParams = new URLSearchParams();
  if (request?.cursor) queryParams.append("cursor", request.cursor);
  if (request?.limit) queryParams.append("limit", request.limit.toString());

  const url = queryParams.toString() ? `/workspaces?${queryParams.toString()}` : "/workspaces";

  return await client.get(url);
});

export { listWorkspaces, safeListWorkspaces };
