import { z } from "zod";
import { defineAction } from "../../utils/define-action";

export const OnChainDeviceSchema = z
  .object({
    device_id: z.string(),
    node_name: z.string().nullable().optional(),
    on_chain_allowed: z.boolean().nullable(),
  })
  .passthrough();

export type OnChainDevice = z.infer<typeof OnChainDeviceSchema>;

export const OnChainOsImageSchema = z
  .object({
    name: z.string(),
    version: z.string(),
    os_image_hash: z.string().nullable(),
    on_chain_allowed: z.boolean().nullable(),
  })
  .passthrough();

export type OnChainOsImage = z.infer<typeof OnChainOsImageSchema>;

export const OnChainKmsContractSchema = z
  .object({
    contract_address: z.string(),
    chain_id: z.number(),
    chain_name: z.string(),
    k256_pubkey: z.string().nullable().optional(),
    ca_pubkey: z.string().nullable().optional(),
    gateway_contract_address: z.string().nullable().optional(),
    devices: z.array(OnChainDeviceSchema),
    os_images: z.array(OnChainOsImageSchema),
  })
  .passthrough();

export type OnChainKmsContract = z.infer<typeof OnChainKmsContractSchema>;

export const GetKmsOnChainDetailResponseSchema = z
  .object({
    chain_name: z.string(),
    chain_id: z.number(),
    contracts: z.array(OnChainKmsContractSchema),
  })
  .passthrough();

export type GetKmsOnChainDetailResponse = z.infer<typeof GetKmsOnChainDetailResponseSchema>;

export const GetKmsOnChainDetailRequestSchema = z
  .object({
    chain: z.string(),
  })
  .strict();

export type GetKmsOnChainDetailRequest = z.infer<typeof GetKmsOnChainDetailRequestSchema>;

const { action: getKmsOnChainDetail, safeAction: safeGetKmsOnChainDetail } = defineAction<
  GetKmsOnChainDetailRequest,
  typeof GetKmsOnChainDetailResponseSchema,
  GetKmsOnChainDetailResponse
>(GetKmsOnChainDetailResponseSchema, async (client, request) => {
  const { chain } = GetKmsOnChainDetailRequestSchema.parse(request);
  return await client.get(`/kms/on-chain/${chain}`);
});

export { getKmsOnChainDetail, safeGetKmsOnChainDetail };
