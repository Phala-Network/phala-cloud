import { z } from "zod";
import { defineSimpleAction } from "../../utils/define-action";

export const ManagedInitScriptSchema = z
  .object({
    /** Name of an init script provided by Phala Cloud. Any string, so new names still parse. */
    name: z.string(),
    version: z.string(),
    script: z.string(),
    /** sha256 hex of script. */
    hash: z.string(),
    request_field: z.string(),
    min_os_version: z.string(),
  })
  .passthrough();

export const ManagedInitScriptsSchema = z
  .object({
    items: z.array(ManagedInitScriptSchema),
  })
  .passthrough();

export type ManagedInitScript = z.infer<typeof ManagedInitScriptSchema>;
export type ManagedInitScripts = z.infer<typeof ManagedInitScriptsSchema>;

/**
 * List every init script Phala Cloud provides
 *
 * Public endpoint; needs no auth. Returns the script text and hash that
 * provisioning injects. Phala Cloud owns the names; callers can select them
 * but cannot supply their own scripts.
 *
 * @example
 * ```typescript
 * import { createClient, getManagedInitScripts } from '@phala/cloud'
 *
 * const client = createClient()
 * const { items } = await getManagedInitScripts(client)
 * ```
 */
const { action: getManagedInitScripts, safeAction: safeGetManagedInitScripts } = defineSimpleAction(
  ManagedInitScriptsSchema,
  async (client) => {
    return await client.get("/managed-init-scripts");
  },
);

export { getManagedInitScripts, safeGetManagedInitScripts };
