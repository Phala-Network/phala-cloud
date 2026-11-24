import { z } from "zod";
import type { Client } from "../../client";
import type { ApiVersion } from "../../types/client";
import { defineAction } from "../../utils/define-action";
import { PhalaCloudError, ResourceError } from "../../utils/errors";

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
>(GetAppEnvEncryptPubKeySchema, (client, payload) => client.get(pubkeyEndpoint(payload)));

export { getAppEnvEncryptPubKey, safeGetAppEnvEncryptPubKey };

function pubkeyEndpoint(payload: GetAppEnvEncryptPubKeyRequest): string {
  const { kms, app_id } = GetAppEnvEncryptPubKeyRequestSchema.parse(payload);
  // The server resolves contract slugs, kms_type values, and kms_ node IDs.
  return `/kms/${kms}/pubkey/${app_id}`;
}

const FINALITY_WAIT_CODE = "ERR-12-008";
const NOT_REGISTERED_CODE = "ERR-12-009";
const FINALITY_RETRY_MS = 5_000;
const LEGACY_RETRY_MS = 15_000;
const UNKNOWN_FINALITY_BUDGET_MS = 45 * 60_000;
const FINALITY_MARGIN_MS = 15 * 60_000;
const MAX_TIMER_MS = 2_147_483_647;

const FinalityDetailsSchema = z.object({
  chain_id: z.number().int(),
  chain_name: z.string().min(1),
  registration_block: z.number().int().nullable(),
  policy_block: z.number().int(),
  finality_confirmations: z.number().int().nullable(),
  eta_seconds: z.number().nonnegative().nullable(),
});

export type AppEnvEncryptPubKeyFinality = z.infer<typeof FinalityDetailsSchema>;

export interface WaitForAppEnvEncryptPubKeyOptions {
  signal?: AbortSignal;
  /** Called once, on the first explicit finality response. */
  onFinalityWait?: (details: AppEnvEncryptPubKeyFinality | null) => void;
  /** Opt in only just after submitting a registration, for older servers. */
  retryLegacyTransientErrors?: boolean;
}

function readFinalityDetails(error: ResourceError): AppEnvEncryptPubKeyFinality | null {
  if (!Array.isArray(error.structuredDetails)) return null;
  const fields = Object.fromEntries(
    error.structuredDetails.flatMap((detail) =>
      typeof detail?.field === "string" ? [[detail.field, detail.value]] : [],
    ),
  );
  return FinalityDetailsSchema.safeParse(fields).data ?? null;
}

function retryAfterMs(error: PhalaCloudError): number | undefined {
  const seconds = error.response?.headers.get("Retry-After")?.trim();
  if (!seconds || !/^\d+$/.test(seconds)) return;
  const milliseconds = Number(seconds) * 1000;
  return Number.isSafeInteger(milliseconds) ? milliseconds : undefined;
}

function isTransient(error: PhalaCloudError): boolean {
  return [0, 408, 429, 502, 503, 504].includes(error.status);
}

function isLegacyNotRegistered(error: PhalaCloudError): boolean {
  // Some older servers returned an ambiguous not-registered error even right
  // after registration, without distinguishing finality from absence.
  return (
    (error.status === 400 || error.status === 404) &&
    /\b(?:AppNotRegistered|app(?:lication)? (?:is )?not (?:yet )?registered)\b/i.test(error.message)
  );
}

async function sleepUntil(time: number, signal?: AbortSignal): Promise<void> {
  while (Date.now() < time) {
    signal?.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(signal?.reason);
      };
      const timer = setTimeout(
        () => {
          signal?.removeEventListener("abort", abort);
          resolve();
        },
        Math.min(time - Date.now(), MAX_TIMER_MS),
      );
      signal?.addEventListener("abort", abort, { once: true });
    });
  }
}

async function fetchPubkey(
  client: Client<ApiVersion>,
  endpoint: string,
  remainingMs: number,
  signal?: AbortSignal,
): Promise<unknown> {
  // ofetch does not apply its own timeout if passed a signal. Keep the
  // configured request timeout and cap each request at the polling deadline.
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  const timer = setTimeout(
    () => controller.abort(new DOMException("The public key request timed out.", "TimeoutError")),
    Math.min(client.config.timeout || 60_000, remainingMs, MAX_TIMER_MS),
  );
  signal?.addEventListener("abort", abort, { once: true });
  try {
    return await client.get(endpoint, {
      signal: controller.signal,
      retry: 0,
      ignoreResponseError: false,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

/**
 * Get an environment encryption key, waiting only for an explicit finality
 * response by default. Once waiting, transient failures do not interrupt it.
 * A definitive not-registered response is never polled. On deadline expiry,
 * throws the last retryable error.
 */
export async function waitForAppEnvEncryptPubKey(
  client: Client<ApiVersion>,
  request: GetAppEnvEncryptPubKeyRequest,
  options: WaitForAppEnvEncryptPubKeyOptions = {},
): Promise<GetAppEnvEncryptPubKey> {
  const endpoint = pubkeyEndpoint(request);
  const signal = options.signal ?? client.config.signal ?? undefined;
  let lastError: PhalaCloudError | undefined;
  let deadline = Infinity;
  let sawFinality = false;
  let sawEta = false;

  for (;;) {
    signal?.throwIfAborted();
    const remainingMs = deadline - Date.now();
    if (lastError && remainingMs <= 0) throw lastError;

    try {
      const data = await fetchPubkey(client, endpoint, remainingMs, signal);
      signal?.throwIfAborted();
      return GetAppEnvEncryptPubKeySchema.parse(data);
    } catch (error) {
      signal?.throwIfAborted();
      if (!(error instanceof PhalaCloudError)) throw error;
      if (error instanceof ResourceError && error.errorCode === NOT_REGISTERED_CODE) throw error;
      if (lastError && error.status === 0 && Date.now() >= deadline) throw lastError;

      const finality =
        error instanceof ResourceError &&
        error.status === 409 &&
        error.errorCode === FINALITY_WAIT_CODE
          ? error
          : undefined;
      if (!finality) {
        const legacyFallback = !sawFinality && options.retryLegacyTransientErrors;
        const retryTransient = (sawFinality || legacyFallback) && isTransient(error);
        if (!retryTransient && !(legacyFallback && isLegacyNotRegistered(error))) throw error;
      }

      const now = Date.now();
      const delay = retryAfterMs(error) ?? (finality ? FINALITY_RETRY_MS : LEGACY_RETRY_MS);
      const details = finality ? readFinalityDetails(finality) : null;
      const eta = details?.eta_seconds ?? null;
      if (!lastError || (finality && !sawFinality) || (eta !== null && !sawEta)) {
        const budget = eta === null ? UNKNOWN_FINALITY_BUDGET_MS : eta * 1000 + FINALITY_MARGIN_MS;
        const nextDeadline = now + Math.max(budget, delay + FINALITY_MARGIN_MS);
        // Anchor the deadline on the first response of each kind. A repeated
        // ETA is not a new deadline, even if the chain is no longer advancing.
        deadline = Math.max(lastError ? deadline : 0, nextDeadline);
      }
      lastError = error;
      if (eta !== null) sawEta = true;
      if (finality && !sawFinality) {
        sawFinality = true;
        options.onFinalityWait?.(details);
      }
      await sleepUntil(Math.min(deadline, now + Math.max(1, delay)), signal);
    }
  }
}
