import { z } from "zod";
import { CvmIdSchema, type CvmIdInput } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";

export const CvmUserConfigSchema = z.object({
  hostname: z.string().nullable().optional(),
  ssh_authorized_keys: z.array(z.string()).default([]),
  default_gateway_domain: z.string().nullable().optional(),
  // The app's launch token; set only when the CVM's compose carries
  // requirements.launch_token_hash.
  launch_token: z.string().nullable().optional(),
});

export type CvmUserConfig = z.infer<typeof CvmUserConfigSchema>;

export const GetCvmUserConfigRequestSchema = CvmIdSchema;

export type GetCvmUserConfigRequest = CvmIdInput;

/**
 * Get the runtime user_config of a CVM
 *
 * Reads the live user_config stored in Teepod for the given CVM.
 * Contains the hostname, injected SSH authorized keys, and default gateway domain
 * set at launch time.
 *
 * @example
 * ```typescript
 * import { createClient, getCvmUserConfig } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 * const config = await getCvmUserConfig(client, { cvmId: 'app_123' })
 * console.log(config.hostname)
 * console.log(config.ssh_authorized_keys) // string[]
 * ```
 *
 * ## Safe Version
 *
 * ```typescript
 * const result = await safeGetCvmUserConfig(client, { cvmId: 'app_123' })
 * if (result.success) {
 *   console.log(result.data.ssh_authorized_keys.length, 'keys')
 * } else {
 *   console.error(result.error.message)
 * }
 * ```
 */
const { action: getCvmUserConfig, safeAction: safeGetCvmUserConfig } = defineAction<
  GetCvmUserConfigRequest,
  typeof CvmUserConfigSchema
>(CvmUserConfigSchema, async (client, request) => {
  const { cvmId } = GetCvmUserConfigRequestSchema.parse(request);
  return await client.get(`/cvms/${cvmId}/user_config`);
});

export { getCvmUserConfig, safeGetCvmUserConfig };
