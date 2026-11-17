import { z } from "zod";
import { defineAction } from "../../utils/define-action";
import { AppDomainSchema, AppIdSchema } from "./schemas";

export const ListAppDomainsRequestSchema = z.object({ appId: AppIdSchema }).strict();

export type ListAppDomainsRequest = z.infer<typeof ListAppDomainsRequestSchema>;

export const ListAppDomainsResponseSchema = z.object({
  items: z.array(AppDomainSchema),
});

export type ListAppDomainsResponse = z.infer<typeof ListAppDomainsResponseSchema>;

/**
 * List the custom domains bound to one app
 *
 * @example
 * ```typescript
 * const { items } = await listAppDomains(client, { appId: '50b0e827cc6c53f4010b57e588a18c5ef9388cc1' })
 * ```
 *
 * ## Safe Version
 *
 * Use `safeListAppDomains` to get a `SafeResult` instead of an exception.
 */
const { action: listAppDomains, safeAction: safeListAppDomains } = defineAction<
  ListAppDomainsRequest,
  typeof ListAppDomainsResponseSchema
>(ListAppDomainsResponseSchema, async (client, request) => {
  const { appId } = ListAppDomainsRequestSchema.parse(request);
  return await client.get(`/apps/${appId}/domains`);
});

export { listAppDomains, safeListAppDomains };
