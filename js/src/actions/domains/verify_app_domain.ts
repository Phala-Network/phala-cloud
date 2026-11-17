import { z } from "zod";
import { defineAction } from "../../utils/define-action";
import { AppDomainSchema, AppIdSchema, DnsRecordCheckSchema, DomainIdSchema } from "./schemas";

export const VerifyAppDomainRequestSchema = z
  .object({
    appId: AppIdSchema,
    domainId: DomainIdSchema,
    turnstile_token: z.string().optional(),
  })
  .strict();

export type VerifyAppDomainRequest = z.infer<typeof VerifyAppDomainRequestSchema>;

export const VerifyAppDomainResponseSchema = AppDomainSchema.extend({
  records: z.array(DnsRecordCheckSchema),
});

export type VerifyAppDomainResponse = z.infer<typeof VerifyAppDomainResponseSchema>;

/**
 * Re-check the DNS records of a bound domain
 *
 * Shares a per-user throttle with `preflightAppDomain` and `createAppDomain`.
 *
 * @example
 * ```typescript
 * const result = await verifyAppDomain(client, { appId, domainId })
 * console.log(result.dns_verified_at)
 * ```
 *
 * ## Safe Version
 *
 * Use `safeVerifyAppDomain` to get a `SafeResult` instead of an exception.
 */
const { action: verifyAppDomain, safeAction: safeVerifyAppDomain } = defineAction<
  VerifyAppDomainRequest,
  typeof VerifyAppDomainResponseSchema
>(VerifyAppDomainResponseSchema, async (client, request) => {
  const { appId, domainId, ...body } = VerifyAppDomainRequestSchema.parse(request);
  return await client.post(`/apps/${appId}/domains/${domainId}/verify`, body);
});

export { verifyAppDomain, safeVerifyAppDomain };
