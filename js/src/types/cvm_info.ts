/**
 * CVM internal models (not versioned API responses)
 */

import { z } from "zod";
import type { ApiVersion } from "./client";

/**
 * VM schema - matches backend's VM model
 * Used by start/stop/shutdown/restart operations
 * This is an internal model, not a versioned API response
 */
const VMBaseSchema = z.object({
  name: z.string(),
  status: z.string(),
  teepod_id: z.number(),
  teepod: z
    .object({
      id: z.number(),
      name: z.string(),
      region_identifier: z.string().nullable().optional(),
    })
    .optional()
    .nullable(),
  user_id: z.number().optional().nullable(),
  app_id: z.string(),
  vm_uuid: z.string().nullable(),
  instance_id: z.string().nullable(),
  app_url: z.string().optional().nullable(),
  base_image: z.string().optional().nullable(),
  vcpu: z.number(),
  memory: z.number(),
  disk_size: z.number(),
  manifest_version: z.number().optional().nullable(),
  version: z.string().optional().nullable(),
  runner: z.string().optional().nullable(),
  docker_compose_file: z.string().optional().nullable(),
  features: z.array(z.string()).optional().nullable(),
  created_at: z.string(),
  encrypted_env_pubkey: z.string().nullable(),
});

export const VMV20260121Schema = VMBaseSchema.extend({
  id: z.number(),
});
export type VMV20260121 = z.infer<typeof VMV20260121Schema>;

export const VMV20260522Schema = VMBaseSchema.extend({
  id: z.string(),
});
export type VMV20260522 = z.infer<typeof VMV20260522Schema>;

export const VMAnySchema = z.union([VMV20260121Schema, VMV20260522Schema]);
export const VMSchema = VMV20260522Schema;
export type VM = z.infer<typeof VMSchema>;
export type VMForVersion<V extends ApiVersion> = V extends "2026-01-21" ? VMV20260121 : VMV20260522;

export function getVMSchemaForVersion(version: ApiVersion) {
  if (version === "2026-01-21") return VMV20260121Schema;
  return VMV20260522Schema;
}
