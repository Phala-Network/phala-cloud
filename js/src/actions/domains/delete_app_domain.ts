import { z } from "zod";
import { defineAction } from "../../utils/define-action";
import { AppDomainSchema, AppIdSchema, DomainIdSchema, DomainSyncSchema } from "./schemas";

export const DeleteAppDomainRequestSchema = z
  .object({
    appId: AppIdSchema,
    domainId: DomainIdSchema,
  })
  .strict();

export type DeleteAppDomainRequest = z.infer<typeof DeleteAppDomainRequestSchema>;

export const DeleteAppDomainResponseSchema = AppDomainSchema.extend({
  sync: DomainSyncSchema,
});

export type DeleteAppDomainResponse = z.infer<typeof DeleteAppDomainResponseSchema>;

/**
 * Unbind a custom domain from an app
 *
 * @example
 * ```typescript
 * await deleteAppDomain(client, { appId, domainId })
 * ```
 *
 * ## Safe Version
 *
 * Use `safeDeleteAppDomain` to get a `SafeResult` instead of an exception.
 */
const { action: deleteAppDomain, safeAction: safeDeleteAppDomain } = defineAction<
  DeleteAppDomainRequest,
  typeof DeleteAppDomainResponseSchema
>(DeleteAppDomainResponseSchema, async (client, request) => {
  const { appId, domainId } = DeleteAppDomainRequestSchema.parse(request);
  return await client.delete(`/apps/${appId}/domains/${domainId}`);
});

export { deleteAppDomain, safeDeleteAppDomain };
