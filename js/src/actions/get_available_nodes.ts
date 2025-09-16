import { z } from "zod";
import { type Client, type SafeResult } from "../client";
import { KmsInfoSchema } from "../types/kms_info";
import { ActionParameters, ActionReturnType } from "../types/common";

/**
 * Get available teepods and their capacity information
 *
 * Returns a list of available teepods with their capacity and KMS information.
 *
 * @example
 * ```typescript
 * import { createClient, getAvailableNodes } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 * const result = await getAvailableNodes(client)
 * // Output: { tier: 'free', capacity: { ... }, nodes: [...], kms_list: [...] }
 * ```
 *
 * ## Returns
 *
 * `AvailableNodes | unknown`
 *
 * List of available teepods and their capacity. Return type depends on schema parameter.
 *
 * ## Parameters
 *
 * ### parameters (optional)
 * - **Type:** `GetAvailableNodesParameters`
 *
 * Optional behavior parameters for schema validation.
 *
 * ```typescript
 * // Use default schema
 * const result = await getAvailableNodes(client)
 *
 * // Return raw data without validation
 * const raw = await getAvailableNodes(client, { schema: false })
 *
 * // Use custom schema
 * const customSchema = z.object({ tier: z.string() })
 * const custom = await getAvailableNodes(client, { schema: customSchema })
 * ```
 *
 * ## Safe Version
 *
 * Use `safeGetAvailableNodes` for error handling without exceptions:
 *
 * ```typescript
 * import { safeGetAvailableNodes } from '@phala/cloud'
 *
 * const result = await safeGetAvailableNodes(client)
 * if (result.success) {
 *   console.log(result.data.tier)
 * } else {
 *   if ("isRequestError" in result.error) {
 *     console.error(`HTTP ${result.error.status}: ${result.error.message}`)
 *   } else {
 *     console.error(`Validation error: ${result.error.issues}`)
 *   }
 * }
 * ```
 */

export const AvailableOSImageSchema = z
  .object({
    name: z.string(),
    is_dev: z.boolean(),
    version: z.union([
      z.tuple([z.number(), z.number(), z.number()]),
      z.tuple([z.number(), z.number(), z.number(), z.number()]),
    ]),
    os_image_hash: z.string().nullable().optional(),
  })
  .passthrough();

export const TeepodCapacitySchema = z
  .object({
    teepod_id: z.number(),
    name: z.string(),
    listed: z.boolean(),
    resource_score: z.number(),
    remaining_vcpu: z.number(),
    remaining_memory: z.number(),
    remaining_cvm_slots: z.number(),
    images: z.array(AvailableOSImageSchema),
    support_onchain_kms: z.boolean().optional(),
    fmspc: z.string().nullable().optional(),
    device_id: z.string().nullable().optional(),
    region_identifier: z.string().nullable().optional(),
    default_kms: z.string().nullable().optional(),
    kms_list: z.array(z.string()).default([]),
  })
  .passthrough();

export const ResourceThresholdSchema = z
  .object({
    max_instances: z.number().nullable().optional(),
    max_vcpu: z.number().nullable().optional(),
    max_memory: z.number().nullable().optional(),
    max_disk: z.number().nullable().optional(),
  })
  .passthrough();

export const AvailableNodesSchema = z
  .object({
    tier: z.string(), // TeamTier is string enum
    capacity: ResourceThresholdSchema,
    nodes: z.array(TeepodCapacitySchema),
    kms_list: z.array(KmsInfoSchema),
  })
  .passthrough();

export type AvailableOSImage = z.infer<typeof AvailableOSImageSchema>;
export type TeepodCapacity = z.infer<typeof TeepodCapacitySchema>;
export type ResourceThreshold = z.infer<typeof ResourceThresholdSchema>;
export type AvailableNodes = z.infer<typeof AvailableNodesSchema>;

export type GetAvailableNodesParameters<T = undefined> = ActionParameters<T>;

export type GetAvailableNodesReturnType<T = undefined> = ActionReturnType<AvailableNodes, T>;

export async function getAvailableNodes<T extends z.ZodSchema | false | undefined = undefined>(
  client: Client,
  parameters?: GetAvailableNodesParameters<T>,
): Promise<GetAvailableNodesReturnType<T>> {
  const response = await client.get("/teepods/available");

  if (parameters?.schema === false) {
    return response as GetAvailableNodesReturnType<T>;
  }

  const schema = (parameters?.schema || AvailableNodesSchema) as z.ZodSchema;
  return schema.parse(response) as GetAvailableNodesReturnType<T>;
}

export async function safeGetAvailableNodes<T extends z.ZodSchema | false | undefined = undefined>(
  client: Client,
  parameters?: GetAvailableNodesParameters<T>,
): Promise<SafeResult<GetAvailableNodesReturnType<T>>> {
  const httpResult = await client.safeGet("/teepods/available");

  if (!httpResult.success) {
    return httpResult as SafeResult<GetAvailableNodesReturnType<T>>;
  }

  if (parameters?.schema === false) {
    return { success: true, data: httpResult.data } as SafeResult<GetAvailableNodesReturnType<T>>;
  }

  const schema = (parameters?.schema || AvailableNodesSchema) as z.ZodSchema;
  return schema.safeParse(httpResult.data) as SafeResult<GetAvailableNodesReturnType<T>>;
}
