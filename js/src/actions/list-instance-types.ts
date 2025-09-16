import { z } from "zod";
import { type Client, type SafeResult } from "../client";
import { ActionParameters, ActionReturnType } from "../types/common";
import { validateActionParameters, safeValidateActionParameters } from "../utils";

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

export type ListInstanceTypesParameters<T = undefined> = ActionParameters<T>;
export type ListInstanceTypesReturnType<T = undefined> = ActionReturnType<
  PaginatedInstanceTypes,
  T
>;

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
export async function listInstanceTypes<T extends z.ZodSchema | false | undefined = undefined>(
  client: Client,
  request?: ListInstanceTypesRequest,
  parameters?: ListInstanceTypesParameters<T>,
): Promise<ListInstanceTypesReturnType<T>> {
  const validatedRequest = ListInstanceTypesRequestSchema.parse(request ?? {});
  validateActionParameters(parameters);

  const queryParams = new URLSearchParams();
  queryParams.append("page", validatedRequest.page.toString());
  queryParams.append("page_size", validatedRequest.page_size.toString());

  const response = await client.get(`/api/instance-types?${queryParams.toString()}`);

  if (parameters?.schema === false) {
    return response as ListInstanceTypesReturnType<T>;
  }

  const schema = (parameters?.schema || PaginatedInstanceTypesSchema) as z.ZodSchema;
  return schema.parse(response) as ListInstanceTypesReturnType<T>;
}

/**
 * Safe version of listInstanceTypes that returns a Result type instead of throwing
 */
export async function safeListInstanceTypes<T extends z.ZodSchema | false | undefined = undefined>(
  client: Client,
  request?: ListInstanceTypesRequest,
  parameters?: ListInstanceTypesParameters<T>,
): Promise<SafeResult<ListInstanceTypesReturnType<T>>> {
  const requestValidation = ListInstanceTypesRequestSchema.safeParse(request ?? {});
  if (!requestValidation.success) {
    return requestValidation as SafeResult<ListInstanceTypesReturnType<T>>;
  }

  const parameterValidationError = safeValidateActionParameters(parameters);
  if (parameterValidationError) {
    return parameterValidationError as SafeResult<ListInstanceTypesReturnType<T>>;
  }

  const queryParams = new URLSearchParams();
  queryParams.append("page", requestValidation.data.page.toString());
  queryParams.append("page_size", requestValidation.data.page_size.toString());

  const httpResult = await client.safeGet(`/api/instance-types?${queryParams.toString()}`);
  if (!httpResult.success) {
    return httpResult;
  }

  if (parameters?.schema === false) {
    return {
      success: true,
      data: httpResult.data,
    } as SafeResult<ListInstanceTypesReturnType<T>>;
  }

  const schema = (parameters?.schema || PaginatedInstanceTypesSchema) as z.ZodSchema;
  const validationResult = schema.safeParse(httpResult.data);
  return validationResult as SafeResult<ListInstanceTypesReturnType<T>>;
}
