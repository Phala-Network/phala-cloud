import { z } from "zod";
import type { Client, SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";
import { CvmIdObjectSchema, CvmIdSchema, refineCvmId } from "../../types/cvm_id";
import { type VMForVersion, getVMSchemaForVersion } from "../../types/cvm_info";

/**
 * Replicate (scale up) a CVM by creating a new replica
 *
 * This action creates a new CVM instance with the same configuration
 * as the source CVM, effectively scaling up the application.
 *
 * @example
 * ```typescript
 * import { createClient, replicateCvm } from '@phala/cloud'
 *
 * const client = createClient();
 * const replica = await replicateCvm(client, { id: 'my-cvm-id' });
 * console.log(replica.vm_uuid); // new replica UUID
 *
 * // Replicate to a specific node
 * const replica2 = await replicateCvm(client, { id: 'my-cvm-id', node_id: 42 });
 * ```
 *
 * ## Safe Version
 *
 * Use `safeReplicateCvm` for error handling without exceptions:
 *
 * ```typescript
 * const result = await safeReplicateCvm(client, { id: 'my-cvm-id' });
 * if (result.success) {
 *   console.log('Replica created:', result.data.vm_uuid);
 * } else {
 *   console.error('Failed to replicate CVM:', result.error.message);
 * }
 * ```
 */

export const ReplicateCvmRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    node_id: z.number().optional(),
    os_image: z.string().min(1).optional(),
  }),
);

export type ReplicateCvmRequest = z.infer<typeof ReplicateCvmRequestSchema>;

export function replicateCvm<V extends ApiVersion>(
  client: Client<V>,
  request: ReplicateCvmRequest,
): Promise<VMForVersion<V>>;
export async function replicateCvm<V extends ApiVersion>(
  client: Client<V>,
  request: ReplicateCvmRequest,
): Promise<VMForVersion<V>> {
  const parsed = ReplicateCvmRequestSchema.parse(request);
  const { cvmId } = CvmIdSchema.parse(parsed);
  const { node_id, os_image } = parsed;
  const response = await client.post(`/cvms/${cvmId}/replicas`, {
    node_id,
    os_image,
  });
  return getVMSchemaForVersion(client.config.version).parse(response) as VMForVersion<V>;
}

export function safeReplicateCvm<V extends ApiVersion>(
  client: Client<V>,
  request: ReplicateCvmRequest,
): Promise<SafeResult<VMForVersion<V>>>;
export async function safeReplicateCvm<V extends ApiVersion>(
  client: Client<V>,
  request: ReplicateCvmRequest,
): Promise<SafeResult<VMForVersion<V>>> {
  try {
    const data = await replicateCvm(client, request);
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
