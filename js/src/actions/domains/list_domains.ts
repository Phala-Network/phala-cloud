import { z } from "zod";
import { defineAction } from "../../utils/define-action";
import { WorkspaceDomainSchema } from "./schemas";

export const ListDomainsRequestSchema = z
  .object({
    page: z.number().int().min(1).optional(),
    page_size: z.number().int().min(1).max(100).optional(),
    app_id: z.string().min(1).optional(),
    /** Exact match on the domain name. */
    domain: z.string().min(1).optional(),
  })
  .strict();

export type ListDomainsRequest = z.infer<typeof ListDomainsRequestSchema>;

export const ListDomainsResponseSchema = z.object({
  items: z.array(WorkspaceDomainSchema),
  page: z.number().int(),
  page_size: z.number().int(),
  total: z.number().int(),
  total_pages: z.number().int(),
});

export type ListDomainsResponse = z.infer<typeof ListDomainsResponseSchema>;

/**
 * List the custom domains of the current workspace
 *
 * Each item is one (domain, app) binding. Pass `domain` for an exact lookup
 * and `app_id` to narrow the list to one app.
 *
 * @example
 * ```typescript
 * import { createClient, listDomains } from '@phala/cloud'
 *
 * const client = createClient()
 * const { items } = await listDomains(client, { domain: 'app.example.com' })
 * ```
 *
 * ## Safe Version
 *
 * ```typescript
 * const result = await safeListDomains(client, { page: 1 })
 * if (result.success) {
 *   console.log(result.data.total)
 * }
 * ```
 */
const { action: listDomains, safeAction: safeListDomains } = defineAction<
  ListDomainsRequest | undefined,
  typeof ListDomainsResponseSchema
>(ListDomainsResponseSchema, async (client, request) => {
  const params = ListDomainsRequestSchema.parse(request ?? {});
  return await client.get("/domains", { params });
});

export { listDomains, safeListDomains };
