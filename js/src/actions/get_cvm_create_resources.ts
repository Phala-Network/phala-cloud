import { z } from "zod";
import {
  AvailableOSImageSchema,
  ResourceThresholdSchema,
  TeepodCapacitySchema,
} from "./get_available_nodes";
import { type Client, type SafeResult } from "../client";
import type { ApiVersion } from "../types/client";

const ResourceIdV20260121Schema = z.union([z.number(), z.string()]);
const HashIdSchema = z.string();

export const GpuAvailabilitySchema = z
  .object({
    has_reserved_gpus: z.boolean(),
    reserved_gpu_count: z.number(),
    has_public_gpus: z.boolean(),
    public_gpu_count: z.number(),
  })
  .passthrough();

export const CvmCreateKmsResourceV20260121Schema = z
  .object({
    id: ResourceIdV20260121Schema,
    slug: z.string().nullable().optional(),
    url: z.string(),
    version: z.string().nullable().optional(),
    kms_type: z.string(),
    chain_id: z.number().nullable().optional(),
    kms_contract_id: ResourceIdV20260121Schema.nullable().optional(),
    kms_contract_address: z.string().nullable().optional(),
    gateway_app_id: z.string().nullable().optional(),
    supported_os_images: z.array(z.string()).default([]),
  })
  .passthrough();

export const CvmCreateNodeKmsRelationV20260121Schema = z
  .object({
    teepod_id: z.number(),
    kms_id: ResourceIdV20260121Schema,
    kms_type: z.string(),
    kms_contract_id: ResourceIdV20260121Schema.nullable().optional(),
    kms_contract_address: z.string().nullable().optional(),
    supported_os_images: z.array(z.string()).default([]),
  })
  .passthrough();

export const CvmCreateGatewayResourceV20260121Schema = z
  .object({
    id: ResourceIdV20260121Schema,
    teepod_id: z.number().nullable().optional(),
    kms_contract_id: ResourceIdV20260121Schema,
    rpc_url: z.string().nullable().optional(),
    domain_suffix: z.string().nullable().optional(),
    enabled: z.boolean(),
  })
  .passthrough();

export const CvmCreateKmsResourceSchema = CvmCreateKmsResourceV20260121Schema.extend({
  id: HashIdSchema,
  kms_contract_id: HashIdSchema.nullable().optional(),
});

export const CvmCreateNodeKmsRelationSchema = CvmCreateNodeKmsRelationV20260121Schema.extend({
  kms_id: HashIdSchema,
  kms_contract_id: HashIdSchema.nullable().optional(),
});

export const CvmCreateGatewayResourceSchema = CvmCreateGatewayResourceV20260121Schema.extend({
  id: HashIdSchema,
  kms_contract_id: HashIdSchema,
});

export const CvmCreateInstanceTypeResourceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    vcpu: z.number(),
    memory_mb: z.number(),
    default_disk_size_gb: z.number(),
    requires_gpu: z.boolean(),
    requires_gpu_count: z.number(),
    family: z.string().nullable().optional(),
    display_order: z.number().nullable().optional(),
  })
  .passthrough();

export const CvmCreateResourceGraphV20260121Schema = z
  .object({
    tier: z.string(),
    capacity: ResourceThresholdSchema,
    nodes: z.array(TeepodCapacitySchema),
    kms_nodes: z.array(CvmCreateKmsResourceV20260121Schema),
    node_kms_relations: z.array(CvmCreateNodeKmsRelationV20260121Schema),
    gateway_nodes: z.array(CvmCreateGatewayResourceV20260121Schema),
    instance_types: z.array(CvmCreateInstanceTypeResourceSchema),
    gpu_availability: GpuAvailabilitySchema,
  })
  .passthrough();

export const CvmCreateResourceGraphV20260522Schema = CvmCreateResourceGraphV20260121Schema.extend({
  kms_nodes: z.array(CvmCreateKmsResourceSchema),
  node_kms_relations: z.array(CvmCreateNodeKmsRelationSchema),
  gateway_nodes: z.array(CvmCreateGatewayResourceSchema),
});

