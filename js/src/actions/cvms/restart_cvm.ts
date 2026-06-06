import { z } from "zod";
import { type Client, type SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";
import { CvmIdSchema, CvmIdObjectSchema, refineCvmId } from "../../types/cvm_id";
import { getVMSchemaForVersion, type VMForVersion } from "../../types/cvm_info";

/**
 * Restart a CVM (Confidential Virtual Machine)
 *
 * This action performs a graceful restart of a running CVM instance,
 * shutting down cleanly and then starting it again.
 *
 * @example
 * ```typescript
 * import { createClient, restartCvm } from '@phala/cloud'
 *
 * const client = createClient();
 * const result = await restartCvm(client, { id: 'my-cvm-id' });
 * console.log(result.status); // "restarting"
 *
 * // Force restart (may skip graceful shutdown)
 * const forceResult = await restartCvm(client, { id: 'my-cvm-id', force: true });
 * ```
 *
 * ## Safe Version
 *
 * Use `safeRestartCvm` for error handling without exceptions:
 *
 * ```typescript
 * const result = await safeRestartCvm(client, { id: 'my-cvm-id' });
 * if (result.success) {
 *   console.log('CVM restarting:', result.data.status);
 * } else {
 *   console.error('Failed to restart CVM:', result.error.message);
 * }
 * ```
 */

export const RestartCvmRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    force: z.boolean().optional(),
  }),
);

export type RestartCvmRequest = z.infer<typeof RestartCvmRequestSchema>;

export function restartCvm<V extends ApiVersion>(
  client: Client<V>,
  request: RestartCvmRequest,
): Promise<VMForVersion<V>>;
export async function restartCvm<V extends ApiVersion>(
  client: Client<V>,
  request: RestartCvmRequest,
): Promise<VMForVersion<V>> {
  const parsed = RestartCvmRequestSchema.parse(request);
  const { cvmId } = CvmIdSchema.parse(parsed);
  const { force = false } = parsed;
  const response = await client.post(`/cvms/${cvmId}/restart`, { force });
  return getVMSchemaForVersion(client.config.version).parse(response) as VMForVersion<V>;
}

export function safeRestartCvm<V extends ApiVersion>(
  client: Client<V>,
  request: RestartCvmRequest,
): Promise<SafeResult<VMForVersion<V>>>;
export async function safeRestartCvm<V extends ApiVersion>(
  client: Client<V>,
  request: RestartCvmRequest,
): Promise<SafeResult<VMForVersion<V>>> {
  try {
    const data = await restartCvm(client, request);
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
