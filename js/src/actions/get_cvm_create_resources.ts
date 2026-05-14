import { z } from "zod";
import {
  AvailableOSImageSchema,
  ResourceThresholdSchema,
  TeepodCapacitySchema,
} from "./get_available_nodes";
import { defineSimpleAction } from "../utils/define-action";

const ResourceIdSchema = z.union([z.number(), z.string()]);

export const GpuAvailabilitySchema = z
  .object({
    has_reserved_gpus: z.boolean(),
    reserved_gpu_count: z.number(),
    has_public_gpus: z.boolean(),
    public_gpu_count: z.number(),
  })
  .passthrough();

export const CvmCreateKmsResourceSchema = z
  .object({
    id: ResourceIdSchema,
    slug: z.string().nullable().optional(),
    url: z.string(),
    version: z.string().nullable().optional(),
    kms_type: z.string(),
    chain_id: z.number().nullable().optional(),
    kms_contract_id: ResourceIdSchema.nullable().optional(),
    kms_contract_address: z.string().nullable().optional(),
    gateway_app_id: z.string().nullable().optional(),
    supported_os_images: z.array(z.string()).default([]),
  })
  .passthrough();

export const CvmCreateNodeKmsRelationSchema = z
  .object({
    teepod_id: z.number(),
    kms_id: ResourceIdSchema,
    kms_type: z.string(),
    kms_contract_id: ResourceIdSchema.nullable().optional(),
    kms_contract_address: z.string().nullable().optional(),
    supported_os_images: z.array(z.string()).default([]),
  })
  .passthrough();

export const CvmCreateGatewayResourceSchema = z
  .object({
    id: ResourceIdSchema,
    teepod_id: z.number().nullable().optional(),
    kms_contract_id: ResourceIdSchema,
    rpc_url: z.string().nullable().optional(),
    domain_suffix: z.string().nullable().optional(),
    enabled: z.boolean(),
  })
  .passthrough();

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

export const CvmCreateResourceGraphSchema = z
  .object({
    tier: z.string(),
    capacity: ResourceThresholdSchema,
    nodes: z.array(TeepodCapacitySchema),
    kms_nodes: z.array(CvmCreateKmsResourceSchema),
    node_kms_relations: z.array(CvmCreateNodeKmsRelationSchema),
    gateway_nodes: z.array(CvmCreateGatewayResourceSchema),
    instance_types: z.array(CvmCreateInstanceTypeResourceSchema),
    gpu_availability: GpuAvailabilitySchema,
  })
  .passthrough();

export type GpuAvailability = z.infer<typeof GpuAvailabilitySchema>;
export type CvmCreateKmsResource = z.infer<typeof CvmCreateKmsResourceSchema>;
export type CvmCreateNodeKmsRelation = z.infer<typeof CvmCreateNodeKmsRelationSchema>;
export type CvmCreateGatewayResource = z.infer<typeof CvmCreateGatewayResourceSchema>;
export type CvmCreateInstanceTypeResource = z.infer<typeof CvmCreateInstanceTypeResourceSchema>;
export type CvmCreateResourceGraph = z.infer<typeof CvmCreateResourceGraphSchema>;
export type CvmCreateAvailableOSImage = z.infer<typeof AvailableOSImageSchema>;

const { action: getCvmCreateResources, safeAction: safeGetCvmCreateResources } = defineSimpleAction(
  CvmCreateResourceGraphSchema,
  async (client) => {
    return await client.get("/teepods/cvm-create-resources");
  },
);

export { getCvmCreateResources, safeGetCvmCreateResources };
