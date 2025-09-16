import { z } from "zod";
import { type Client, type SafeResult } from "../../client";
import { ActionParameters, ActionReturnType } from "../../types/common";
import { validateActionParameters, safeValidateActionParameters } from "../../utils";

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

export type ListWorkspacesParameters<T = undefined> = ActionParameters<T> & {
  cursor?: string;
  limit?: number;
};

export type ListWorkspacesReturnType<T = undefined> = ActionReturnType<ListWorkspaces, T>;

export async function listWorkspaces<T extends z.ZodSchema | false | undefined = undefined>(
  client: Client,
  parameters?: ListWorkspacesParameters<T>,
): Promise<ListWorkspacesReturnType<T>> {
  validateActionParameters(parameters);

  const queryParams = new URLSearchParams();
  if (parameters?.cursor) queryParams.append("cursor", parameters.cursor);
  if (parameters?.limit) queryParams.append("limit", parameters.limit.toString());

  const url = queryParams.toString() ? `/workspaces?${queryParams.toString()}` : "/workspaces";

  const response = await client.get(url);

  if (parameters?.schema === false) {
    return response as ListWorkspacesReturnType<T>;
  }

  const schema = (parameters?.schema || ListWorkspacesSchema) as z.ZodSchema;
  return schema.parse(response) as ListWorkspacesReturnType<T>;
}

export async function safeListWorkspaces<T extends z.ZodSchema | false | undefined = undefined>(
  client: Client,
  parameters?: ListWorkspacesParameters<T>,
): Promise<SafeResult<ListWorkspacesReturnType<T>>> {
  const parameterValidationError = safeValidateActionParameters(parameters);
  if (parameterValidationError) {
    return parameterValidationError as SafeResult<ListWorkspacesReturnType<T>>;
  }

  const queryParams = new URLSearchParams();
  if (parameters?.cursor) queryParams.append("cursor", parameters.cursor);
  if (parameters?.limit) queryParams.append("limit", parameters.limit.toString());

  const url = queryParams.toString() ? `/workspaces?${queryParams.toString()}` : "/workspaces";

  const httpResult = await client.safeGet(url);
  if (!httpResult.success) {
    return httpResult as SafeResult<ListWorkspacesReturnType<T>>;
  }

  if (parameters?.schema === false) {
    return { success: true, data: httpResult.data } as SafeResult<ListWorkspacesReturnType<T>>;
  }

  const schema = (parameters?.schema || ListWorkspacesSchema) as z.ZodSchema;
  return schema.safeParse(httpResult.data) as SafeResult<ListWorkspacesReturnType<T>>;
}
