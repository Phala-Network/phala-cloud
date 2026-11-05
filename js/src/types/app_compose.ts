import { z } from "zod";

/** Maximum combined byte size of docker_compose_file + pre_launch_script (200KB) */
export const MAX_COMPOSE_PAYLOAD_BYTES = 200 * 1024;

/**
 * Validate that combined byte size of docker_compose_file and pre_launch_script
 * does not exceed MAX_COMPOSE_PAYLOAD_BYTES.
 */
export function validateComposePayloadSize(
  dockerComposeFile: string | undefined,
  preLaunchScript: string | undefined,
  ctx: z.RefinementCtx,
): void {
  const encoder = new TextEncoder();
  const composeSize = dockerComposeFile ? encoder.encode(dockerComposeFile).byteLength : 0;
  const scriptSize = preLaunchScript ? encoder.encode(preLaunchScript).byteLength : 0;
  const totalSize = composeSize + scriptSize;
  if (totalSize > MAX_COMPOSE_PAYLOAD_BYTES) {
    const maxKB = MAX_COMPOSE_PAYLOAD_BYTES / 1024;
    const currentKB = Math.ceil(totalSize / 1024);
    ctx.addIssue({
      code: "custom",
      message: `Combined size of docker_compose_file and pre_launch_script must not exceed ${maxKB}KB (current: ${currentKB}KB)`,
    });
  }
}

/**
 * Gateway port policy (dstack >= 0.5.9): which guest ports the gateway forwards,
 * and whether each one uses the PROXY protocol. Omitted fields take the
 * backend defaults: no ports, restrict_mode false, pp false.
 */
export const PortPolicySchema = z.object({
  ports: z
    .array(
      z.object({
        port: z.number().int().min(1).max(65535),
        pp: z.boolean().optional(),
      }),
    )
    .optional(),
  restrict_mode: z.boolean().optional(),
});

/**
 * Guest-enforced GPU policy (`requirements.gpu_policy`). Setting or changing it
 * needs a feature flag on create; the unified PATCH keeps the stored value.
 */
export const GpuPolicySchema = z
  .object({
    allow_debug: z.boolean().optional(),
    allow_devtools: z.boolean().optional(),
    allow_insecure_boot: z.boolean().optional(),
    attest_gpu: z.boolean().optional(),
    rego: z.string().optional(),
  })
  .passthrough();

/**
 * Guest requirements (dstack >= 0.6.0). Only the keys that are present are
 * measured: an explicit default value and an absent key hash differently.
 */
export const ComposeRequirementsSchema = z
  .object({
    /** Format the data disk on every boot (dstack OS >= 0.6.3). */
    ephemeral_data_disk: z.boolean().optional(),
    gpu_policy: GpuPolicySchema.optional(),
    health_check: z.boolean().optional(),
    health_status_file: z.string().optional(),
    /** Hex sha256 of the app launch token; must match the app's token. */
    launch_token_hash: z.string().optional(),
    platforms: z.array(z.string()).optional(),
    tdx_measure_acpi_tables: z.boolean().optional(),
  })
  .passthrough();

export type ComposeRequirements = z.infer<typeof ComposeRequirementsSchema>;

/** Read-only dm-verity volume (dstack >= 0.6.0). */
export const VerityVolumeSchema = z.object({
  source: z.string(),
  target: z.string(),
  verity_root: z.string(),
});

export const ComposeRunnerSchema = z.enum(["docker-compose", "bash", "nerdctl-compose"]);
export type ComposeRunner = z.infer<typeof ComposeRunnerSchema>;

/** Platform init script slugs, in Phala Cloud's fixed run order. */
export const InitScriptSlugSchema = z.enum(["docker_cleanup", "env_merge"]);
export type InitScriptSlug = z.infer<typeof InitScriptSlugSchema>;

export const LooseAppComposeSchema = z
  .object({
    allowed_envs: z.array(z.string()).optional(),
    // Absent for the bash runner, which runs bash_script instead.
    docker_compose_file: z.string().optional(),
    bash_script: z.string().nullable().optional(),
    features: z.array(z.string()).optional(),
    name: z.string().optional(),
    // dstack serialises manifest_version as a string ("3") from manifest v3 on;
    // numeric is legacy-only. Keep the value as sent: this schema also builds
    // update payloads, and rewriting "3" as 3 yields a compose dstack rejects.
    manifest_version: z.union([z.number(), z.string()]).optional(),
    runner: z.string().optional(),
    kms_enabled: z.boolean().optional(),
    gateway_enabled: z.boolean().optional(),
    tproxy_enabled: z.boolean().optional(),
    local_key_provider_enabled: z.boolean().optional(),
    key_provider: z.enum(["none", "kms", "local", "tpm"]).optional(),
    key_provider_id: z.string().optional(),
    public_logs: z.boolean().optional(),
    public_sysinfo: z.boolean().optional(),
    public_tcbinfo: z.boolean().optional(),
    no_instance_id: z.boolean().optional(),
    secure_time: z.boolean().optional(),
    port_policy: PortPolicySchema.optional(),
    storage_fs: z.enum(["ext4", "zfs"]).optional(),
    swap_size: z.string().optional(),
    pre_launch_script: z.string().optional(),
    env_pubkey: z.string().optional(),
    salt: z.string().optional().nullable(),
    requirements: ComposeRequirementsSchema.nullable().optional(),
    // dstack >= 0.6.0 fields; null or absent means unset.
    storage_discard: z.boolean().nullable().optional(),
    event_log_version: z
      .union([z.literal(1), z.literal(2)])
      .nullable()
      .optional(),
    snapshotter: z.enum(["overlayfs", "stargz"]).nullable().optional(),
    verity_volumes: z.array(VerityVolumeSchema).nullable().optional(),
    /**
     * Platform init scripts, managed by Phala Cloud (read-only; select them with
     * `init_scripts` slugs). A string or absent below dstack OS 0.6.0, a list from 0.6.0.
     */
    init_script: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    validateComposePayloadSize(data.docker_compose_file, data.pre_launch_script, ctx);
  });

export type LooseAppCompose = z.infer<typeof LooseAppComposeSchema>;
