import { z } from "zod";
import { UserRefSchema, WorkspaceRefSchema } from "./cvm_info_v20260121";

export const CvmRefSchema = z.object({
  object_type: z.literal("cvm"),
  id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  app_id: z.string().nullable().optional(),
  vm_uuid: z.string().nullable().optional(),
});
export type CvmRef = z.infer<typeof CvmRefSchema>;

export const AppRevisionResponseSchema = z.object({
  revision_id: z.string(),
  app_id: z.string(),
  vm_uuid: z.string(),
  compose_hash: z.string(),
  created_at: z.string(),
  trace_id: z.string().nullable().optional(),
  operation_type: z.string(),
  triggered_by: UserRefSchema.nullable().optional(),
  cvm: CvmRefSchema.nullable().optional(),
  workspace: WorkspaceRefSchema.nullable().optional(),
});
export type AppRevisionResponse = z.infer<typeof AppRevisionResponseSchema>;

export const AppRevisionDetailResponseSchema = z.object({
  revision_id: z.string(),
  app_id: z.string(),
  vm_uuid: z.string(),
  compose_hash: z.string(),
  compose_file: z
    .union([z.record(z.string(), z.any()), z.string()])
    .nullable()
    .optional(),
  encrypted_env: z.string(),
  user_config: z.string(),
  created_at: z.string(),
  trace_id: z.string().nullable().optional(),
  operation_type: z.string(),
  triggered_by: UserRefSchema.nullable().optional(),
  cvm: CvmRefSchema.nullable().optional(),
  workspace: WorkspaceRefSchema.nullable().optional(),
});
export type AppRevisionDetailResponse = z.infer<typeof AppRevisionDetailResponseSchema>;

export const AppRevisionsResponseSchema = z.object({
  revisions: z.array(AppRevisionResponseSchema),
  total: z.number().int(),
  page: z.number().int(),
  page_size: z.number().int(),
  total_pages: z.number().int(),
});
export type AppRevisionsResponse = z.infer<typeof AppRevisionsResponseSchema>;
