import { z } from "zod";
import { type Client } from "../client";
import { defineAction } from "../utils/define-action";

export const GetAppEnvEncryptPubKeyRequestSchema = z
  .object({
    kms: z.string().min(1, "KMS ID or slug is required"),
    app_id: z
      .string()
      .refine(
        (val) => val.length === 40 || (val.startsWith("0x") && val.length === 42),
        "App ID must be exactly 40 characters or 42 characters with 0x prefix",
      ),
  })
  .strict();

export const GetAppEnvEncryptPubKeySchema = z
  .object({
    public_key: z.string(),
    signature: z.string(),
  })
  .strict();

export type GetAppEnvEncryptPubKeyRequest = z.infer<typeof GetAppEnvEncryptPubKeyRequestSchema>;

export type GetAppEnvEncryptPubKey = z.infer<typeof GetAppEnvEncryptPubKeySchema>;

const { action: getAppEnvEncryptPubKey, safeAction: safeGetAppEnvEncryptPubKey } = defineAction<
  GetAppEnvEncryptPubKeyRequest,
  typeof GetAppEnvEncryptPubKeySchema
>(GetAppEnvEncryptPubKeySchema, async (client, payload) => {
  const validatedRequest = GetAppEnvEncryptPubKeyRequestSchema.parse(payload);
  return await client.get(`/kms/${validatedRequest.kms}/pubkey/${validatedRequest.app_id}`);
});

export { getAppEnvEncryptPubKey, safeGetAppEnvEncryptPubKey };
