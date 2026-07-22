import { z } from "zod";
import { defineAction } from "../../utils/define-action";

/**
 * CVM status schema for batch status API
 *
 * This is different from CvmStateSchema which is used for /cvms/{id}/state endpoint.
 * CvmStatusSchema is used for /status/batch endpoint which returns status
 * information optimized for polling.
 */
export const CvmResourceUsageSchema = z.object({
  cpu_percent: z.number().nullable().optional(),
  memory_used_bytes: z.number().nullable().optional(),
  memory_total_bytes: z.number().nullable().optional(),
  egress_bytes: z.number().nullable().optional(),
});

export type CvmResourceUsage = z.infer<typeof CvmResourceUsageSchema>;

export const CvmStatusSchema = z.object({
  vm_uuid: z.string(),
  status: z.string(),
  uptime: z.string().nullable().optional(),
  in_progress: z.boolean(),
  boot_progress: z.string().nullable().optional(),
  boot_error: z.string().nullable().optional(),
  shutdown_progress: z.string().nullable().optional(),
  events: z
    .array(
      z.object({
        event: z.string(),
        body: z.string(),
        timestamp: z.number(),
      }),
    )
    .default([]),
  operation: z
    .object({
      type: z.string().nullable().optional(),
      phase: z.string().nullable().optional(),
      started_at: z.string().nullable().optional(),
      correlation_id: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  resource_usage: CvmResourceUsageSchema.nullable().optional(),
});

export type CvmStatus = z.infer<typeof CvmStatusSchema>;

/**
 * Batch status response: Record<vm_uuid, CvmStatus>
 */
export const GetCvmStatusBatchResponseSchema = z.record(z.string(), CvmStatusSchema);

export type GetCvmStatusBatchResponse = z.infer<typeof GetCvmStatusBatchResponseSchema>;

export const GetCvmStatusBatchRequestSchema = z.object({
  vmUuids: z.array(z.string()),
});

export type GetCvmStatusBatchRequest = z.infer<typeof GetCvmStatusBatchRequestSchema>;

/**
 * Get batch CVM status for multiple CVMs
 *
 * This action retrieves status information for multiple CVMs in a single request.
 * Optimized for polling scenarios where you need to monitor multiple CVMs.
 *
 * @example
 * ```typescript
 * import { createClient, getCvmStatusBatch } from '@phala/cloud'
 *
 * const client = createClient();
 * const statuses = await getCvmStatusBatch(client, {
 *   vmUuids: ['uuid-1', 'uuid-2', 'uuid-3']
 * });
 *
 * // Check status of each CVM
 * for (const [vmUuid, status] of Object.entries(statuses)) {
 *   console.log(`${vmUuid}: ${status.status}, in_progress: ${status.in_progress}`);
 * }
 * ```
 *
 * ## Safe Version
 *
 * Use `safeGetCvmStatusBatch` for error handling without exceptions:
 *
 * ```typescript
 * const result = await safeGetCvmStatusBatch(client, { vmUuids: ['uuid-1'] });
 * if (result.success) {
 *   console.log('Statuses:', result.data);
 * } else {
 *   console.error('Failed:', result.error.message);
 * }
 * ```
 */
const { action: getCvmStatusBatch, safeAction: safeGetCvmStatusBatch } = defineAction<
  GetCvmStatusBatchRequest,
  typeof GetCvmStatusBatchResponseSchema
>(GetCvmStatusBatchResponseSchema, async (client, request) => {
  const { vmUuids } = GetCvmStatusBatchRequestSchema.parse(request);
  return await client.post("/status/batch", { vm_uuids: vmUuids });
});

export { getCvmStatusBatch, safeGetCvmStatusBatch };
