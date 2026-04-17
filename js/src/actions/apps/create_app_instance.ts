import { z } from "zod";
import { defineAction } from "../../utils/define-action";
import { VMSchema } from "../../types/cvm_info";

/**
 * Create a new instance under an existing app
 *
 * Deploy a new CVM instance under an existing app, optionally with a new
 * Docker Compose file. For on-chain KMS apps, this uses a two-phase flow:
 * the first request returns HTTP 465 with a commit token; after registering
 * the compose hash on-chain, the second request commits with the token and
 * transaction hash.
 *
 * @example
 * ```typescript
 * import { createClient, createAppInstance } from '@phala/cloud'
 *
 * const client = createClient();
 *
 * // Create instance with existing compose
 * const instance = await createAppInstance(client, {
 *   appId: '50b0e827cc6c53f4010b57e588a18c5ef9388cc1',
 *   node_id: 5,
 * });
 *
 * // Create instance with new Docker Compose
 * const instance2 = await createAppInstance(client, {
 *   appId: '50b0e827cc6c53f4010b57e588a18c5ef9388cc1',
 *   docker_compose_file: 'services:\n  app:\n    image: nginx',
 *   node_id: 5,
 * });
 * ```
 *
 * ## Safe Version
 *
 * Use `safeCreateAppInstance` for error handling without exceptions:
 *
 * ```typescript
 * const result = await safeCreateAppInstance(client, { appId: 'my-app-id' });
 * if (result.success) {
 *   console.log('Instance created:', result.data.vm_uuid);
 * } else {
 *   console.error('Failed:', result.error.message);
 * }
 * ```
 */

export const CreateAppInstanceRequestSchema = z
  .object({
    appId: z.string().min(1),
    node_id: z.number().optional(),
    docker_compose_file: z.string().optional(),
    pre_launch_script: z.string().optional(),
    encrypted_env: z.string().optional(),
    compose_hash: z.string().optional(),
    token: z.string().optional(),
    transaction_hash: z.string().optional(),
  })
  .strict();

export type CreateAppInstanceRequest = z.infer<typeof CreateAppInstanceRequestSchema>;

const { action: createAppInstance, safeAction: safeCreateAppInstance } = defineAction<
  CreateAppInstanceRequest,
  typeof VMSchema
>(VMSchema, async (client, request) => {
  const parsed = CreateAppInstanceRequestSchema.parse(request);
  const { appId, ...body } = parsed;
  return await client.post(`/apps/${appId}/instances`, body);
});

export { createAppInstance, safeCreateAppInstance };
