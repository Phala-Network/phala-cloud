import { z } from "zod";
import type { Client, SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";
import { type VMForVersion, getVMSchemaForVersion } from "../../types/cvm_info";
import { placementRequest } from "../../utils/placement-request";

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
 *   node: 'usw5',
 * });
 *
 * // Create instance with new Docker Compose
 * const instance2 = await createAppInstance(client, {
 *   appId: '50b0e827cc6c53f4010b57e588a18c5ef9388cc1',
 *   docker_compose_file: 'services:\n  app:\n    image: nginx',
 *   node: 'usw5',
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

export const CreateAppInstanceRequestSchema = placementRequest(
  z
    .object({
      appId: z.string().min(1),
      name: z.string().optional(),
      node: z.string().min(1).optional(),
      docker_compose_file: z.string().optional(),
      pre_launch_script: z.string().optional(),
      encrypted_env: z.string().optional(),
      compose_hash: z.string().optional(),
      token: z.string().optional(),
      transaction_hash: z.string().optional(),
      os_image: z.string().optional(),
      kms_urls: z.array(z.string()).optional(),
      gateway_urls: z.array(z.string()).optional(),
    })
    .strict(),
);

export type CreateAppInstanceRequest = z.infer<typeof CreateAppInstanceRequestSchema>;

export function createAppInstance<V extends ApiVersion>(
  client: Client<V>,
  request: CreateAppInstanceRequest,
): Promise<VMForVersion<V>>;
export async function createAppInstance<V extends ApiVersion>(
  client: Client<V>,
  request: CreateAppInstanceRequest,
): Promise<VMForVersion<V>> {
  const parsed = CreateAppInstanceRequestSchema.parse(request);
  const { appId, ...body } = parsed;
  const response = await client.post(`/apps/${appId}/instances`, body);
  return getVMSchemaForVersion(client.config.version).parse(response) as VMForVersion<V>;
}

export function safeCreateAppInstance<V extends ApiVersion>(
  client: Client<V>,
  request: CreateAppInstanceRequest,
): Promise<SafeResult<VMForVersion<V>>>;
export async function safeCreateAppInstance<V extends ApiVersion>(
  client: Client<V>,
  request: CreateAppInstanceRequest,
): Promise<SafeResult<VMForVersion<V>>> {
  try {
    const data = await createAppInstance(client, request);
    return { success: true, data };
  } catch (error) {
    if (error && typeof error === "object" && ("status" in error || "issues" in error)) {
      return { success: false, error } as SafeResult<VMForVersion<V>>;
    }
    return {
      success: false,
      error: {
        name: "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    } as SafeResult<VMForVersion<V>>;
  }
}
