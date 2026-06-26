import { z } from "zod";

/**
 * A KMS contract: a group of equivalent KMS node replicas sharing one root key.
 *
 * `contract_address` is an on-chain address for ETHEREUM/BASE contracts, or the
 * sentinel `"phala"` for the off-chain PHALA KMS (where `chain_id` is `0`).
 * `k256_pubkey` / `ca_pubkey` are the verification anchors.
 *
 * Available from API version 2026-06-23.
 */
export const KmsContractInfoSchema = z
  .object({
    id: z.string(),
    slug: z.string().nullable(),
    label: z.string().nullable(),
    contract_address: z.string(),
    chain_id: z.number(),
    k256_pubkey: z.string().nullable(),
    ca_pubkey: z.string().nullable(),
    node_count: z.number(),
  })
  .passthrough();

export type KmsContractInfo = z.infer<typeof KmsContractInfoSchema>;

/**
 * A single KMS node (replica) under a contract, including its RPC `url`.
 *
 * Available from API version 2026-06-23.
 */
export const KmsContractNodeSchema = z
  .object({
    id: z.string(),
    slug: z.string().nullable(),
    url: z.string(),
    version: z.string(),
    kms_type: z.string(),
  })
  .passthrough();

export type KmsContractNode = z.infer<typeof KmsContractNodeSchema>;
