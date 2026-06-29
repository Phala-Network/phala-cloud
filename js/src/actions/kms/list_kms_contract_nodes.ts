import { z } from "zod";
import { KmsContractNodeSchema } from "../../types/kms_contract";
import { defineAction } from "../../utils/define-action";

const KMS_CONTRACT_API_VERSION = "2026-06-23";

export const ListKmsContractNodesRequestSchema = z
  .object({
    // Contract slug (documented). A kc_ hashed id also resolves.
    slug: z.string().min(1, "KMS contract slug is required"),
  })
  .strict();

export const ListKmsContractNodesSchema = z
  .object({
    items: z.array(KmsContractNodeSchema),
    total: z.number(),
  })
  .strict();

export type ListKmsContractNodesRequest = z.infer<typeof ListKmsContractNodesRequestSchema>;
export type ListKmsContractNodesResponse = z.infer<typeof ListKmsContractNodesSchema>;

const { action: listKmsContractNodes, safeAction: safeListKmsContractNodes } = defineAction<
  ListKmsContractNodesRequest,
  typeof ListKmsContractNodesSchema
>(ListKmsContractNodesSchema, async (client, payload) => {
  const { slug } = ListKmsContractNodesRequestSchema.parse(payload);
  return await client.get(`/kms/${slug}/nodes`, {
    headers: { "X-Phala-Version": KMS_CONTRACT_API_VERSION },
  });
});

export { listKmsContractNodes, safeListKmsContractNodes };
