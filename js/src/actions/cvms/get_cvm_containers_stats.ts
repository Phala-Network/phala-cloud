import { z } from "zod";
import { CvmIdSchema, type CvmIdInput } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";

/**
 * Get CVM containers stats and composition information
 *
 * This action retrieves the docker compose configuration and running
 * containers information for a CVM instance.
 *
 * @example
 * ```typescript
 * import { createClient, getCvmContainersStats } from '@phala/cloud'
 *
 * const client = createClient();
 * const stats = await getCvmContainersStats(client, { id: 'my-cvm-id' });
 * console.log(stats.containers?.length);
 * ```
 *
 * ## Safe Version
 *
 * Use `safeGetCvmContainersStats` for error handling without exceptions:
 *
 * ```typescript
 * const result = await safeGetCvmContainersStats(client, { id: 'my-cvm-id' });
 * if (result.success) {
 *   console.log('Containers:', result.data.containers);
 * } else {
 *   console.error('Failed to get containers stats:', result.error.message);
 * }
 * ```
 */

const ContainerInfoSchema = z.object({
  id: z.string(),
  names: z.array(z.string()),
  image: z.string(),
  image_id: z.string(),
  command: z.string().nullable().optional(),
  created: z.number(),
  state: z.string(),
  status: z.string(),
  log_endpoint: z.string().nullable(),
});

export const CvmContainersStatsSchema = z.object({
  is_online: z.boolean(),
  is_public: z.boolean().default(true),
  error: z.string().nullable(),
  docker_compose_file: z.string().nullable(),
  manifest_version: z.coerce.number().nullable(),
  version: z.string().nullable(),
  runner: z.string().nullable(),
  features: z.array(z.string()).nullable(),
  containers: z.array(ContainerInfoSchema).nullable(),
});

export type CvmContainersStats = z.infer<typeof CvmContainersStatsSchema>;

export const GetCvmContainersStatsRequestSchema = CvmIdSchema;

export type GetCvmContainersStatsRequest = CvmIdInput;

const { action: getCvmContainersStats, safeAction: safeGetCvmContainersStats } = defineAction<
  GetCvmContainersStatsRequest,
  typeof CvmContainersStatsSchema
>(CvmContainersStatsSchema, async (client, request) => {
  const { cvmId } = GetCvmContainersStatsRequestSchema.parse(request);
  return await client.get(`/cvms/${cvmId}/composition`);
});

export { getCvmContainersStats, safeGetCvmContainersStats };
