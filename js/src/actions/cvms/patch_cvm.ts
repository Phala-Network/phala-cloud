import { z } from "zod";
import { CvmIdObjectSchema, CvmIdSchema, refineCvmId } from "../../types/cvm_id";
import { KmsInfoSchema } from "../../types/kms_info";
import { defineAction } from "../../utils/define-action";
import { PhalaCloudError } from "../../utils/errors";

/**
 * Patch CVM (unified update)
 *
 * Applies partial updates to a CVM via the unified PATCH endpoint. Only fields
 * present in the request are applied (true PATCH semantics).
 *
 * For contract-owned KMS (ETHEREUM/BASE), compose-hash-affecting changes trigger
 * a two-phase flow: the first call returns `{ requiresOnChainHash: true, ... }`
 * with the compose hash to register on-chain. After registration, call
 * `confirmCvmPatch` with the compose hash and transaction hash.
 *
 * @example
 * ```typescript
 * import { createClient, patchCvm, confirmCvmPatch, addComposeHash } from '@phala/cloud'
 *
 * const client = createClient()
 *
 * // Simple update (non-on-chain KMS or non-compose-hash-affecting fields)
 * const result = await patchCvm(client, {
 *   id: 'my-cvm',
 *   vcpu: 4,
 *   memory: 8192,
 * })
 * // result.requiresOnChainHash === false
 * console.log(result.correlationId)
 *
 * // On-chain KMS compose update (two-phase)
 * const result = await patchCvm(client, {
 *   id: 'my-cvm',
 *   docker_compose_file: newComposeYaml,
 * })
 *
 * if (result.requiresOnChainHash) {
 *   const tx = await addComposeHash(client, {
 *     composeHash: result.composeHash,
 *     kmsContractAddress: result.kmsInfo.kms_contract_address,
 *     // ... wallet config
 *   })
 *   await confirmCvmPatch(client, {
 *     id: 'my-cvm',
 *     composeHash: result.composeHash,
 *     transactionHash: tx.transactionHash,
 *   })
 * }
 * ```
 */

export const PatchCvmRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    // Compose-hash-affecting fields
    docker_compose_file: z.string().optional(),
    pre_launch_script: z.string().optional(),
    allowed_envs: z.array(z.string()).optional(),

    // Visibility
    public_logs: z.boolean().optional(),
    public_sysinfo: z.boolean().optional(),
    public_tcbinfo: z.boolean().optional(),

    // Non-compose-hash config
    encrypted_env: z.string().optional(),
    user_config: z.string().optional(),
    gpus: z
      .object({
        count: z.number(),
        product_name: z.string().optional(),
      })
      .optional(),

    // Resources
    vcpu: z.number().optional(),
    memory: z.number().optional(),
    disk_size: z.number().optional(),

    // OS image
    image: z.string().optional(),

    // Shutdown behavior
    shutdown_timeout: z.number().optional(),
    allow_force_stop: z.boolean().optional(),

    // Prepare-only mode (for multisig workflows)
    prepareOnly: z.boolean().optional(),
  }),
);

export type PatchCvmRequest = z.input<typeof PatchCvmRequestSchema>;

// Response when update is accepted (202)
const PatchCvmAcceptedSchema = z.object({
  requiresOnChainHash: z.literal(false),
  correlationId: z.string(),
});

// Response when compose hash registration is required (465)
const PatchCvmHashRequiredSchema = z.object({
  requiresOnChainHash: z.literal(true),
  composeHash: z.string(),
  appId: z.string(),
  deviceId: z.string(),
  kmsInfo: KmsInfoSchema,
  commitToken: z.string().optional(),
  commitUrl: z.string().optional(),
  apiCommitUrl: z.string().optional(),
  onchainStatus: z
    .object({
      compose_hash_allowed: z.boolean(),
      device_id_allowed: z.boolean(),
      is_allowed: z.boolean(),
    })
    .optional(),
});

export const PatchCvmResultSchema = z.discriminatedUnion("requiresOnChainHash", [
  PatchCvmAcceptedSchema,
  PatchCvmHashRequiredSchema,
]);

export type PatchCvmResult = z.infer<typeof PatchCvmResultSchema>;
export type PatchCvmAccepted = z.infer<typeof PatchCvmAcceptedSchema>;
export type PatchCvmHashRequired = z.infer<typeof PatchCvmHashRequiredSchema>;

/**
 * Extract structured error details into a key-value map
 */
function extractDetailsMap(detail: unknown): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (!detail || typeof detail !== "object") return map;

  const obj = detail as Record<string, unknown>;
  const details = obj.details;
  if (!Array.isArray(details)) return map;

  for (const item of details) {
    if (item && typeof item === "object" && "field" in item && "value" in item) {
      map[item.field as string] = item.value;
    }
  }
  return map;
}

const { action: patchCvm, safeAction: safePatchCvm } = defineAction<
  PatchCvmRequest,
  typeof PatchCvmResultSchema
>(PatchCvmResultSchema, async (client, request) => {
  const parsed = PatchCvmRequestSchema.parse(request);
  const { cvmId } = CvmIdSchema.parse(parsed);

  // Build request body excluding CVM identifier and meta fields
  const { id, uuid, app_id, instance_id, name, prepareOnly, ...body } = parsed;

  try {
    const response = prepareOnly
      ? await client.patch<{ correlation_id: string }>(`/cvms/${cvmId}`, body, {
          headers: { "X-Prepare-Only": "true" },
        })
      : await client.patch<{ correlation_id: string }>(`/cvms/${cvmId}`, body);
    return {
      requiresOnChainHash: false as const,
      correlationId: response.correlation_id,
    };
  } catch (error) {
    if (error instanceof PhalaCloudError && error.status === 465) {
      const details = extractDetailsMap(error.detail);
      return {
        requiresOnChainHash: true as const,
        composeHash: details.compose_hash as string,
        appId: String(details.app_id),
        deviceId: details.device_id as string,
        kmsInfo: details.kms_info,
        commitToken: details.commit_token as string | undefined,
        commitUrl: details.commit_url as string | undefined,
        apiCommitUrl: details.api_commit_url as string | undefined,
        onchainStatus: details.onchain_status as
          | { compose_hash_allowed: boolean; device_id_allowed: boolean; is_allowed: boolean }
          | undefined,
      };
    }
    throw error;
  }
});

export { patchCvm, safePatchCvm };
