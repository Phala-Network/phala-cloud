import type { Address, Hex } from "viem";
import type { Chain } from "viem";
import { z } from "zod";
import { SUPPORTED_CHAINS } from "./supported_chains";

const KmsInfoBaseSchema = z
  .object({
    id: z.string(),
    slug: z.string().nullable(),
    url: z.string(),
    version: z.string(),
    chain_id: z.number().nullable(),
    kms_contract_address: z
      .string()
      .nullable()
      .transform((val) => val as Address),
    gateway_app_id: z
      .string()
      .nullable()
      .transform((val) => val as Hex),
    k256_pubkey: z.string().nullable().optional(),
  })
  .passthrough();

export const KmsInfoSchema = KmsInfoBaseSchema.transform((data) => {
  if (data.chain_id != null) {
    const chain: Chain | undefined = SUPPORTED_CHAINS[data.chain_id];
    if (chain) {
      return { ...data, chain } as typeof data & { chain: Chain };
    }
  }
  return data as typeof data;
});

export type KmsInfo =
  | (z.infer<typeof KmsInfoBaseSchema> & { chain_id: number; chain: Chain })
  | (z.infer<typeof KmsInfoBaseSchema> & { chain_id: undefined | null; chain: undefined });
