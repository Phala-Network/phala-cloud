import { z } from "zod";
import { CvmIdObjectSchema, CvmIdSchema, refineCvmId } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";
import { PhalaCloudError } from "../../utils/errors";
import { PatchCvmResultSchema, type PatchCvmResult } from "./patch_cvm";

export const PutCvmInitScriptsRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({
    scripts: z.array(z.string()).max(5),
    prepareOnly: z.boolean().optional(),
  }),
);

export type PutCvmInitScriptsRequest = z.input<typeof PutCvmInitScriptsRequestSchema>;

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

/**
 * Replace a CVM's raw init scripts
 *
 * System admins only. An empty list clears them. Same on-chain two-phase
 * result as `patchCvm`.
 *
 * @example
 * ```typescript
 * import { createClient, putCvmInitScripts } from '@phala/cloud'
 *
 * const client = createClient()
 * await putCvmInitScripts(client, {
 *   id: 'my-cvm',
 *   scripts: ['echo custom\\n'],
 * })
 * ```
 */
const { action: putCvmInitScripts, safeAction: safePutCvmInitScripts } = defineAction<
  PutCvmInitScriptsRequest,
  typeof PatchCvmResultSchema
>(PatchCvmResultSchema, async (client, request) => {
  const parsed = PutCvmInitScriptsRequestSchema.parse(request);
  const { cvmId } = CvmIdSchema.parse(parsed);

  try {
    const response = parsed.prepareOnly
      ? await client.put<{ correlation_id?: string; status?: string }>(
          `/cvms/${cvmId}/init-scripts`,
          { scripts: parsed.scripts },
          { headers: { "X-Prepare-Only": "true" } },
        )
      : await client.put<{ correlation_id?: string; status?: string }>(
          `/cvms/${cvmId}/init-scripts`,
          { scripts: parsed.scripts },
        );
    return {
      requiresOnChainHash: false as const,
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

export { putCvmInitScripts, safePutCvmInitScripts };
export type { PatchCvmResult as PutCvmInitScriptsResult };
