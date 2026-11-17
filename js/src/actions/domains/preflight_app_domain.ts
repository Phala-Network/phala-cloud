import { z } from "zod";
import { defineAction } from "../../utils/define-action";
import { AppIdSchema, DnsRecordCheckSchema, DomainPortSchema } from "./schemas";

export const PreflightAppDomainRequestSchema = z
  .object({
    appId: AppIdSchema,
    domain: z.string().min(1),
    port: DomainPortSchema,
    turnstile_token: z.string().optional(),
  })
  .strict();

export type PreflightAppDomainRequest = z.infer<typeof PreflightAppDomainRequestSchema>;

export const PreflightAppDomainResponseSchema = z.object({
  domain: z.string(),
  port: z.number().int(),
  is_valid: z.boolean(),
  records: z.array(DnsRecordCheckSchema),
});

export type PreflightAppDomainResponse = z.infer<typeof PreflightAppDomainResponseSchema>;

/**
 * Check a domain's DNS against what the app expects, without binding it
 *
 * Shares a per-user throttle with `createAppDomain` and `verifyAppDomain`; a
 * throttled request fails with HTTP 429.
 *
 * @example
 * ```typescript
 * const check = await preflightAppDomain(client, { appId, domain: 'app.example.com', port: 443 })
 * console.log(check.is_valid)
 * ```
 *
 * ## Safe Version
 *
 * Use `safePreflightAppDomain` to get a `SafeResult` instead of an exception.
 */
const { action: preflightAppDomain, safeAction: safePreflightAppDomain } = defineAction<
  PreflightAppDomainRequest,
  typeof PreflightAppDomainResponseSchema
>(PreflightAppDomainResponseSchema, async (client, request) => {
  const { appId, ...body } = PreflightAppDomainRequestSchema.parse(request);
  return await client.post(`/apps/${appId}/domains/preflight`, body);
});

export { preflightAppDomain, safePreflightAppDomain };
