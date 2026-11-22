import { z } from "zod";
import { defineAction } from "../../utils/define-action";

export const GetAppPendingUpdatesRequestSchema = z.object({ appId: z.string().min(1) });
export type GetAppPendingUpdatesRequest = z.input<typeof GetAppPendingUpdatesRequestSchema>;

export const AppPendingUpdateSchema = z.object({
  vm_uuid: z.string(),
  compose_hash: z.string(),
  // Registration at the latest block does not imply the KMS honors the hash yet.
  on_chain: z.boolean(),
  instance_name: z.string().nullish(),
});
export type AppPendingUpdate = z.infer<typeof AppPendingUpdateSchema>;

export const RegisteredUnusedComposeHashSchema = z.object({
  compose_hash: z.string(),
  state: z.enum(["pending", "unused"]),
});
export type RegisteredUnusedComposeHash = z.infer<typeof RegisteredUnusedComposeHashSchema>;

export const AppPendingUpdatesSchema = z.object({
  items: z.array(AppPendingUpdateSchema),
  registered_unused: z.array(RegisteredUnusedComposeHashSchema).default([]),
});
export type AppPendingUpdates = z.infer<typeof AppPendingUpdatesSchema>;

/**
 * Read the app's pending updates and registered compose hashes not used by a live CVM.
 * Only hashes marked `unused` are candidates for revocation. This list is a snapshot;
 * reading it does not sign a transaction or change an on-chain registration.
 */
const { action: getAppPendingUpdates, safeAction: safeGetAppPendingUpdates } = defineAction<
  GetAppPendingUpdatesRequest,
  typeof AppPendingUpdatesSchema
>(AppPendingUpdatesSchema, (client, request) => {
  const { appId } = GetAppPendingUpdatesRequestSchema.parse(request);
  return client.get(`/apps/${encodeURIComponent(appId)}/pending-updates`);
});

export { getAppPendingUpdates, safeGetAppPendingUpdates };
