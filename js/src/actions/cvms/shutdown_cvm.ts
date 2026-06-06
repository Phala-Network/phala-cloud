import { type Client, type SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";
import { CvmIdSchema, type CvmIdInput } from "../../types/cvm_id";
import { getVMSchemaForVersion, type VMForVersion } from "../../types/cvm_info";

/**
 * Shutdown a CVM (Confidential Virtual Machine) gracefully
 *
 * This action performs a graceful shutdown of a running CVM instance,
 * allowing the guest OS to shut down cleanly.
 *
 * @example
 * ```typescript
 * import { createClient, shutdownCvm } from '@phala/cloud'
 *
 * const client = createClient();
 * const result = await shutdownCvm(client, { id: 'my-cvm-id' });
 * console.log(result.status); // "shutting_down"
 * ```
 *
 * ## Safe Version
 *
 * Use `safeShutdownCvm` for error handling without exceptions:
 *
 * ```typescript
 * const result = await safeShutdownCvm(client, { id: 'my-cvm-id' });
 * if (result.success) {
 *   console.log('CVM shutting down:', result.data.status);
 * } else {
 *   console.error('Failed to shutdown CVM:', result.error.message);
 * }
 * ```
 */

export const ShutdownCvmRequestSchema = CvmIdSchema;

export type ShutdownCvmRequest = CvmIdInput;

export function shutdownCvm<V extends ApiVersion>(
  client: Client<V>,
  request: ShutdownCvmRequest,
): Promise<VMForVersion<V>>;
export async function shutdownCvm<V extends ApiVersion>(
  client: Client<V>,
  request: ShutdownCvmRequest,
): Promise<VMForVersion<V>> {
  const { cvmId } = ShutdownCvmRequestSchema.parse(request);
  const response = await client.post(`/cvms/${cvmId}/shutdown`);
  return getVMSchemaForVersion(client.config.version).parse(response) as VMForVersion<V>;
}

export function safeShutdownCvm<V extends ApiVersion>(
  client: Client<V>,
  request: ShutdownCvmRequest,
): Promise<SafeResult<VMForVersion<V>>>;
export async function safeShutdownCvm<V extends ApiVersion>(
  client: Client<V>,
  request: ShutdownCvmRequest,
): Promise<SafeResult<VMForVersion<V>>> {
  try {
    const data = await shutdownCvm(client, request);
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
