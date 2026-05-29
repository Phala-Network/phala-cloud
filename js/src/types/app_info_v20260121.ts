import { z } from "zod";
import { CvmInfoV20260121Schema, CvmInfoV20260522Schema } from "./cvm_info_v20260121";

export const DstackAppFullResponseV20260121Schema = z.object({
  id: z.string(),
  name: z.string(),
  app_id: z.string(),
  app_provision_type: z.string().nullable().optional(),
  app_icon_url: z.string().nullable().optional(),
  created_at: z.string(),
  kms_type: z.string(),
  profile: z
    .object({
      display_name: z.string().nullable().optional(),
      avatar_url: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      custom_domain: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  current_cvm: CvmInfoV20260121Schema.nullable().optional(),
  cvms: z.array(CvmInfoV20260121Schema).default([]),
  cvm_count: z.number().int().default(0),
});
export type DstackAppFullResponseV20260121 = z.infer<typeof DstackAppFullResponseV20260121Schema>;

export const DstackAppFullResponseV20260522Schema = DstackAppFullResponseV20260121Schema.extend({
  current_cvm: CvmInfoV20260522Schema.nullable().optional(),
  cvms: z.array(CvmInfoV20260522Schema).default([]),
});
export type DstackAppFullResponseV20260522 = z.infer<typeof DstackAppFullResponseV20260522Schema>;

export const DstackAppWithCvmResponseV20260121Schema = DstackAppFullResponseV20260121Schema;
export type DstackAppWithCvmResponseV20260121 = z.infer<
  typeof DstackAppWithCvmResponseV20260121Schema
>;

export const DstackAppWithCvmResponseV20260522Schema = DstackAppFullResponseV20260522Schema;
export type DstackAppWithCvmResponseV20260522 = z.infer<
  typeof DstackAppWithCvmResponseV20260522Schema
>;

export const DstackAppListResponseV20260121Schema = z.object({
  dstack_apps: z.array(DstackAppWithCvmResponseV20260121Schema),
  page: z.number().int(),
  page_size: z.number().int(),
  total: z.number().int(),
  total_pages: z.number().int(),
});
export type DstackAppListResponseV20260121 = z.infer<typeof DstackAppListResponseV20260121Schema>;

export const DstackAppListResponseV20260522Schema = DstackAppListResponseV20260121Schema.extend({
  dstack_apps: z.array(DstackAppWithCvmResponseV20260522Schema),
});
export type DstackAppListResponseV20260522 = z.infer<typeof DstackAppListResponseV20260522Schema>;