export const CvmCreateResourceGraphSchema = CvmCreateResourceGraphV20260522Schema;

export type GpuAvailability = z.infer<typeof GpuAvailabilitySchema>;
export type CvmCreateKmsResourceV20260121 = z.infer<typeof CvmCreateKmsResourceV20260121Schema>;
export type CvmCreateNodeKmsRelationV20260121 = z.infer<
  typeof CvmCreateNodeKmsRelationV20260121Schema
>;
export type CvmCreateGatewayResourceV20260121 = z.infer<
  typeof CvmCreateGatewayResourceV20260121Schema
>;
export type CvmCreateResourceGraphV20260121 = z.infer<typeof CvmCreateResourceGraphV20260121Schema>;
export type CvmCreateResourceGraphV20260522 = z.infer<typeof CvmCreateResourceGraphV20260522Schema>;
export type CvmCreateKmsResource = z.infer<typeof CvmCreateKmsResourceSchema>;
export type CvmCreateNodeKmsRelation = z.infer<typeof CvmCreateNodeKmsRelationSchema>;
export type CvmCreateGatewayResource = z.infer<typeof CvmCreateGatewayResourceSchema>;
export type CvmCreateInstanceTypeResource = z.infer<typeof CvmCreateInstanceTypeResourceSchema>;
export type CvmCreateResourceGraph = z.infer<typeof CvmCreateResourceGraphSchema>;
export type CvmCreateAvailableOSImage = z.infer<typeof AvailableOSImageSchema>;

export type GetCvmCreateResourcesResponse<V extends ApiVersion> = V extends "2026-01-21"
  ? CvmCreateResourceGraphV20260121
  : CvmCreateResourceGraphV20260522;

function getSchemaForVersion(version: ApiVersion) {
  if (version === "2026-01-21") return CvmCreateResourceGraphV20260121Schema;
  return CvmCreateResourceGraphV20260522Schema;
}

export function getCvmCreateResources<V extends ApiVersion>(
  client: Client<V>,
): Promise<GetCvmCreateResourcesResponse<V>>;
export function getCvmCreateResources<T extends z.ZodTypeAny>(
  client: Client<ApiVersion>,
  parameters: { schema: T },
): Promise<z.infer<T>>;
export function getCvmCreateResources(
  client: Client<ApiVersion>,
  parameters: { schema: false },
): Promise<unknown>;
export async function getCvmCreateResources<V extends ApiVersion, T extends z.ZodTypeAny>(
  client: Client<V>,
  parameters?: { schema?: T | false },
): Promise<GetCvmCreateResourcesResponse<V> | z.infer<T> | unknown> {
  const response = await client.get("/teepods/cvm-create-resources");
  if (parameters?.schema === false) return response;
  const schema = parameters?.schema || getSchemaForVersion(client.config.version);
  return schema.parse(response);
}

export function safeGetCvmCreateResources<V extends ApiVersion>(
  client: Client<V>,
): Promise<SafeResult<GetCvmCreateResourcesResponse<V>>>;
export function safeGetCvmCreateResources<T extends z.ZodTypeAny>(
  client: Client<ApiVersion>,
  parameters: { schema: T },
): Promise<SafeResult<z.infer<T>>>;
export function safeGetCvmCreateResources(
  client: Client<ApiVersion>,
  parameters: { schema: false },
): Promise<SafeResult<unknown>>;
export async function safeGetCvmCreateResources<V extends ApiVersion, T extends z.ZodTypeAny>(
  client: Client<V>,
  parameters?: { schema?: T | false },
): Promise<SafeResult<GetCvmCreateResourcesResponse<V> | z.infer<T> | unknown>> {
  try {
    const response = await client.get("/teepods/cvm-create-resources");
    if (parameters?.schema === false) {
      return { success: true, data: response };
    }
    const schema = parameters?.schema || getSchemaForVersion(client.config.version);
    const data = schema.parse(response);
    return { success: true, data };
  } catch (error) {
    return { success: false, error } as SafeResult<
      GetCvmCreateResourcesResponse<V> | z.infer<T> | unknown
    >;
  }
}
