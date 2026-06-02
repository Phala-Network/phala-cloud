import { type Client, type SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";
import { CvmIdSchema, type CvmIdInput } from "../../types/cvm_id";
import { getVMSchemaForVersion, type VMForVersion } from "../../types/cvm_info";

/**
 * Force stop a CVM (Confidential Virtual Machine)
 *
 * This action forcefully stops a running CVM instance immediately,
 * similar to pulling the power plug. Use shutdown for graceful stops.
 *
 * @example
 * ```typescript
 * import { createClient, stopCvm } from '@phala/cloud'
 *
 * const client = createClient();
 * const result = await stopCvm(client, { id: 'my-cvm-id' });
 * console.log(result.status); // "stopped"
 * ```
 *
 * ## Safe Version
 *
 * Use `safeStopCvm` for error handling without exceptions:
 *
 * ```typescript
 * const result = await safeStopCvm(client, { id: 'my-cvm-id' });
 * if (result.success) {
 *   console.log('CVM stopped:', result.data.status);
 * } else {
 *   console.error('Failed to stop CVM:', result.error.message);
 * }
 * ```
 */

export const StopCvmRequestSchema = CvmIdSchema;

export type StopCvmRequest = CvmIdInput;

export function stopCvm<V extends ApiVersion>(
  client: Client<V>,
  request: StopCvmRequest,
): Promise<VMForVersion<V>>;
export async function stopCvm<V extends ApiVersion>(
  client: Client<V>,
  request: StopCvmRequest,
): Promise<VMForVersion<V>> {
  const { cvmId } = StopCvmRequestSchema.parse(request);
  const response = await client.post(`/cvms/${cvmId}/stop`);
  return getVMSchemaForVersion(client.config.version).parse(response) as VMForVersion<V>;
}

export function safeStopCvm<V extends ApiVersion>(
  client: Client<V>,
  request: StopCvmRequest,
): Promise<SafeResult<VMForVersion<V>>>;
export async function safeStopCvm<V extends ApiVersion>(
  client: Client<V>,
  request: StopCvmRequest,
): Promise<SafeResult<VMForVersion<V>>> {
  try {
    const data = await stopCvm(client, request);
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
