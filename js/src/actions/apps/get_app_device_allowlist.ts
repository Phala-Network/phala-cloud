import { z } from "zod";
import { type Client, type SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";

const DeviceAllowlistItemSchema = z.object({
  device_id: z.string(),
  node_name: z.string().nullable(),
  cvm_ids: z.array(z.number()),
  allowed_onchain: z.boolean(),
  status: z.string(),
});

const DeviceAllowlistResponseSchema = z.object({
  is_onchain_kms: z.boolean(),
  allow_any_device: z.boolean().nullable().optional(),
  chain_id: z.number().nullable().optional(),
  app_contract_address: z.string().nullable().optional(),
  devices: z.array(DeviceAllowlistItemSchema).optional().default([]),
});

export type DeviceAllowlistItem = z.infer<typeof DeviceAllowlistItemSchema>;
export type DeviceAllowlistResponse = z.infer<typeof DeviceAllowlistResponseSchema>;

export const GetAppDeviceAllowlistRequestSchema = z
  .object({
    appId: z.string().min(1),
  })
  .strict();

export type GetAppDeviceAllowlistRequest = z.infer<typeof GetAppDeviceAllowlistRequestSchema>;

/**
 * Get device allowlist status for an app's CVMs
 *
 * For on-chain KMS apps, queries the blockchain in real-time to check
 * which devices are registered in the app contract.
 *
 * @param client - The API client
 * @param request - Request parameters
 * @param request.appId - The hex app identifier
 * @returns Device allowlist status
 *
 * @example
 * ```typescript
 * const allowlist = await getAppDeviceAllowlist(client, { appId: "abc123" })
 * if (allowlist.is_onchain_kms) {
 *   for (const device of allowlist.devices) {
 *     console.log(device.device_id, device.status)
 *   }
 * }
 * ```
 */
export function getAppDeviceAllowlist<V extends ApiVersion>(
  client: Client<V>,
  request: GetAppDeviceAllowlistRequest,
): Promise<DeviceAllowlistResponse>;
export async function getAppDeviceAllowlist<V extends ApiVersion>(
  client: Client<V>,
  request: GetAppDeviceAllowlistRequest,
): Promise<DeviceAllowlistResponse> {
  const { appId } = GetAppDeviceAllowlistRequestSchema.parse(request);
  const response = await client.get(`/apps/${appId}/device-allowlist`);
  return DeviceAllowlistResponseSchema.parse(response);
}

/**
 * Safe version of getAppDeviceAllowlist that returns a SafeResult instead of throwing
 */
export function safeGetAppDeviceAllowlist<V extends ApiVersion>(
  client: Client<V>,
  request: GetAppDeviceAllowlistRequest,
): Promise<SafeResult<DeviceAllowlistResponse>>;
export async function safeGetAppDeviceAllowlist<V extends ApiVersion>(
  client: Client<V>,
  request: GetAppDeviceAllowlistRequest,
): Promise<SafeResult<DeviceAllowlistResponse>> {
  try {
    const data = await getAppDeviceAllowlist(client, request);
    return { success: true, data };
  } catch (error) {
    if (error && typeof error === "object" && ("status" in error || "issues" in error)) {
      return { success: false, error } as SafeResult<DeviceAllowlistResponse>;
    }
    return {
      success: false,
      error: {
        name: "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    } as SafeResult<DeviceAllowlistResponse>;
  }
}
