import { z } from "zod";
import { CvmIdSchema, type CvmIdInput } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";

/**
 * Get pre-launch script upgrade status
 *
 * Reports whether a CVM is running an unmodified official pre-launch script
 * and whether a newer official version is available. The frontend uses
 * `can_upgrade` to decide whether to surface the one-click upgrade banner.
 *
 * @example
 * ```typescript
 * import { createClient, getPreLaunchScriptUpgradeStatus } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 * const status = await getPreLaunchScriptUpgradeStatus(client, { id: 'cvm-123' })
 *
 * if (status.can_upgrade) {
 *   // CVM is on an older official script; offer the upgrade
 * }
 * ```
 */

export const GetPreLaunchScriptUpgradeStatusRequestSchema = CvmIdSchema;

export type GetPreLaunchScriptUpgradeStatusRequest = CvmIdInput;

export const PreLaunchScriptUpgradeStatusSchema = z.object({
  current_hash: z.string().nullable(),
  latest_official_hash: z.string(),
  is_official: z.boolean(),
  is_latest: z.boolean(),
  can_upgrade: z.boolean(),
});

export type PreLaunchScriptUpgradeStatus = z.infer<typeof PreLaunchScriptUpgradeStatusSchema>;

const { action: getPreLaunchScriptUpgradeStatus, safeAction: safeGetPreLaunchScriptUpgradeStatus } =
  defineAction<GetPreLaunchScriptUpgradeStatusRequest, typeof PreLaunchScriptUpgradeStatusSchema>(
    PreLaunchScriptUpgradeStatusSchema,
    async (client, request) => {
      const { cvmId } = GetPreLaunchScriptUpgradeStatusRequestSchema.parse(request);
      return await client.get(`/cvms/${cvmId}/pre-launch-script/upgrade-status`);
    },
  );

export { getPreLaunchScriptUpgradeStatus, safeGetPreLaunchScriptUpgradeStatus };
