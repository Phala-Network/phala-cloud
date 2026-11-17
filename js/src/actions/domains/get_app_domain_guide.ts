import { z } from "zod";
import { defineAction } from "../../utils/define-action";
import { AppIdSchema } from "./schemas";

export const GetAppDomainGuideRequestSchema = z.object({ appId: AppIdSchema }).strict();

export type GetAppDomainGuideRequest = z.infer<typeof GetAppDomainGuideRequestSchema>;

export const AppDomainGuideSchema = z.object({
  /** Gateway suffix; the CNAME target of a custom domain is `gateway.<suffix>`. */
  gateway_domain_suffix: z.string(),
  app_id: z.string(),
  /** Whether the app needs a TXT record in addition to the CNAME. */
  txt_required: z.boolean(),
  ingress_configured: z.boolean(),
});

export type AppDomainGuide = z.infer<typeof AppDomainGuideSchema>;

/**
 * Get the DNS guide for pointing a custom domain at an app
 *
 * The server answers 422 while the app's route cannot be determined yet.
 *
 * @example
 * ```typescript
 * const guide = await getAppDomainGuide(client, { appId })
 * console.log(`CNAME target: gateway.${guide.gateway_domain_suffix}`)
 * ```
 *
 * ## Safe Version
 *
 * Use `safeGetAppDomainGuide` to get a `SafeResult` instead of an exception.
 */
const { action: getAppDomainGuide, safeAction: safeGetAppDomainGuide } = defineAction<
  GetAppDomainGuideRequest,
  typeof AppDomainGuideSchema
>(AppDomainGuideSchema, async (client, request) => {
  const { appId } = GetAppDomainGuideRequestSchema.parse(request);
  return await client.get(`/apps/${appId}/domains/guide`);
});

export { getAppDomainGuide, safeGetAppDomainGuide };
