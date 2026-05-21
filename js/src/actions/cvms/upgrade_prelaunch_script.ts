import { z } from "zod";
import { CvmIdObjectSchema, CvmIdSchema, refineCvmId } from "../../types/cvm_id";
import { KmsInfoSchema } from "../../types/kms_info";
import { defineAction } from "../../utils/define-action";
import { PhalaCloudError } from "../../utils/errors";

/**
 * Upgrade a CVM's pre-launch script to the latest official version.
 *
 * Replaces the CVM's current pre-launch script with the latest official
 * version maintained by Phala and triggers the standard update workflow.
 * The official script content is held server-side; clients only need to
 * call this endpoint with the CVM ID.
 *
 * For contract-owned KMS (ETHEREUM/BASE), the first call returns
 * `precondition_required` with a compose hash to register on-chain. After
 * registration, retry with `compose_hash` and `transaction_hash`.
 *
 * @example
 * ```typescript
 * import { createClient, upgradePreLaunchScript } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 *
 * // Phase 1: kick off the upgrade
 * const result = await upgradePreLaunchScript(client, { id: 'cvm-123' })
 *
 * if (result.status === 'precondition_required') {
 *   // Register compose hash on-chain, then retry with the headers
 *   const txHash = await registerComposeHashOnChain(result.compose_hash, result.kms_info)
 *   await upgradePreLaunchScript(client, {
 *     id: 'cvm-123',
 *     compose_hash: result.compose_hash,
 *     transaction_hash: txHash,
 *   })
 * }
 * ```
 */

export const UpgradePreLaunchScriptRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    compose_hash: z
      .string()
      .optional()
      .describe("Compose hash for verification (Phase 2, contract-owned KMS only)"),
    transaction_hash: z
      .string()
      .optional()
      .describe("On-chain transaction hash for verification (Phase 2, contract-owned KMS only)"),
  }),
).transform((data) => {
  const { cvmId } = CvmIdSchema.parse(data);
  return {
    cvmId,
    request: {
      compose_hash: data.compose_hash,
      transaction_hash: data.transaction_hash,
    },
    _raw: data,
  };
});

const UpgradePreLaunchScriptInProgressSchema = z.object({
  status: z.literal("in_progress"),
  message: z.string(),
  correlation_id: z.string(),
});

const UpgradePreLaunchScriptPreconditionRequiredSchema = z.object({
  status: z.literal("precondition_required"),
  message: z.string(),
  compose_hash: z.string(),
  app_id: z.string(),
  device_id: z.string(),
  kms_info: KmsInfoSchema,
});

export const UpgradePreLaunchScriptResultSchema = z.union([
  UpgradePreLaunchScriptInProgressSchema,
  UpgradePreLaunchScriptPreconditionRequiredSchema,
]);

export type UpgradePreLaunchScriptRequest = z.input<typeof UpgradePreLaunchScriptRequestSchema>;
export type UpgradePreLaunchScriptResult = z.infer<typeof UpgradePreLaunchScriptResultSchema>;
export type UpgradePreLaunchScriptInProgress = z.infer<typeof UpgradePreLaunchScriptInProgressSchema>;
export type UpgradePreLaunchScriptPreconditionRequired = z.infer<
  typeof UpgradePreLaunchScriptPreconditionRequiredSchema
>;

const { action: upgradePreLaunchScript, safeAction: safeUpgradePreLaunchScript } = defineAction<
  UpgradePreLaunchScriptRequest,
  typeof UpgradePreLaunchScriptResultSchema
>(UpgradePreLaunchScriptResultSchema, async (client, request) => {
  const validated = UpgradePreLaunchScriptRequestSchema.parse(request);

  const headers: Record<string, string> = {};
  if (validated.request.compose_hash) {
    headers["X-Compose-Hash"] = validated.request.compose_hash;
  }
  if (validated.request.transaction_hash) {
    headers["X-Transaction-Hash"] = validated.request.transaction_hash;
  }

  try {
    const response = await client.post<UpgradePreLaunchScriptInProgress>(
      `/cvms/${validated.cvmId}/pre-launch-script/upgrade-to-latest-official`,
      undefined,
      { headers },
    );
    return response;
  } catch (error) {
    if (error instanceof PhalaCloudError && error.status === 465) {
      const detail = error.detail;
      if (detail && typeof detail === "object") {
        const detailObj = detail as Record<string, unknown>;
        const detailsArray = detailObj.details as
          | Array<{ field: string; value: unknown }>
          | undefined;
        if (detailsArray && Array.isArray(detailsArray)) {
          const fieldMap = new Map(detailsArray.map((d) => [d.field, d.value]));
          const composeHash = fieldMap.get("compose_hash");
          const appId = fieldMap.get("app_id");
          const deviceId = fieldMap.get("device_id");
          const kmsInfo = fieldMap.get("kms_info");
          if (composeHash && appId) {
            return {
              status: "precondition_required" as const,
              message: (detailObj.message as string) || "Compose hash verification required",
              compose_hash: composeHash as string,
              app_id: appId as string,
              device_id: (deviceId as string) || "",
              kms_info: kmsInfo,
            };
          }
        }
      }
    }
    throw error;
  }
});

export { upgradePreLaunchScript, safeUpgradePreLaunchScript };
