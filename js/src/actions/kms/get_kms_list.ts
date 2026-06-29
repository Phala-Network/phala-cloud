import { z } from "zod";
import { type Client } from "../../client";
import { type KmsInfo, KmsInfoSchema } from "../../types/kms_info";
import { defineAction } from "../../utils/define-action";

export const GetKmsListRequestSchema = z
  .object({
    page: z.number().int().min(1).optional(),
    page_size: z.number().int().min(1).optional(),
    is_onchain: z.boolean().optional(),
  })
  .strict();

export const GetKmsListSchema = z
  .object({
    items: z.array(KmsInfoSchema),
    total: z.number(),
    page: z.number(),
    page_size: z.number(),
    pages: z.number(),
  })
  .strict();

export type GetKmsListRequest = z.infer<typeof GetKmsListRequestSchema>;
export type GetKmsListResponse = z.infer<typeof GetKmsListSchema> & { items: KmsInfo[] };

/**
 * List KMS nodes (legacy, node-centric shape).
 *
 * @deprecated From API version 2026-06-23 the KMS API is contract-centric. Use
 * `listKmsContracts` to list contracts and `listKmsContractNodes` to list a
 * contract's nodes. This action stays pinned to the legacy node-list shape via
 * the `2026-05-22` API version.
 */
const { action: getKmsList, safeAction: safeGetKmsList } = defineAction<
  GetKmsListRequest | undefined,
  typeof GetKmsListSchema,
  GetKmsListResponse
>(GetKmsListSchema, async (client, request) => {
  const validatedRequest = GetKmsListRequestSchema.parse(request ?? {});
  return await client.get("/kms", {
    params: validatedRequest,
    headers: { "X-Phala-Version": "2026-05-22" },
  });
});

export { getKmsList, safeGetKmsList };
