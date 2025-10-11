import { z } from "zod";
import { type Client } from "../client";
import { CvmInfoSchema } from "../types/cvm_info";
import { defineAction } from "../utils/define-action";

export const GetCvmListRequestSchema = z
  .object({
    page: z.number().int().min(1).optional(),
    page_size: z.number().int().min(1).optional(),
    node_id: z.number().int().min(1).optional(),
  })
  .strict();

export const GetCvmListSchema = z
  .object({
    items: z.array(CvmInfoSchema),
    total: z.number(),
    page: z.number(),
    page_size: z.number(),
    pages: z.number(),
  })
  .strict();

export type GetCvmListRequest = z.infer<typeof GetCvmListRequestSchema>;
export type GetCvmListResponse = z.infer<typeof GetCvmListSchema>;

/**
 * Get a paginated list of CVMs
 *
 * @param client - The API client
 * @param request - Optional request parameters for pagination and filtering
 * @param request.page - Page number (1-based)
 * @param request.page_size - Number of items per page
 * @param request.node_id - Filter by node ID
 * @returns Paginated list of CVMs
 *
 * @example
 * ```typescript
 * // Get first page with default size
 * const list = await getCvmList(client, { page: 1 })
 *
 * // Get with custom page size
 * const list = await getCvmList(client, { page: 1, page_size: 20 })
 *
 * // Get with custom schema
 * const list = await getCvmList(client, { page: 1 }, { schema: customSchema })
 * ```
 */
const { action: getCvmList, safeAction: safeGetCvmList } = defineAction<
  GetCvmListRequest | undefined,
  typeof GetCvmListSchema
>(GetCvmListSchema, async (client, request) => {
  const validatedRequest = GetCvmListRequestSchema.parse(request ?? {});
  return await client.get("/cvms/paginated", { params: validatedRequest });
});

export { getCvmList, safeGetCvmList };
