import { z } from "zod";
import { type Client } from "../../client";
import { defineAction } from "../../utils/define-action";

// CVM info within the apps response
export const AppCvmInfoSchema = z.object({
  vm_uuid: z.string(),
  app_id: z.string(),
  name: z.string(),
  status: z.string(),
  vcpu: z.number(),
  memory: z.number(),
  disk_size: z.number(),
  teepod_id: z.number(),
  teepod_name: z.string(),
  region_identifier: z.string(),
  kms_type: z.string(),
  instance_type: z.string(),
  listed: z.boolean(),
  base_image: z.string(),
  kms_slug: z.string(),
  kms_id: z.string(),
  instance_id: z.string().nullable(),
});

// DStack App schema
export const DstackAppSchema = z.object({
  id: z.string(),
  name: z.string(),
  app_id: z.string(),
  app_provision_type: z.string().nullable(),
  app_icon_url: z.string().nullable(),
  created_at: z.string(),
  kms_type: z.string(),
  current_cvm: AppCvmInfoSchema.nullable(),
  cvms: z.array(AppCvmInfoSchema),
  cvm_count: z.number(),
});

export const GetAppsListRequestSchema = z.object({
  page: z.number().int().min(1).optional(),
  page_size: z.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  status: z.array(z.string()).optional(),
  listed: z.boolean().optional(),
  base_image: z.string().optional(),
  instance_type: z.string().optional(),
  kms_slug: z.string().optional(),
  kms_type: z.string().optional(),
  teepod_name: z.string().optional(),
  region: z.string().optional(),
  debug_user_id: z.number().optional(),
});

export const GetAppsListSchema = z.object({
  dstack_apps: z.array(DstackAppSchema),
  page: z.number(),
  page_size: z.number(),
  total: z.number(),
  total_pages: z.number(),
});

export type GetAppsListRequest = z.infer<typeof GetAppsListRequestSchema>;
export type GetAppsListResponse = z.infer<typeof GetAppsListSchema>;
export type DstackApp = z.infer<typeof DstackAppSchema>;
export type AppCvmInfo = z.infer<typeof AppCvmInfoSchema>;

/**
 * Get a paginated list of apps with their CVMs.
 * This endpoint returns only the current user's apps (even for admin users).
 *
 * @param client - The API client
 * @param request - Optional request parameters for pagination and filtering
 * @param request.page - Page number (1-based), default 1
 * @param request.page_size - Number of items per page (1-100), default 20
 * @param request.search - Search in name, app_id, vm_uuid, instance_id
 * @param request.status - Filter by CVM status
 * @param request.listed - Filter by listed status
 * @param request.base_image - Filter by Docker image version
 * @param request.instance_type - Filter by instance type
 * @param request.kms_slug - Filter by KMS slug
 * @param request.kms_type - Filter by KMS type
 * @param request.teepod_name - Filter by node name
 * @param request.region - Filter by region
 * @param request.debug_user_id - Admin only: impersonate user for debugging
 * @returns Paginated list of apps with their CVMs
 *
 * @example
 * ```typescript
 * // Get first page with default size
 * const list = await getAppsList(client, { page: 1 })
 *
 * // Get with custom page size
 * const list = await getAppsList(client, { page: 1, page_size: 50 })
 *
 * // Search for specific apps
 * const list = await getAppsList(client, { search: "my-app" })
 * ```
 */
const { action: getAppsList, safeAction: safeGetAppsList } = defineAction<
  GetAppsListRequest | undefined,
  typeof GetAppsListSchema
>(GetAppsListSchema, async (client, request) => {
  const validatedRequest = GetAppsListRequestSchema.parse(request ?? {});
  return await client.get("/apps", { params: validatedRequest });
});

export { getAppsList, safeGetAppsList };
