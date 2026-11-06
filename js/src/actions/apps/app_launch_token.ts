import { z } from "zod";
import { defineAction } from "../../utils/define-action";

export const AppLaunchTokenSchema = z.object({
  /** The app's new launch token. Returned only here, once. */
  launch_token: z.string(),
  /** Value for `requirements.launch_token_hash` of every CVM of the app. */
  launch_token_hash: z.string(),
});

export type AppLaunchToken = z.infer<typeof AppLaunchTokenSchema>;

export const SetAppLaunchTokenRequestSchema = z.object({
  appId: z.string().min(1),
  /** Token to set (at least 32 bytes). Omit to have Phala Cloud generate one. */
  launchToken: z.string().optional(),
});

export type SetAppLaunchTokenRequest = z.input<typeof SetAppLaunchTokenRequestSchema>;

/**
 * Set or rotate the app launch token
 *
 * Generates a token when `launchToken` is omitted, and returns the plaintext
 * and its hash once. CVMs keep booting with their current compose: update each
 * CVM's `requirements.launch_token_hash` to the returned hash before its next
 * boot, or it fails closed. Phala Cloud and the node operator can read the
 * token, so it protects only against parties who know the public compose.
 *
 * @example
 * ```typescript
 * import { createClient, setAppLaunchToken, patchCvm } from '@phala/cloud'
 *
 * const client = createClient()
 * const { launch_token_hash } = await setAppLaunchToken(client, { appId: 'abc123' })
 * await patchCvm(client, {
 *   id: 'my-cvm',
 *   compose: { requirements: { launch_token_hash } },
 * })
 * ```
 */
const { action: setAppLaunchToken, safeAction: safeSetAppLaunchToken } = defineAction<
  SetAppLaunchTokenRequest,
  typeof AppLaunchTokenSchema
>(AppLaunchTokenSchema, async (client, request) => {
  const { appId, launchToken } = SetAppLaunchTokenRequestSchema.parse(request);
  return await client.post(
    `/apps/${appId}/launch-token`,
    launchToken === undefined ? {} : { launch_token: launchToken },
  );
});

export const ClearAppLaunchTokenRequestSchema = z.object({
  appId: z.string().min(1),
});

export type ClearAppLaunchTokenRequest = z.input<typeof ClearAppLaunchTokenRequestSchema>;

/**
 * Clear the app launch token
 *
 * Remove `requirements.launch_token_hash` from every CVM of the app first: a
 * CVM whose compose still carries it fails closed at its next boot.
 *
 * @example
 * ```typescript
 * import { createClient, clearAppLaunchToken } from '@phala/cloud'
 *
 * const client = createClient()
 * await clearAppLaunchToken(client, { appId: 'abc123' })
 * ```
 */
const { action: clearAppLaunchToken, safeAction: safeClearAppLaunchToken } = defineAction<
  ClearAppLaunchTokenRequest,
  z.ZodVoid
>(z.void(), async (client, request) => {
  const { appId } = ClearAppLaunchTokenRequestSchema.parse(request);
  await client.delete(`/apps/${appId}/launch-token`);
  return undefined;
});

export { setAppLaunchToken, safeSetAppLaunchToken, clearAppLaunchToken, safeClearAppLaunchToken };
