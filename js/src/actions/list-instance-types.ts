import { z } from "zod";
import { type Client } from "../client";
import { defineAction } from "../utils/define-action";

// Response Schemas
export const InstanceTypeSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    vcpu: z.number(),
    memory_mb: z.number(),
    hourly_rate: z.string(),
    requires_gpu: z.boolean(),
    requires_gpu_count: z.number().int().min(0).default(0),
    requires_gpu_product_id: z.string().nullable().optional(),
    default_disk_size_gb: z.number().default(20),
    family: z.string().nullable(),
  })
  .passthrough();

export const FamilyGroupSchema = z
  .object({
    name: z.string(),
    items: z.array(InstanceTypeSchema),
    total: z.number(),
  })
  .strict();

export const AllFamiliesResponseSchema = z
  .object({
    result: z.array(FamilyGroupSchema),
  })
  .strict();

export const FamilyInstanceTypesResponseSchema = z
  .object({
    items: z.array(InstanceTypeSchema),
    total: z.number(),
    family: z.string(),
  })
  .strict();

// Type definitions
export type InstanceType = z.infer<typeof InstanceTypeSchema>;
export type FamilyGroup = z.infer<typeof FamilyGroupSchema>;
export type AllFamiliesResponse = z.infer<typeof AllFamiliesResponseSchema>;
export type FamilyInstanceTypesResponse = z.infer<typeof FamilyInstanceTypesResponseSchema>;

// Request Schema
export const ListFamilyInstanceTypesRequestSchema = z
  .object({
    family: z.string(),
  })
  .strict();

// Type definition
export type ListFamilyInstanceTypesRequest = z.infer<typeof ListFamilyInstanceTypesRequestSchema>;

/**
 * List all instance type families with their items
 *
 * Returns all public instance types grouped by family.
 * No pagination - returns the complete list.
 *
 * @param client - The API client
 * @param parameters - Optional behavior parameters
 * @returns All families with their instance types
 *
 * @example
 * ```typescript
 * // Get all families
 * const response = await listAllInstanceTypeFamilies(client)
 * // response.result contains array of { name, items, total }
 * ```
 */
const { action: listAllInstanceTypeFamilies, safeAction: safeListAllInstanceTypeFamilies } =
  defineAction<void, typeof AllFamiliesResponseSchema>(
    AllFamiliesResponseSchema,
    async (client) => {
      return await client.get("/instance-types");
    },
  );

/**
 * List instance types for a specific family
 *
 * @param client - The API client
 * @param request - Request with family parameter
 * @param request.family - Family name (e.g., 'cpu', 'gpu')
 * @param parameters - Optional behavior parameters
 * @returns Instance types for the specified family
 *
 * @example
 * ```typescript
 * // Get CPU instance types
 * const cpuTypes = await listFamilyInstanceTypes(client, { family: 'cpu' })
 *
 * // Get GPU instance types
 * const gpuTypes = await listFamilyInstanceTypes(client, { family: 'gpu' })
 * ```
 */
const { action: listFamilyInstanceTypes, safeAction: safeListFamilyInstanceTypes } = defineAction<
  ListFamilyInstanceTypesRequest,
  typeof FamilyInstanceTypesResponseSchema
>(FamilyInstanceTypesResponseSchema, async (client, request) => {
  const validated = ListFamilyInstanceTypesRequestSchema.parse(request);
  return await client.get(`/instance-types/${validated.family}`);
});

export {
  listAllInstanceTypeFamilies,
  safeListAllInstanceTypeFamilies,
  listFamilyInstanceTypes,
  safeListFamilyInstanceTypes,
};
