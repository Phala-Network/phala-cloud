import { z } from "zod";
import { defineAction } from "../../utils/define-action";
import { IsAllowedResultSchema, type IsAllowedResult } from "../cvms/check_cvm_is_allowed";

export const CheckAppIsAllowedRequestSchema = z.object({
  appId: z.string().min(1),
  compose_hash: z.string(),
  node_id: z.number().optional(),
  device_id: z.string().optional(),
  chain_id: z.number().optional(),
});

export type CheckAppIsAllowedRequest = z.infer<typeof CheckAppIsAllowedRequestSchema>;

/**
 * Check if a deployment is allowed by an on-chain DStack App contract.
 *
 * Supports pure contract query (no DB) when all parameters including chain_id are provided.
 *
 * @param client - The API client
 * @param request - Request parameters
 * @param request.appId - App contract address
 * @param request.compose_hash - Compose hash to check
 * @param request.node_id - Node ID (resolves device_id from DB)
 * @param request.device_id - Device ID (hex, direct)
 * @param request.chain_id - Chain ID for RPC URL resolution
 * @returns On-chain allowance check result
 */
const { action: checkAppIsAllowed, safeAction: safeCheckAppIsAllowed } = defineAction<
  CheckAppIsAllowedRequest,
  typeof IsAllowedResultSchema,
  IsAllowedResult
>(IsAllowedResultSchema, async (client, request) => {
  const { appId, ...body } = CheckAppIsAllowedRequestSchema.parse(request);
  return await client.post(`/apps/${appId}/is-allowed`, body);
});

export { checkAppIsAllowed, safeCheckAppIsAllowed };
