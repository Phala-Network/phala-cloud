import { z } from "zod";

/**
 * Feature flag entry returned by bootstrap endpoints:
 * - `GET /auth/me` (API version 2026-01-21) carries account-scoped flags.
 * - `GET /workspaces/{slug}` carries workspace-scoped flags plus the
 *   viewer's account-scoped flags for browser-session requests.
 */
export const FeatureFlagSchema = z
  .object({
    name: z.string(),
    enabled: z.boolean(),
    options: z.array(z.string()).nullable().optional(),
    reason: z.string().nullable().optional(),
    action_text: z.string().nullable().optional(),
    action_url: z.string().nullable().optional(),
    metadata: z.record(z.any()).nullable().optional(),
  })
  .passthrough();

export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;
