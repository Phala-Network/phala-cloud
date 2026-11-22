import { z } from "zod";
import { CvmFinalityWaitAcceptedSchema, CvmFinalityWaitSchema } from "../../types/cvm_finality";
import { KmsInfoSchema } from "../../types/kms_info";
import { PhalaCloudError } from "../../utils/errors";

const CvmUpdateAcceptanceWireSchema = z.union([
  CvmFinalityWaitAcceptedSchema,
  z.object({
    // Older API responses may omit status or omit the correlation ID for a no-op.
    status: z
      .string()
      .refine((status) => status !== "awaiting_finality")
      .optional(),
    correlation_id: z.string().optional(),
  }),
]);

export const CvmUpdateAcceptedFieldsSchema = z.object({
  correlationId: z.string(),
  finalityWait: CvmFinalityWaitSchema.optional(),
});

export const CvmUpdateHashRequiredSchema = z.object({
  requiresOnChainHash: z.literal(true),
  composeHash: z.string(),
  appId: z.string(),
  deviceId: z.string(),
  kmsInfo: KmsInfoSchema,
  commitToken: z.string().optional(),
  commitUrl: z.string().optional(),
  apiCommitUrl: z.string().optional(),
  onchainStatus: z
    .object({
      compose_hash_allowed: z.boolean(),
      device_id_allowed: z.boolean(),
      is_allowed: z.boolean(),
    })
    .optional(),
});

export function readCvmUpdateAcceptance(response: unknown) {
  const wire = CvmUpdateAcceptanceWireSchema.parse(response);
  return {
    correlationId: wire.correlation_id,
    ...(wire.status === undefined ? {} : { status: wire.status }),
    ...("finality_wait" in wire ? { finalityWait: wire.finality_wait } : {}),
  };
}

export function cvmUpdateCommitHeaders(composeHash: string, transactionHash: string) {
  return {
    "X-Compose-Hash": composeHash,
    "X-Transaction-Hash": transactionHash,
  };
}

function extractDetailsMap(detail: unknown): Map<string, unknown> {
  const map = new Map<string, unknown>();
  if (typeof detail !== "object" || detail === null || !("details" in detail)) return map;
  if (!Array.isArray(detail.details)) return map;

  const details: unknown[] = detail.details;
  for (const item of details) {
    if (
      typeof item === "object" &&
      item !== null &&
      "field" in item &&
      typeof item.field === "string" &&
      "value" in item
    ) {
      map.set(item.field, item.value);
    }
  }
  return map;
}

/** Unified patch and draft apply return the same 202 and 465 responses. */
export async function submitCvmUpdate(send: () => Promise<unknown>) {
  try {
    const accepted = readCvmUpdateAcceptance(await send());
    return {
      ...accepted,
      requiresOnChainHash: false as const,
      correlationId: accepted.correlationId ?? "",
    };
  } catch (error) {
    if (!(error instanceof PhalaCloudError) || error.status !== 465) throw error;

    const details = extractDetailsMap(error.detail);
    return {
      requiresOnChainHash: true as const,
      composeHash: details.get("compose_hash"),
      appId: String(details.get("app_id")),
      deviceId: details.get("device_id"),
      kmsInfo: details.get("kms_info"),
      commitToken: details.get("commit_token"),
      commitUrl: details.get("commit_url"),
      apiCommitUrl: details.get("api_commit_url"),
      onchainStatus: details.get("onchain_status"),
    };
  }
}
