import { z } from "zod";
import { InitScriptSlugSchema } from "../../types/app_compose";
import { CvmIdSchema, type CvmIdInput } from "../../types/cvm_id";
import { defineAction } from "../../utils/define-action";

export const CvmInitScriptSchema = z.object({
  slug: InitScriptSlugSchema,
  /** The CVM's current compose runs this script. */
  selected: z.boolean(),
  /** The caller may select this script for this CVM's compose and OS image. */
  selectable: z.boolean(),
  /** Why the script is not selectable; null when it is. */
  reason: z.string().nullable().optional(),
});

export const CvmInitScriptsSchema = z.object({
  items: z.array(CvmInitScriptSchema),
});

export type CvmInitScript = z.infer<typeof CvmInitScriptSchema>;
export type CvmInitScripts = z.infer<typeof CvmInitScriptsSchema>;

export const GetCvmInitScriptsRequestSchema = CvmIdSchema;

export type GetCvmInitScriptsRequest = CvmIdInput;

/**
 * List the platform init scripts of a CVM
 *
 * Returns every platform init script in its fixed run order: whether the CVM's
 * current compose runs it, and whether the caller could select it (with the
 * reason when not). Change the selection with `patchCvm({ init_scripts })`.
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
