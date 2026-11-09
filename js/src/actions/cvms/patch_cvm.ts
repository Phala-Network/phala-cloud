import { z } from "zod";
import {
  InitScriptSlugSchema,
  PortPolicySchema,
  VerityVolumeSchema,
} from "../../types/app_compose";
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
 * GPU assignment goes in `gpus` as a `GpuConfig` object, not a bare array:
 * `{ gpus: [{ slot, product_id? }], attach_mode? }`. `slot` identifies the
 * device, `product_id` is optional, and `attach_mode: "all"` attaches every
 * GPU on the node instead of the listed slots.
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
 * // Attach GPUs
 * await patchCvm(client, {
 *   id: 'my-cvm',
 *   gpus: { gpus: [{ slot: '0000:3b:00.0' }] },
 * })
 *
 * // Compose fields go in `compose` as a JSON Merge Patch; null removes a key
 * await patchCvm(client, {
 *   id: 'my-cvm',
 *   compose: { secure_time: true, requirements: { health_check: null } },
 *   init_scripts: ['docker_cleanup'],
 *   confirm_data_wipe: true, // docker_cleanup wipes container stores on every boot
 * })
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

/**
 * GPU assignment for a CVM update. `gpus` lists the device slots to attach
 * (`product_id` is optional), and `attach_mode: "all"` attaches every GPU on
 * the node instead of the listed slots.
 */
export const PatchCvmGpuConfigSchema = z.object({
  gpus: z.array(
    z.object({
      slot: z.string(),
      product_id: z.string().optional(),
    }),
  ),
  attach_mode: z.string().optional(),
});

export type PatchCvmGpuConfig = z.input<typeof PatchCvmGpuConfigSchema>;

/**
 * `requirements` keys a PATCH may set; `null` removes the key. `gpu_policy` is
 * not patchable: the stored value is kept.
 */
export const ComposeRequirementsPatchSchema = z
  .object({
    /** Format the data disk on every boot (OS >= 0.6.3). Turning it on needs `confirm_data_wipe`. */
    ephemeral_data_disk: z.boolean().nullable().optional(),
    health_check: z.boolean().nullable().optional(),
    health_status_file: z.string().nullable().optional(),
    /** Must be the hash of the app's launch token. */
    launch_token_hash: z.string().nullable().optional(),
    platforms: z.array(z.string()).nullable().optional(),
    tdx_measure_acpi_tables: z.boolean().nullable().optional(),
  })
  .passthrough();

/**
 * JSON Merge Patch of the CVM's app compose: a sent key sets the value, a sent
 * `null` removes the key, an absent key is unchanged. `requirements` merges per key.
 */
export const ComposePatchSchema = z
  .object({
    secure_time: z.boolean().nullable().optional(),
    swap_size: z.string().nullable().optional(),
    storage_discard: z.boolean().nullable().optional(),
    /** Only with the nerdctl-compose runner. */
    snapshotter: z.enum(["overlayfs", "stargz"]).nullable().optional(),
    /** Disabling removes the instance from the gateway after the update. */
    gateway_enabled: z.boolean().nullable().optional(),
    port_policy: PortPolicySchema.nullable().optional(),
    event_log_version: z
      .union([z.literal(1), z.literal(2)])
      .nullable()
      .optional(),
    requirements: ComposeRequirementsPatchSchema.nullable().optional(),

    // Fixed when the CVM is created: the current value passes, any other is rejected.
    kms_enabled: z.boolean().nullable().optional(),
    key_provider: z.enum(["none", "kms", "local", "tpm"]).nullable().optional(),
    key_provider_id: z.string().nullable().optional(),
    local_key_provider_enabled: z.boolean().nullable().optional(),
    manifest_version: z.union([z.number(), z.string()]).nullable().optional(),
    no_instance_id: z.boolean().nullable().optional(),
    runner: z.string().nullable().optional(),
    storage_fs: z.enum(["ext4", "zfs"]).nullable().optional(),
    verity_volumes: z.array(VerityVolumeSchema).nullable().optional(),
    tproxy_enabled: z.boolean().nullable().optional(),
    features: z.array(z.string()).nullable().optional(),
  })
  .passthrough();

export type ComposePatch = z.input<typeof ComposePatchSchema>;

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

    // JSON Merge Patch of the app compose (see ComposePatchSchema)
    compose: ComposePatchSchema.optional(),
    // Platform init scripts this CVM runs, replacing the current set
    init_scripts: z.array(InitScriptSlugSchema).optional(),
    // Raw guest init scripts, replacing the current set. System admins only.
    init_script: z.array(z.string()).optional(),
    // Confirms turning on docker_cleanup or requirements.ephemeral_data_disk,
    // which erase data on every boot
    confirm_data_wipe: z.boolean().optional(),

    // Non-compose-hash config
    encrypted_env: z.string().optional(),
    user_config: z.string().optional(),
    gpus: PatchCvmGpuConfigSchema.optional(),

    // Resources
    vcpu: z.number().optional(),
    memory: z.number().optional(),
    disk_size: z.number().optional(),
    instance_type: z.string().optional(),

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
      ? await client.patch<{ correlation_id?: string; status?: string }>(`/cvms/${cvmId}`, body, {
          headers: { "X-Prepare-Only": "true" },
        })
      : await client.patch<{ correlation_id?: string; status?: string }>(`/cvms/${cvmId}`, body);
    return {
      requiresOnChainHash: false as const,
      // no_change (unchanged compose) has no correlation_id; CLI still requires a string.
      correlationId: response.correlation_id ?? "",
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
