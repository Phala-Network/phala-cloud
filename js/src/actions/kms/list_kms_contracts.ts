import { z } from "zod";
import { KmsContractInfoSchema } from "../../types/kms_contract";
import { defineAction } from "../../utils/define-action";

// The contract-centric KMS API exists from this version onward. Pin it per
// request so the action returns contracts regardless of the client's version.
const KMS_CONTRACT_API_VERSION = "2026-06-23";

export const ListKmsContractsRequestSchema = z
  .object({
    page: z.number().int().min(1).optional(),
    page_size: z.number().int().min(1).optional(),
    is_onchain: z.boolean().optional(),
  })
  .strict();

export const ListKmsContractsSchema = z
  .object({
    items: z.array(KmsContractInfoSchema),
    total: z.number(),
    page: z.number(),
    page_size: z.number(),
    pages: z.number(),
  })
  .strict();

export type ListKmsContractsRequest = z.infer<typeof ListKmsContractsRequestSchema>;
export type ListKmsContractsResponse = z.infer<typeof ListKmsContractsSchema>;

const { action: listKmsContracts, safeAction: safeListKmsContracts } = defineAction<
  ListKmsContractsRequest | undefined,
  typeof ListKmsContractsSchema
>(ListKmsContractsSchema, async (client, request) => {
  const validatedRequest = ListKmsContractsRequestSchema.parse(request ?? {});
  return await client.get("/kms", {
    params: validatedRequest,
    headers: { "X-Phala-Version": KMS_CONTRACT_API_VERSION },
  });
});

export { listKmsContracts, safeListKmsContracts };
