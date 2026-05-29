import { z } from "zod";
import { MachineInfoV20251028Schema } from "./cvm_info_v20251028";

export const CvmBasicInfoV20251028Schema = z.object({
  vm_uuid: z.string().nullable(),
  app_id: z.string(),
  name: z.string().default(""),
  status: z.string(),
  vcpu: z.number().int(),
  memory: z.number().int(),
  disk_size: z.number().int(),
  teepod_id: z.number().int(),
  teepod_name: z.string(),
  region_identifier: z.string().nullable().optional(),
  kms_type: z.string().nullable().optional(),
  instance_type: z.string().nullable().optional(),
  listed: z.boolean().nullable().optional(),
  base_image: z.string().nullable().optional(),
  kms_slug: z.string().nullable().optional(),
  kms_id: z.string().nullable().optional(),
  instance_id: z.string().nullable().optional(),
  machine_info: MachineInfoV20251028Schema.nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
export type CvmBasicInfoV20251028 = z.infer<typeof CvmBasicInfoV20251028Schema>;

export const AppProfileSchema = z.object({
  display_name: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  custom_domain: z.string().nullable().optional(),
});
export type AppProfile = z.infer<typeof AppProfileSchema>;

export const DstackAppFullResponseV20251028Schema = z.object({
  id: z.string(),
  name: z.string(),
  app_id: z.string(),
  app_provision_type: z.string().nullable().optional(),
  app_icon_url: z.string().nullable().optional(),
  created_at: z.string(),
  kms_type: z.string(),
  profile: AppProfileSchema.nullable().optional(),
  current_cvm: CvmBasicInfoV20251028Schema.nullable().optional(),
  cvms: z.array(CvmBasicInfoV20251028Schema).default([]),
  cvm_count: z.number().int().default(0),
});
export type DstackAppFullResponseV20251028 = z.infer<typeof DstackAppFullResponseV20251028Schema>;

export const DstackAppWithCvmResponseV20251028Schema = DstackAppFullResponseV20251028Schema;
export type DstackAppWithCvmResponseV20251028 = z.infer<
  typeof DstackAppWithCvmResponseV20251028Schema
>;

export const DstackAppListResponseV20251028Schema = z.object({
  dstack_apps: z.array(DstackAppWithCvmResponseV20251028Schema),
  page: z.number().int(),
  page_size: z.number().int(),
  total: z.number().int(),
  total_pages: z.number().int(),
});
export type DstackAppListResponseV20251028 = z.infer<typeof DstackAppListResponseV20251028Schema>;
