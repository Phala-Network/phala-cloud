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
      code: z.ZodIssueCode.custom,
      message: `Combined size of docker_compose_file and pre_launch_script must not exceed ${maxKB}KB (current: ${currentKB}KB)`,
    });
  }
}

export const LooseAppComposeSchema = z
  .object({
    allowed_envs: z.array(z.string()).optional(),
    docker_compose_file: z.string(),
    features: z.array(z.string()).optional(),
    name: z.string().optional(),
    manifest_version: z.number().optional(),
    kms_enabled: z.boolean().optional(),
    public_logs: z.boolean().optional(),
    public_sysinfo: z.boolean().optional(),
    tproxy_enabled: z.boolean().optional(),
    storage_fs: z.enum(["ext4", "zfs"]).optional(),
    pre_launch_script: z.string().optional(),
    env_pubkey: z.string().optional(),
    salt: z.string().optional().nullable(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    validateComposePayloadSize(data.docker_compose_file, data.pre_launch_script, ctx);
  });

export type LooseAppCompose = z.infer<typeof LooseAppComposeSchema>;
