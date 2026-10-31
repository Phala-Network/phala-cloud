import ky, { isHTTPError } from "ky";
import type {
  FetchContext,
  FetchOptions,
  FetchRequest,
  FetchResponse,
  ResponseType,
  ofetch,
} from "ofetch";

export function readRetryBudget(retry: number | false | undefined): number {
  const budget = retry === false ? 0 : (retry ?? 30);
  if (!Number.isSafeInteger(budget) || budget < 0) {
    throw new RangeError("retry must be a non-negative integer or false");
  }
  return budget;
}

export async function fetchWithReadRetry<T, R extends ResponseType = ResponseType>(
  fetcher: typeof ofetch,
  request: FetchRequest,
  suppliedOptions: FetchOptions<R> | undefined,
  defaults: FetchOptions,
): Promise<FetchResponse<T>> {
  const options = { ...defaults, ...suppliedOptions };
  if (
    !["GET", "HEAD"].includes(String(options.method ?? "GET").toUpperCase()) ||
    options.responseType === "stream"
  ) {
    return (await fetcher.raw<T, R>(request, suppliedOptions)) as FetchResponse<T>;
  }
  options.signal?.throwIfAborted();
  const statuses = options.retryStatusCodes ?? [409, 429, 503];
  const transport = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      let configuredDelay = typeof options.retryDelay === "number" ? options.retryDelay : undefined;
      try {
        return await ky(input, {
          ...init,
          fetch: fetcher.native,
          timeout: options.timeout === 0 ? false : (options.timeout ?? 60_000),
          retry: {
            limit: readRetryBudget(options.retry),
            methods: ["get", "head"],
            statusCodes: statuses,
            afterStatusCodes: statuses,
            backoffLimit: 20_000,
            delay: (attempt) => configuredDelay ?? 1000 * 2 ** (attempt - 1),
            shouldRetry: async ({ error }) => {
              if (!isHTTPError(error)) return false;
              const response = Object.assign(error.response, {
                _data: await error.response
                  .clone()
                  .json()
                  .catch(() => undefined),
              });
              if (
                response.status === 409 &&
                typeof response._data?.error_code === "string" &&
                response._data.error_code
              )
                return false;
              if (typeof options.retryDelay === "function") {
                configuredDelay = options.retryDelay({
                  request,
                  options,
                  response,
                } as FetchContext<unknown, R>);
              }
              return undefined;
            },
          },
        });
      } catch (error) {
        // Let ofetch retain its existing response decoding and SDK error handling.
        if (isHTTPError(error)) return error.response;
        throw error;
      }
    },
    fetcher.native,
  );
  return (await fetcher.create({}, { fetch: transport }).raw<T, R>(request, {
    ...suppliedOptions,
    retry: 0,
    timeout: 0,
  })) as FetchResponse<T>;
}
