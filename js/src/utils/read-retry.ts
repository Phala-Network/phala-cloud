import type { FetchOptions, FetchRequest, FetchResponse, ResponseType, ofetch } from "ofetch";

export function readRetryBudget(retry: number | false | undefined): number {
  const budget = retry === false ? 0 : (retry ?? 30);
  if (!Number.isSafeInteger(budget) || budget < 0) {
    throw new RangeError("retry must be a non-negative integer or false");
  }
  return budget;
}

const hooks = <T>(hook: T | T[] | undefined): T[] => (hook ? ([] as T[]).concat(hook) : []);

function wait(delay: number, signal?: AbortSignal | null): Promise<void> {
  signal?.throwIfAborted();
  if (!Number.isFinite(delay) || delay < 0 || delay > 2 ** 31 - 1) {
    throw new RangeError("retry delay exceeds the supported timer range");
  }
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, delay);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function fetchWithReadRetry<T, R extends ResponseType = ResponseType>(
  fetcher: typeof ofetch,
  request: FetchRequest,
  suppliedOptions: FetchOptions<R> | undefined,
  defaults: FetchOptions,
): Promise<FetchResponse<T>> {
  const options = { ...defaults, ...suppliedOptions };
  const method = String(options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method) || options.responseType === "stream") {
    return (await fetcher.raw<T, R>(request, suppliedOptions)) as FetchResponse<T>;
  }
  const signal = options.signal;
  const timeout = options.timeout ?? 60_000;
  const statuses = options.retryStatusCodes ?? [409, 429, 503];
  let attempt = 0;
  try {
    return (await fetcher.raw<T, R>(request, {
      ...suppliedOptions,
      retry: readRetryBudget(options.retry),
      retryStatusCodes: statuses,
      retryDelay: 0,
      timeout: 0,
      ignoreResponseError: false,
      onRequest: [
        ...hooks(options.onRequest),
        (context) => {
          signal?.throwIfAborted();
          const deadline = timeout > 0 ? AbortSignal.timeout(timeout) : undefined;
          context.options.signal =
            signal && deadline ? AbortSignal.any([signal, deadline]) : (signal ?? deadline);
        },
      ],
      onRequestError: [
        ...hooks(options.onRequestError),
        (context) => {
          context.options.retry = 0;
        },
      ],
      onResponseError: options.ignoreResponseError ? undefined : options.onResponseError,
      onResponse: [
        ...hooks(options.onResponse),
        async (context) => {
          const { response, options: current } = context;
          let body = response._data;
          if (response.status === 409) {
            try {
              if (body instanceof Blob) body = await body.text();
              if (body instanceof ArrayBuffer) body = new TextDecoder().decode(body);
              if (typeof body === "string") body = JSON.parse(body);
            } catch {
              body = undefined;
            }
          }
          if (response.status === 409 && typeof body?.error_code === "string" && body.error_code) {
            current.retry = 0;
          }
          if (!current.retry || !statuses.includes(response.status)) return;
          const after = response.headers.get("Retry-After");
          const serverDelay =
            after && (/^\d+$/.test(after) ? Number(after) * 1000 : Date.parse(after) - Date.now());
          const configured =
            typeof options.retryDelay === "function"
              ? options.retryDelay(context)
              : options.retryDelay;
          // ofetch owns retries; wait here because its retryDelay isn't cancellable.
          await wait(
            serverDelay && serverDelay > 0
              ? serverDelay
              : (configured ?? Math.min(1000 * 2 ** attempt, 20_000)),
            signal,
          );
          attempt++;
        },
      ],
    })) as FetchResponse<T>;
  } catch (error) {
    const response = (error as { response?: FetchResponse<T> })?.response;
    if (options.ignoreResponseError && response) return response;
    throw error;
  }
}
