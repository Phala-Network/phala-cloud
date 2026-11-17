import { z } from "zod";
import { defineAction } from "../../utils/define-action";
import { AppIdSchema, DomainPortSchema } from "./schemas";

export const MergeAppDomainIngressRequestSchema = z
  .object({
    appId: AppIdSchema,
    domain: z.string().min(1),
    port: DomainPortSchema,
    dns_provider: z.string().min(1).optional(),
    include_certbot_email: z.boolean().optional(),
    /** Merge into this compose text instead of the app's stored compose. */
    docker_compose_file: z.string().optional(),
  })
  .strict();

export type MergeAppDomainIngressRequest = z.infer<typeof MergeAppDomainIngressRequestSchema>;

export const MergeAppDomainIngressResponseSchema = z.object({
  docker_compose_file: z.string(),
  already_configured: z.boolean(),
  required_env_keys: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  ingress_service_name: z.string().nullable().optional(),
  ingress_service: z.record(z.string(), z.unknown()).nullable().optional(),
  top_level_volumes: z.record(z.string(), z.unknown()).default({}),
});

export type MergeAppDomainIngressResponse = z.infer<typeof MergeAppDomainIngressResponseSchema>;

/**
 * Compute the dstack-ingress sidecar a compose file needs to serve a domain
 *
 * Without `docker_compose_file` the server merges into the app's stored
 * compose. The app must exist and be routable, because it supplies the gateway
 * domain.
 *
 * @example
 * ```typescript
 * const merge = await mergeAppDomainIngress(client, {
 *   appId,
 *   domain: 'app.example.com',
 *   port: 443,
 *   docker_compose_file: composeText,
 * })
 * if (!merge.already_configured) {
 *   console.log(merge.ingress_service_name, merge.required_env_keys)
 * }
 * ```
 *
 * ## Safe Version
 *
 * Use `safeMergeAppDomainIngress` to get a `SafeResult` instead of an exception.
 */
const { action: mergeAppDomainIngress, safeAction: safeMergeAppDomainIngress } = defineAction<
  MergeAppDomainIngressRequest,
  typeof MergeAppDomainIngressResponseSchema
>(MergeAppDomainIngressResponseSchema, async (client, request) => {
  const { appId, ...body } = MergeAppDomainIngressRequestSchema.parse(request);
  return await client.post(`/apps/${appId}/domains/ingress-merge`, body);
});

export { mergeAppDomainIngress, safeMergeAppDomainIngress };
