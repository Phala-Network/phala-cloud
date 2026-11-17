import { z } from "zod";
import { defineAction } from "../../utils/define-action";
import { AppDomainSchema, AppIdSchema, DomainPortSchema, DomainSyncSchema } from "./schemas";

export const CreateAppDomainRequestSchema = z
  .object({
    appId: AppIdSchema,
    domain: z.string().min(1),
    port: DomainPortSchema,
    turnstile_token: z.string().optional(),
  })
  .strict();

export type CreateAppDomainRequest = z.infer<typeof CreateAppDomainRequestSchema>;

export const CreateAppDomainResponseSchema = AppDomainSchema.extend({
  sync: DomainSyncSchema,
});

export type CreateAppDomainResponse = z.infer<typeof CreateAppDomainResponseSchema>;

/**
 * Bind a custom domain to an app
 *
 * Fails with 409 when the domain is registered elsewhere and with 422 when the
 * app cannot take a domain yet. Shares a per-user throttle with
 * `preflightAppDomain` and `verifyAppDomain`.
 *
 * @example
 * ```typescript
 * const domain = await createAppDomain(client, { appId, domain: 'app.example.com', port: 443 })
 * console.log(domain.expected_records)
 * ```
 *
 * ## Safe Version
 *
 * Use `safeCreateAppDomain` to get a `SafeResult` instead of an exception.
 */
const { action: createAppDomain, safeAction: safeCreateAppDomain } = defineAction<
  CreateAppDomainRequest,
  typeof CreateAppDomainResponseSchema
>(CreateAppDomainResponseSchema, async (client, request) => {
  const { appId, ...body } = CreateAppDomainRequestSchema.parse(request);
  return await client.post(`/apps/${appId}/domains`, body);
});

export { createAppDomain, safeCreateAppDomain };
