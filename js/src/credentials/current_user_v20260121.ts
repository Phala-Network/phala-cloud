import { z } from "zod";
import { FeatureFlagSchema } from "../types/feature_flag";

/**
 * Current user schema for API version 2026-01-21 (three-layer structure)
 */

export const UserInfoSchema = z
  .object({
    username: z.string(),
    email: z.string(),
    role: z.enum(["admin", "user"]),
    avatar: z.string(),
    email_verified: z.boolean(),
    totp_enabled: z.boolean(),
    has_backup_codes: z.boolean(),
    flag_has_password: z.boolean(),
  })
  .passthrough();

export type UserInfo = z.infer<typeof UserInfoSchema>;

export const WorkspaceInfoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string().nullable(),
    tier: z.string(),
    role: z.string(),
    avatar: z.string().nullable().optional(),
  })
  .passthrough();

export type WorkspaceInfo = z.infer<typeof WorkspaceInfoSchema>;

export const CreditsInfoSchema = z
  .object({
    balance: z.string().or(z.number()),
    granted_balance: z.string().or(z.number()),
    is_post_paid: z.boolean(),
    outstanding_amount: z.string().or(z.number()).nullable(),
  })
  .passthrough();

export type CreditsInfo = z.infer<typeof CreditsInfoSchema>;

export const CurrentUserV20260121Schema = z
  .object({
    user: UserInfoSchema,
    workspace: WorkspaceInfoSchema,
    credits: CreditsInfoSchema,
    /** Account-scoped feature flags. Empty until the server ships them. */
    features: z.array(FeatureFlagSchema).default([]),
  })
  .passthrough();

export type CurrentUserV20260121 = z.infer<typeof CurrentUserV20260121Schema>;
