import { type Client, type SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";
import { CvmIdSchema, type CvmIdInput } from "../../types/cvm_id";
import { getVMSchemaForVersion, type VMForVersion } from "../../types/cvm_info";

/**
 * Start a CVM (Confidential Virtual Machine)
 *
 * This action starts a stopped or shutdown CVM instance.
 *
 * @example
 * ```typescript
 * import { createClient, startCvm } from '@phala/cloud'
 *
 * const client = createClient();
 * const result = await startCvm(client, { id: 'my-cvm-id' });
 * console.log(result.status); // "starting"
 * ```
 *
 * ## Safe Version
 *
 * Use `safeStartCvm` for error handling without exceptions:
 *
 * ```typescript
 * const result = await safeStartCvm(client, { id: 'my-cvm-id' });
 * if (result.success) {
 *   console.log('CVM started:', result.data.status);
 * } else {
 *   console.error('Failed to start CVM:', result.error.message);
 * }
 * ```
 */

export const StartCvmRequestSchema = CvmIdSchema;

export type StartCvmRequest = CvmIdInput;

export function startCvm<V extends ApiVersion>(
  client: Client<V>,
  request: StartCvmRequest,
): Promise<VMForVersion<V>>;
export async function startCvm<V extends ApiVersion>(
  client: Client<V>,
  request: StartCvmRequest,
): Promise<VMForVersion<V>> {
  const { cvmId } = StartCvmRequestSchema.parse(request);
  const response = await client.post(`/cvms/${cvmId}/start`);
  return getVMSchemaForVersion(client.config.version).parse(response) as VMForVersion<V>;
}

export function safeStartCvm<V extends ApiVersion>(
  client: Client<V>,
  request: StartCvmRequest,
): Promise<SafeResult<VMForVersion<V>>>;
export async function safeStartCvm<V extends ApiVersion>(
  client: Client<V>,
  request: StartCvmRequest,
): Promise<SafeResult<VMForVersion<V>>> {
  try {
    const data = await startCvm(client, request);
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
