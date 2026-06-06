import { z } from "zod";
import { type Client, type SafeResult } from "../../client";
import type { ApiVersion } from "../../types/client";
import type { GetAppDeviceAllowlistResponse } from "../../types/version-mappings";

const DeviceAllowlistItemBaseSchema = z.object({
  device_id: z.string(),
  node_name: z.string().nullable(),
  allowed_onchain: z.boolean(),
  status: z.string(),
});

export const DeviceAllowlistItemV20260121Schema = DeviceAllowlistItemBaseSchema.extend({
  cvm_ids: z.array(z.number()),
});
export type DeviceAllowlistItemV20260121 = z.infer<typeof DeviceAllowlistItemV20260121Schema>;

export const DeviceAllowlistItemV20260522Schema = DeviceAllowlistItemBaseSchema.extend({
  cvm_ids: z.array(z.string()),
});
export type DeviceAllowlistItemV20260522 = z.infer<typeof DeviceAllowlistItemV20260522Schema>;

const DeviceAllowlistResponseBaseSchema = z.object({
  is_onchain_kms: z.boolean(),
  allow_any_device: z.boolean().nullable().optional(),
  chain_id: z.number().nullable().optional(),
  app_contract_address: z.string().nullable().optional(),
});

export const DeviceAllowlistResponseV20260121Schema = DeviceAllowlistResponseBaseSchema.extend({
  devices: z.array(DeviceAllowlistItemV20260121Schema).optional().default([]),
});
export type DeviceAllowlistResponseV20260121 = z.infer<
  typeof DeviceAllowlistResponseV20260121Schema
>;

export const DeviceAllowlistResponseV20260522Schema = DeviceAllowlistResponseBaseSchema.extend({
  devices: z.array(DeviceAllowlistItemV20260522Schema).optional().default([]),
});
export type DeviceAllowlistResponseV20260522 = z.infer<
  typeof DeviceAllowlistResponseV20260522Schema
>;

const DeviceAllowlistItemAnySchema = z.union([
  DeviceAllowlistItemV20260121Schema,
  DeviceAllowlistItemV20260522Schema,
]);
const DeviceAllowlistResponseAnySchema = z.union([
  DeviceAllowlistResponseV20260121Schema,
  DeviceAllowlistResponseV20260522Schema,
]);
const DeviceAllowlistResponseSchema = DeviceAllowlistResponseV20260522Schema;
export type DeviceAllowlistItem = z.infer<typeof DeviceAllowlistItemV20260522Schema>;
export type DeviceAllowlistResponse = z.infer<typeof DeviceAllowlistResponseSchema>;
export { DeviceAllowlistItemAnySchema, DeviceAllowlistResponseAnySchema };

function getSchemaForVersion(version: ApiVersion) {
  if (version === "2026-01-21") return DeviceAllowlistResponseV20260121Schema;
  return DeviceAllowlistResponseV20260522Schema;
}

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
): Promise<GetAppDeviceAllowlistResponse<V>>;
export async function getAppDeviceAllowlist<V extends ApiVersion>(
  client: Client<V>,
  request: GetAppDeviceAllowlistRequest,
): Promise<GetAppDeviceAllowlistResponse<V>> {
  const { appId } = GetAppDeviceAllowlistRequestSchema.parse(request);
  const response = await client.get(`/apps/${appId}/device-allowlist`);
  return getSchemaForVersion(client.config.version).parse(
    response,
  ) as GetAppDeviceAllowlistResponse<V>;
}

/**
 * Safe version of getAppDeviceAllowlist that returns a SafeResult instead of throwing
 */
export function safeGetAppDeviceAllowlist<V extends ApiVersion>(
  client: Client<V>,
  request: GetAppDeviceAllowlistRequest,
): Promise<SafeResult<GetAppDeviceAllowlistResponse<V>>>;
export async function safeGetAppDeviceAllowlist<V extends ApiVersion>(
  client: Client<V>,
  request: GetAppDeviceAllowlistRequest,
): Promise<SafeResult<GetAppDeviceAllowlistResponse<V>>> {
  try {
    const data = await getAppDeviceAllowlist(client, request);
    return { success: true, data };
  } catch (error) {
    if (error && typeof error === "object" && ("status" in error || "issues" in error)) {
      return { success: false, error } as SafeResult<GetAppDeviceAllowlistResponse<V>>;
    }
    return {
      success: false,
      error: {
        name: "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    } as SafeResult<GetAppDeviceAllowlistResponse<V>>;
  }
}
