import { z } from "zod";
import { type Client } from "../client";
import { defineAction } from "../utils/define-action";

// Request Schema
export const ListInstanceTypesRequestSchema = z
  .object({
    page: z.number().int().min(1).optional().default(1),
    page_size: z.number().int().min(1).max(1000).optional().default(100),
  })
  .strict();

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
    public: z.boolean(),
    enabled: z.boolean(),
  })
  .passthrough();

export const PaginatedInstanceTypesSchema = z
  .object({
    items: z.array(InstanceTypeSchema),
    total: z.number(),
    page: z.number(),
    page_size: z.number(),
    pages: z.number(),
  })
  .strict();

// Type definitions
export type ListInstanceTypesRequest = z.infer<typeof ListInstanceTypesRequestSchema>;
export type InstanceType = z.infer<typeof InstanceTypeSchema>;
export type PaginatedInstanceTypes = z.infer<typeof PaginatedInstanceTypesSchema>;

/**
 * List available instance types with pagination
 *
 * @param client - The API client
 * @param request - Optional request parameters for pagination
 * @param request.page - Page number (1-based)
 * @param request.page_size - Number of items per page
 * @param parameters - Optional behavior parameters
 * @returns Paginated list of instance types
 *
 * @example
 * ```typescript
 * // Get first page with default size
 * const types = await listInstanceTypes(client, { page: 1 })
 *
 * // Get with custom page size
 * const types = await listInstanceTypes(client, { page: 1, page_size: 50 })
 *
 * // Get all types (use large page size)
 * const types = await listInstanceTypes(client, { page_size: 1000 })
 * ```
 */
const { action: listInstanceTypes, safeAction: safeListInstanceTypes } = defineAction<
  ListInstanceTypesRequest | undefined,
  typeof PaginatedInstanceTypesSchema
>(PaginatedInstanceTypesSchema, async (client, request) => {
  const validatedRequest = ListInstanceTypesRequestSchema.parse(request ?? {});

  const queryParams = new URLSearchParams();
  queryParams.append("page", validatedRequest.page.toString());
  queryParams.append("page_size", validatedRequest.page_size.toString());

  return await client.get(`/api/instance-types?${queryParams.toString()}`);
});

export { listInstanceTypes, safeListInstanceTypes };
