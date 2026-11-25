import { z } from "zod";
import { CvmIdSchema, type CvmIdInput } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";

export const CvmInitScriptSchema = z.object({
  /** Name of an init script provided by Phala Cloud. Any string, so new names still parse. */
  slug: z.string(),
  /** The CVM's current compose runs this script. */
  selected: z.boolean(),
  /** The caller may select this script for this CVM's compose and OS image. */
  selectable: z.boolean(),
  /** Why the script is not selectable; null when it is. */
  reason: z.string().nullable().optional(),
});

export const CvmInitScriptsSchema = z.object({
  items: z.array(CvmInitScriptSchema),
  has_custom_scripts: z.boolean(),
});

export type CvmInitScript = z.infer<typeof CvmInitScriptSchema>;
export type CvmInitScripts = z.infer<typeof CvmInitScriptsSchema>;

export const GetCvmInitScriptsRequestSchema = CvmIdSchema;

export type GetCvmInitScriptsRequest = CvmIdInput;

/**
 * List the init scripts Phala Cloud provides for a CVM
 *
 * Returns every provided init script in the order Phala Cloud runs them: whether
 * the CVM's current compose runs it, and whether the caller can select it (with
 * the reason when not). has_custom_scripts is true when the compose also runs
 * scripts set by Phala Cloud support. Change the selection with
 * `patchCvm({ init_scripts })`.
 *
 * @example
 * ```typescript
 * import { createClient, getCvmInitScripts } from '@phala/cloud'
 *
 * const client = createClient()
 * const { items } = await getCvmInitScripts(client, { id: 'my-cvm' })
 * ```
 */
const { action: getCvmInitScripts, safeAction: safeGetCvmInitScripts } = defineAction<
  GetCvmInitScriptsRequest,
  typeof CvmInitScriptsSchema
>(CvmInitScriptsSchema, async (client, request) => {
  const { cvmId } = GetCvmInitScriptsRequestSchema.parse(request);
  return await client.get(`/cvms/${cvmId}/init-scripts`);
});

export { getCvmInitScripts, safeGetCvmInitScripts };
