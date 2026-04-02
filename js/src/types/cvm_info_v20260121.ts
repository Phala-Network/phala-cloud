import { z } from "zod";
import { CvmNetworkUrlsV20251028Schema } from "./cvm_info_v20251028";

export const BillingPeriodSchema = z.enum(["skip", "hourly", "monthly"]);
export type BillingPeriod = z.infer<typeof BillingPeriodSchema>;

export const KmsTypeSchema = z.enum(["phala", "ethereum", "base", "legacy"]);
export type KmsType = z.infer<typeof KmsTypeSchema>;

export const UserRefSchema = z.object({
  object_type: z.literal("user"),
  id: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
});
export type UserRef = z.infer<typeof UserRefSchema>;

export const WorkspaceRefSchema = z.object({
  object_type: z.literal("workspace"),
  id: z.string(),
  name: z.string(),
  slug: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
});
export type WorkspaceRef = z.infer<typeof WorkspaceRefSchema>;

export const CvmResourceInfoV20260121Schema = z.object({
  instance_type: z.string().nullable().optional(),
  vcpu: z.number().int().nullable().optional(),
  memory_in_gb: z.number().nullable().optional(),
  disk_in_gb: z.number().int().nullable().optional(),
  gpus: z.number().int().nullable().optional(),
  compute_billing_price: z.string().nullable().optional(),
  billing_period: BillingPeriodSchema.nullable().optional(),
});
export type CvmResourceInfoV20260121 = z.infer<typeof CvmResourceInfoV20260121Schema>;

export const CvmOsInfoV20260121Schema = z.object({
  name: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
  is_dev: z.boolean().nullable().optional(),
  os_image_hash: z.string().nullable().optional(),
});
export type CvmOsInfoV20260121 = z.infer<typeof CvmOsInfoV20260121Schema>;

export const CvmKmsInfoV20260121Schema = z.object({
  chain_id: z.number().int().nullable().optional(),
  dstack_kms_address: z.string().nullable().optional(),
  dstack_app_address: z.string().nullable().optional(),
  deployer_address: z.string().nullable().optional(),
  rpc_endpoint: z.string().nullable().optional(),
  encrypted_env_pubkey: z.string().nullable().optional(),
});
export type CvmKmsInfoV20260121 = z.infer<typeof CvmKmsInfoV20260121Schema>;

export const CvmProgressInfoV20260121Schema = z.object({
  target: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  correlation_id: z.string().nullable().optional(),
});
export type CvmProgressInfoV20260121 = z.infer<typeof CvmProgressInfoV20260121Schema>;

export const CvmGatewayInfoV20260121Schema = z.object({
  base_domain: z.string().nullable().optional(),
  cname: z.string().nullable().optional(),
});
export type CvmGatewayInfoV20260121 = z.infer<typeof CvmGatewayInfoV20260121Schema>;

export const NodeRefSchema = z.object({
  object_type: z.literal("node"),
  id: z.number().int().nullable().optional(),
  name: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  device_id: z.string().nullable().optional(),
  ppid: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
});
export type NodeRef = z.infer<typeof NodeRefSchema>;

// Deprecated: Use NodeRefSchema instead
export const CvmNodeInfoV20260121Schema = NodeRefSchema;
export type CvmNodeInfoV20260121 = NodeRef;

export const CvmInfoV20260121Schema = z.object({
  id: z.string(), // hashed CvmId
  name: z.string(),
  app_id: z.string().nullable().optional(),
  vm_uuid: z.string().nullable().optional(),
  instance_id: z.string().nullable().optional(),
  resource: CvmResourceInfoV20260121Schema,
  node_info: NodeRefSchema.nullable().optional(),
  os: CvmOsInfoV20260121Schema.nullable().optional(),
  kms_type: KmsTypeSchema.nullable().optional(),
  kms_info: CvmKmsInfoV20260121Schema.nullable().optional(),
  status: z.string(),
  progress: CvmProgressInfoV20260121Schema.nullable().optional(),
  compose_hash: z.string().nullable().optional(),
  gateway: CvmGatewayInfoV20260121Schema,
  services: z.array(z.record(z.any())).optional().default([]),
  endpoints: z.array(CvmNetworkUrlsV20251028Schema).nullable().optional(),
  public_logs: z.boolean().optional(),
  public_sysinfo: z.boolean().optional(),
  public_tcbinfo: z.boolean().optional(),
  gateway_enabled: z.boolean().optional(),
  secure_time: z.boolean().optional(),
  listed: z.boolean().optional().default(false),
  storage_fs: z.string().optional(),
  workspace: WorkspaceRefSchema.nullable().optional(),
  creator: UserRefSchema.nullable().optional(),
});
export type CvmInfoV20260121 = z.infer<typeof CvmInfoV20260121Schema>;

export const CvmInfoDetailV20260121Schema = CvmInfoV20260121Schema.extend({
  compose_file: z
    .union([z.record(z.any()), z.string()])
    .nullable()
    .optional(),
});
export type CvmInfoDetailV20260121 = z.infer<typeof CvmInfoDetailV20260121Schema>;

export const PaginatedCvmInfosV20260121Schema = z.object({
  items: z.array(CvmInfoV20260121Schema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  pages: z.number(),
});
export type PaginatedCvmInfosV20260121 = z.infer<typeof PaginatedCvmInfosV20260121Schema>;
