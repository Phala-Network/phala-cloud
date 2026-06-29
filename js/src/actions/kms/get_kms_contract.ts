import { z } from "zod";
import { KmsContractInfoSchema } from "../../types/kms_contract";
import { defineAction } from "../../utils/define-action";

const KMS_CONTRACT_API_VERSION = "2026-06-23";

export const GetKmsContractRequestSchema = z
  .object({
    // Contract slug (documented). A kc_ hashed id also resolves.
    slug: z.string().min(1, "KMS contract slug is required"),
  })
  .strict();

export type GetKmsContractRequest = z.infer<typeof GetKmsContractRequestSchema>;
export type GetKmsContract = z.infer<typeof KmsContractInfoSchema>;

const { action: getKmsContract, safeAction: safeGetKmsContract } = defineAction<
  GetKmsContractRequest,
  typeof KmsContractInfoSchema
>(KmsContractInfoSchema, async (client, payload) => {
  const { slug } = GetKmsContractRequestSchema.parse(payload);
  return await client.get(`/kms/${slug}`, {
    headers: { "X-Phala-Version": KMS_CONTRACT_API_VERSION },
  });
});

export { getKmsContract, safeGetKmsContract };
