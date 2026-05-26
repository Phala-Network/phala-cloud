/**
 * CVM Info schemas for API version 2025-10-28
 *
 * This is the legacy format with `node.region_identifier` structure.
 */

import { z } from "zod";
import { KmsInfoSchema } from "./kms_info";

const TableIdSchema = z.union([z.number(), z.string()]);

export const VmInfoV20251028Schema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  uptime: z.string(),
  app_url: z.string().nullable(),
  app_id: z.string(),
  instance_id: z.string().nullable(),
  configuration: z.any().optional(),
  exited_at: z.string().nullable(),
  boot_progress: z.string().nullable(),
  boot_error: z.string().nullable(),
  shutdown_progress: z.string().nullable(),
  image_version: z.string().nullable(),
});
export type VmInfoV20251028 = z.infer<typeof VmInfoV20251028Schema>;

export const ManagedUserV20251028Schema = z.object({
  id: TableIdSchema,
  username: z.string(),
});
export type ManagedUserV20251028 = z.infer<typeof ManagedUserV20251028Schema>;

export const CvmNodeV20251028Schema = z.object({
  id: z.number(),
  name: z.string(),
  region_identifier: z.string().nullable().optional(),
});
export type CvmNodeV20251028 = z.infer<typeof CvmNodeV20251028Schema>;

export const MachineInfoV20251028Schema = z.object({
  vcpu: z.number(),
  memory: z.number(),
  disk_size: z.number(),
  gpu_count: z.number().default(0),
});
export type MachineInfoV20251028 = z.infer<typeof MachineInfoV20251028Schema>;

export const CvmNetworkUrlsV20251028Schema = z.object({
  app: z.string(),
  instance: z.string(),
});
export type CvmNetworkUrlsV20251028 = z.infer<typeof CvmNetworkUrlsV20251028Schema>;

export const CvmInfoV20251028Schema = z.object({
  hosted: VmInfoV20251028Schema,
  name: z.string(),
  managed_user: ManagedUserV20251028Schema.nullable(),
  node: CvmNodeV20251028Schema.nullable(),
  listed: z.boolean().default(false),
  status: z.string(),
  in_progress: z.boolean().default(false),
  dapp_dashboard_url: z.string().nullable(),
  syslog_endpoint: z.string().nullable(),
  allow_upgrade: z.boolean().default(false),
  project_id: z.string().nullable(),
  project_type: z.string().nullable(),
  billing_period: z.string().nullable(),
  kms_info: KmsInfoSchema.nullable(),
  vcpu: z.number().nullable(),
  memory: z.number().nullable(),
  disk_size: z.number().nullable(),
  gateway_domain: z.string().nullable(),
  public_urls: z.array(CvmNetworkUrlsV20251028Schema),
  machine_info: MachineInfoV20251028Schema.nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
export type CvmInfoV20251028 = z.infer<typeof CvmInfoV20251028Schema>;

export const CvmDetailV20251028Schema = z.object({
  id: TableIdSchema,
  name: z.string(),
  status: z.string(),
  in_progress: z.boolean().optional().default(false),
  teepod_id: z.number().nullable(),
  teepod: CvmNodeV20251028Schema.optional().nullable(),
  app_id: z.string(),
  vm_uuid: z.string().nullable(),
  instance_id: z.string().nullable(),
  vcpu: z.number(),
  memory: z.number(),
  disk_size: z.number(),
  base_image: z.string().nullable(),
  encrypted_env_pubkey: z.string().nullable(),
  listed: z.boolean().optional().default(false),
  project_id: z.string().optional().nullable(),
  project_type: z.string().optional().nullable(),
  instance_type: z.string().optional().nullable(),
  public_sysinfo: z.boolean().optional().default(false),
  public_logs: z.boolean().optional().default(false),
  dapp_dashboard_url: z.string().optional().nullable(),
  syslog_endpoint: z.string().optional().nullable(),
  kms_info: KmsInfoSchema.optional().nullable(),
  contract_address: z.string().optional().nullable(),
  deployer_address: z.string().optional().nullable(),
  scheduled_delete_at: z.string().optional().nullable(),
  public_urls: z.array(CvmNetworkUrlsV20251028Schema).optional().default([]),
  gateway_domain: z.string().optional().nullable(),
  machine_info: MachineInfoV20251028Schema.optional().nullable(),
  updated_at: z.string().optional().nullable(),
});
export type CvmDetailV20251028 = z.infer<typeof CvmDetailV20251028Schema>;

export const PaginatedCvmInfosV20251028Schema = z.object({
  items: z.array(CvmInfoV20251028Schema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  pages: z.number(),
});
export type PaginatedCvmInfosV20251028 = z.infer<typeof PaginatedCvmInfosV20251028Schema>;
