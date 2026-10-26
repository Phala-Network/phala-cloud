import pRetry, { AbortError } from "p-retry";
import { createTimeout } from "retry";
import { createDelay } from "delay";
import { setTimeout as setLongTimeout, clearTimeout as clearLongTimeout } from "long-timeout";
import type { FetchOptions, FetchRequest, FetchResponse, ResponseType, ofetch } from "ofetch";

const MAX_SERVER_DELAY_MS = (2 ** 63 - 1) / 1_000_000;

export function readRetryBudget(retry: number | false | undefined): number {
  const budget = retry === false ? 0 : (retry ?? 30);
  if (!Number.isSafeInteger(budget) || budget < 0) {
    throw new RangeError("retry must be a non-negative integer or false");
  }
  return budget;
}

function throwIfAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Operation cancelled", "AbortError");
  }
}

// Library timers preserve both cancellation and waits above the JS timer limit.
const waitForRetry = createDelay({ setTimeout: setLongTimeout, clearTimeout: clearLongTimeout });

class RetryableResponse extends Error {
  constructor(
    readonly response: FetchResponse<unknown>,
    readonly failure?: unknown,
  ) {
    super(`Retryable HTTP ${response.status}`);
  }
}

// p-retry requires Error instances; preserve arbitrary errors from fetch hooks.
class PermanentFailure extends Error {
  constructor(readonly failure: unknown) {
    super("Non-retryable request failure");
  }
}

function serverDelay(response: Response): number | undefined {
  const header = response.headers.get("Retry-After")?.trim();
  if (!header) return undefined;
  if (/^[0-9]+$/.test(header)) {
    const delay = Math.min(Number(header) * 1000, MAX_SERVER_DELAY_MS);
    return delay > 0 ? delay : undefined;
  }
  const dayNames = "(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)";
  const months = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
  const clock = "([0-9]{2}):([0-9]{2}):([0-9]{2})";
  const modern = header.match(
    new RegExp(`^${dayNames}, ([0-9]{2}) (${months}) ([0-9]{4}) ${clock} GMT$`),
  );
  const obsolete = header.match(
    new RegExp(
      `^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), ([0-9]{2})-(${months})-([0-9]{2}) ${clock} GMT$`,
    ),
  );
  const ascii = header.match(
    new RegExp(`^${dayNames} (${months}) ( {1}[0-9]|[0-9]{2}) ${clock} ([0-9]{4})$`),
  );
  const match = modern ?? obsolete;
  if (!match && !ascii) return undefined;
  const day = Number(match ? match[1] : ascii?.[2]);
  const month = months.split("|").indexOf((match ? match[2] : ascii?.[1]) ?? "");
  let year = Number(match ? match[3] : ascii?.[6]);
  if (obsolete) year += year < 69 ? 2000 : 1900;
  const hour = Number(match ? match[4] : ascii?.[3]);
  const minute = Number(match ? match[5] : ascii?.[4]);
  const second = Number(match ? match[6] : ascii?.[5]);
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(hour, minute, second, 0);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  )
    return undefined;
  const delay = date.getTime() - Date.now();
  return delay > 0 ? Math.min(delay, MAX_SERVER_DELAY_MS) : undefined;
}

async function retryable(response: FetchResponse<unknown>, statuses: number[]): Promise<boolean> {
  if (!statuses.includes(response.status)) return false;
  let body = response._data;
  if (body instanceof Blob) body = await body.text();
  if (body instanceof ArrayBuffer) body = new TextDecoder().decode(body);
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = undefined;
    }
  }
  return !(
    response.status === 409 &&
    body &&
    typeof body === "object" &&
    "error_code" in body &&
    typeof body.error_code === "string" &&
    body.error_code.length > 0
  );
}

export async function fetchWithReadRetry<T, R extends ResponseType = ResponseType>(
  fetcher: typeof ofetch,
  request: FetchRequest,
  suppliedOptions: FetchOptions<R> | undefined,
  defaults: FetchOptions,
): Promise<FetchResponse<T>> {
  const options = suppliedOptions ?? {};
  const method = String(options.method ?? defaults.method ?? "GET").toUpperCase();
  if (
    (method !== "GET" && method !== "HEAD") ||
    (options.responseType ?? defaults.responseType) === "stream"
  ) {
    return (await fetcher.raw<T, R>(request, options)) as FetchResponse<T>;
  }
  const budget = readRetryBudget(options.retry ?? defaults.retry);
  const signal = options.signal ?? defaults.signal;
  const timeout = options.timeout ?? defaults.timeout ?? 60_000;
  const statuses = options.retryStatusCodes ?? defaults.retryStatusCodes ?? [409, 429, 503];
  const customDelay = options.retryDelay ?? defaults.retryDelay;

  throwIfAborted(signal);
  try {
    return await pRetry(
      async () => {
        throwIfAborted(signal);
        // Compose the per-exchange timeout with the caller's operation signal.
        const controller = new AbortController();
        const abort = () => controller.abort(signal?.reason);
        signal?.addEventListener("abort", abort, { once: true });
        const timer =
          timeout > 0
            ? setLongTimeout(
                () => controller.abort(new DOMException("HTTP request timed out", "TimeoutError")),
                timeout,
              )
            : undefined;
        let response: FetchResponse<T>;
        let failure: unknown;
        try {
          response = (await fetcher.raw<T, R>(request, {
            ...options,
            retry: 0,
            timeout: 0,
            signal: controller.signal,
          })) as FetchResponse<T>;
        } catch (error) {
          const failedResponse = (error as { response?: FetchResponse<T> })?.response;
          if (!failedResponse) throw new AbortError(new PermanentFailure(error));
          response = failedResponse;
          failure = error;
        } finally {
          if (timer) clearLongTimeout(timer);
          signal?.removeEventListener("abort", abort);
        }
        throwIfAborted(signal);
        if (await retryable(response, statuses)) throw new RetryableResponse(response, failure);
        if (failure) throw new AbortError(new PermanentFailure(failure));
        return response;
      },
      {
        retries: budget,
        signal: signal ?? undefined,
        // The policy callback selects the delay because Retry-After can be either
        // shorter or longer than exponential backoff. p-retry owns the loop/budget.
        minTimeout: 0,
        maxTimeout: 0,
        onFailedAttempt: async (error) => {
          if (error.retriesLeft === 0) throw error;
          if (!(error instanceof RetryableResponse)) throw error;
          const response = error.response;
          const configuredDelay =
            typeof customDelay === "function"
              ? customDelay({ request, options, response } as Parameters<typeof customDelay>[0])
              : customDelay;
          const delay =
            serverDelay(response) ??
            configuredDelay ??
            createTimeout(error.attemptNumber - 1, {
              factor: 2,
              minTimeout: 1000,
              maxTimeout: 20_000,
              randomize: false,
            });
          if (!Number.isFinite(delay) || delay < 0)
            throw new RangeError("retryDelay must be a finite non-negative number");
          await waitForRetry(delay, { signal: signal ?? undefined });
        },
      },
    );
  } catch (error) {
    if (error instanceof PermanentFailure) throw error.failure;
    if (error instanceof RetryableResponse) {
      if (error.failure) throw error.failure;
      return error.response as FetchResponse<T>;
    }
    throw error;
  }
}
