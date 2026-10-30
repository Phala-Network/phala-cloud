import { z } from "zod";
import { type Client } from "../../client";
import { NodeRefSchema as ImportedNodeRefSchema } from "../../types/cvm_info_v20260121";
import { defineAction } from "../../utils/define-action";
import { PaginationMetadataSchema } from "./list_workspaces";

/**
 * List nodes accessible by a workspace
 *
 * Returns paginated list of nodes that the workspace can use for deploying CVMs.
 * Nodes are ordered by availability (reserved nodes first, then public nodes by resource score).
 *
 * @example
 * ```typescript
 * import { createClient, getWorkspaceNodes } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 * const nodes = await getWorkspaceNodes(client, { teamSlug: 'team-slug' })
 * // Output: { items: [{ id: 1, name: 'node-1', status: 'ONLINE', ... }], total: 10, page: 1, ... }
 * ```
 *
 * ## Returns
 *
 * `GetWorkspaceNodes | unknown`
 *
 * List of available nodes with pagination metadata. Return type depends on schema parameter.
 *
 * ## Parameters
 *
 * ### request (required)
 * - **Type:** `GetWorkspaceNodesRequest`
 *
 * Request parameters including workspace identifier and optional pagination.
 *
 * ```typescript
 * // Use default schema
 * const nodes = await getWorkspaceNodes(client, { teamSlug: 'team-slug' })
 *
 * // With pagination
 * const page = await getWorkspaceNodes(client, {
 *   teamSlug: 'team-slug',
 *   page: 2,
 *   pageSize: 20
 * })
 *
 * // Return raw data without validation
 * const raw = await getWorkspaceNodes(client, { teamSlug: 'team-slug' }, { schema: false })
 * ```
 *
 * ## Safe Version
 *
 * Use `safeGetWorkspaceNodes` for error handling without exceptions:
 *
 * ```typescript
 * import { safeGetWorkspaceNodes } from '@phala/cloud'
 *
 * const result = await safeGetWorkspaceNodes(client, { teamSlug: 'team-slug' })
 * if (result.success) {
 *   console.log(result.data.items[0].name)
 *   console.log(`Total: ${result.data.total}`)
 * } else {
 *   if ("isRequestError" in result.error) {
 *     console.error(`HTTP ${result.error.status}: ${result.error.message}`)
 *   } else {
 *     console.error(`Validation error: ${result.error.issues}`)
 *   }
 * }
 * ```
 */

// Re-export NodeRefSchema from types
export const NodeRefSchema = ImportedNodeRefSchema;

// Deprecated: Use NodeRefSchema instead
export const NodeInfoSchema = NodeRefSchema;

export const GetWorkspaceNodesSchema = z
  .object({
    items: z.array(NodeRefSchema.extend({ node: z.string() })),
    total: z.number(),
    page: z.number(),
    page_size: z.number(),
    pages: z.number(),
  })
  .passthrough();

export type NodeRef = z.infer<typeof NodeRefSchema>;
// Deprecated: Use NodeRef instead
export type NodeInfo = NodeRef;
export type GetWorkspaceNodes = z.infer<typeof GetWorkspaceNodesSchema>;

export type GetWorkspaceNodesRequest = {
  teamSlug: string;
  page?: number;
  pageSize?: number;
};

const { action: getWorkspaceNodes, safeAction: safeGetWorkspaceNodes } = defineAction<
  GetWorkspaceNodesRequest,
  typeof GetWorkspaceNodesSchema
>(GetWorkspaceNodesSchema, async (client, request) => {
  const { teamSlug, page, pageSize } = request;
  const queryParams = new URLSearchParams();
  if (page !== undefined) queryParams.append("page", page.toString());
  if (pageSize !== undefined) queryParams.append("page_size", pageSize.toString());

  const url = queryParams.toString()
    ? `/workspaces/${teamSlug}/nodes?${queryParams.toString()}`
    : `/workspaces/${teamSlug}/nodes`;

  return await client.get(url);
});

export { getWorkspaceNodes, safeGetWorkspaceNodes };
