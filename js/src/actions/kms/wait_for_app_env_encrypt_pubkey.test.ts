import { afterEach, expect, it, vi } from "vitest";
import {
  createClient,
  getAppEnvEncryptPubKey,
  waitForAppEnvEncryptPubKey,
} from "../../index";

const request = { kms: "kms_base", app_id: `0x${"a".repeat(40)}` };
const key = { public_key: "aa", signature: "bb" };
const finality = {
  chain_id: 8453,
  chain_name: "Base",
  registration_block: 1000,
  policy_block: 990,
  finality_confirmations: null,
  eta_seconds: 1200,
};

function pending(eta: number | null, retryAfter: string) {
  return Response.json(
    {
      error_code: "ERR-12-008",
      message: "Waiting for the app registration to finalize on Base.",
      details: Object.entries({ ...finality, eta_seconds: eta }).map(([field, value]) => ({
        field,
        value,
      })),
    },
    { status: 409, headers: { "Retry-After": retryAfter } },
  );
}

function mockHttp() {
  const fetch = vi.fn<typeof globalThis.fetch>();
  vi.stubGlobal("fetch", fetch);
  const client = createClient({ baseURL: "https://api.example.test" });
  return { client, fetch };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("waits for finality on HTTP 409 and follows Retry-After, not the ETA", async () => {
  vi.useFakeTimers();
  const { client, fetch } = mockHttp();
  fetch.mockImplementationOnce(async () => pending(1200, "11"));
  fetch.mockImplementationOnce(async () => pending(1200, "7"));
  fetch.mockImplementationOnce(async () => Response.json(key));
  const onFinalityWait = vi.fn();
  const result = waitForAppEnvEncryptPubKey(client, request, { onFinalityWait });

  await vi.advanceTimersByTimeAsync(10_999);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0]?.[0]).toBe(
    `https://api.example.test/kms/${request.kms}/pubkey/${request.app_id}`,
  );
  expect(onFinalityWait).toHaveBeenCalledExactlyOnceWith(finality);
  await vi.advanceTimersByTimeAsync(7000);
  expect(fetch).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toEqual(key);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(onFinalityWait).toHaveBeenCalledTimes(1);
});

it("keeps waiting through a transient 502 after confirmed finality wait without legacy opt-in", async () => {
  vi.useFakeTimers();
  const { client, fetch } = mockHttp();
  fetch.mockImplementationOnce(async () => pending(1200, "5"));
  fetch.mockImplementationOnce(async () =>
    Response.json({ detail: "Bad Gateway" }, { status: 502, headers: { "Retry-After": "9" } }),
  );
  fetch.mockImplementationOnce(async () => Response.json(key));
  const onFinalityWait = vi.fn();
  const result = waitForAppEnvEncryptPubKey(client, request, { onFinalityWait }).catch(
    (error: unknown) => error,
  );

  await vi.advanceTimersByTimeAsync(13_999);
  expect(fetch).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toEqual(key);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(onFinalityWait).toHaveBeenCalledExactlyOnceWith(finality);
});

it.each([
  [404, "ERR-12-009", "App is not registered on Base."],
  [409, "ERR-12-005", "This app is bound to a different KMS."],
] as const)("fails immediately for terminal HTTP %i (%s) after the wait has started", async (status, errorCode, message) => {
  vi.useFakeTimers();
  const { client, fetch } = mockHttp();
  fetch.mockImplementationOnce(async () => pending(1200, "5"));
  fetch.mockImplementationOnce(async () =>
    Response.json({ error_code: errorCode, message }, { status }),
  );
  const result = waitForAppEnvEncryptPubKey(client, request, {
    retryLegacyTransientErrors: true,
  }).catch((error: unknown) => error);

  await vi.advanceTimersByTimeAsync(5000);
  expect(await result).toMatchObject({ status, errorCode, message });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("uses the first ETA plus a margin without extending the deadline on repeated estimates", async () => {
  vi.useFakeTimers();
  const { client, fetch } = mockHttp();
  fetch.mockImplementation(async () => pending(1200, "100"));
  const result = waitForAppEnvEncryptPubKey(client, request).catch((error: unknown) => error);

  await vi.advanceTimersByTimeAsync(2_099_999);
  expect(fetch).toHaveBeenCalledTimes(21); // The request at 2,000 seconds is allowed.
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toMatchObject({ status: 409, errorCode: "ERR-12-008" });
  expect(fetch).toHaveBeenCalledTimes(21);
});

it("gives a late first estimate its full wait budget without printing a second update", async () => {
  vi.useFakeTimers();
  const { client, fetch } = mockHttp();
  fetch.mockImplementationOnce(async () => pending(null, "2300"));
  fetch.mockImplementation(async () => pending(1200, "500"));
  const onFinalityWait = vi.fn();
  const result = waitForAppEnvEncryptPubKey(client, request, { onFinalityWait }).catch(
    (error: unknown) => error,
  );

  await vi.advanceTimersByTimeAsync(4_399_999);
  expect(fetch).toHaveBeenCalledTimes(6); // The request at 4,300 seconds is allowed.
  expect(onFinalityWait).toHaveBeenCalledExactlyOnceWith({ ...finality, eta_seconds: null });
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toMatchObject({ status: 409, errorCode: "ERR-12-008" });
  expect(fetch).toHaveBeenCalledTimes(6);
});

it("stops an in-flight poll at the finality deadline", async () => {
  vi.useFakeTimers();
  const { client, fetch } = mockHttp();
  fetch.mockImplementationOnce(async () => pending(0, "500"));
  fetch.mockImplementationOnce(async () => pending(0, "890"));
  let signal: AbortSignal | null | undefined;
  fetch.mockImplementationOnce((_, init) => {
    signal = init?.signal;
    return new Promise<Response>((_, reject) => {
      signal?.addEventListener("abort", () => reject(signal?.reason), { once: true });
    });
  });
  const result = waitForAppEnvEncryptPubKey(client, request).catch((error: unknown) => error);

  await vi.advanceTimersByTimeAsync(1_399_999);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(signal?.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(signal?.aborted).toBe(true);
  expect(await result).toMatchObject({ status: 409, errorCode: "ERR-12-008" });
  expect(fetch).toHaveBeenCalledTimes(3);
});

it("uses Retry-After even when the finality estimate is unavailable", async () => {
  vi.useFakeTimers();
  const { client, fetch } = mockHttp();
  fetch.mockImplementationOnce(async () => pending(null, "5"));
  fetch.mockImplementationOnce(async () => Response.json(key));
  const onFinalityWait = vi.fn();
  const result = waitForAppEnvEncryptPubKey(client, request, { onFinalityWait });

  await vi.advanceTimersByTimeAsync(4_999);
  expect(onFinalityWait).toHaveBeenCalledExactlyOnceWith({ ...finality, eta_seconds: null });
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toEqual(key);
});

it("fails immediately with the definitive not-registered message even in legacy mode", async () => {
  const { client, fetch } = mockHttp();
  const message = "App is not registered on Base.";
  fetch.mockImplementation(async () =>
    Response.json(
      {
        error_code: "ERR-12-009",
        message,
        details: [
          { field: "chain_id", value: 8453 },
          { field: "chain_name", value: "Base" },
          { field: "app_id", value: request.app_id },
          { field: "requested_kms", value: request.kms },
        ],
      },
      { status: 404, headers: { "Retry-After": "15" } },
    ),
  );
  const onFinalityWait = vi.fn();
  await expect(
    waitForAppEnvEncryptPubKey(client, request, {
      onFinalityWait,
      retryLegacyTransientErrors: true,
    }),
  ).rejects.toMatchObject({ status: 404, errorCode: "ERR-12-009", message });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(onFinalityWait).not.toHaveBeenCalled();
});

it.each([
  [409, "Another conflict"],
  [404, "KMS not found"],
  [404, "App not registered"],
  [503, "A node is temporarily down"],
])("does not wait by default for unrelated or legacy HTTP %i (%s)", async (status, message) => {
  const { client, fetch } = mockHttp();
  fetch.mockImplementation(async () => Response.json({ detail: message }, { status }));
  await expect(waitForAppEnvEncryptPubKey(client, request)).rejects.toMatchObject({
    status,
    message,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("supports old not-registered and transient server responses after fresh registration", async () => {
  vi.useFakeTimers();
  const { client, fetch } = mockHttp();
  fetch.mockImplementationOnce(async () =>
    Response.json({ detail: "AppNotRegistered" }, { status: 404 }),
  );
  fetch.mockImplementationOnce(async () =>
    Response.json({ detail: "Slow down" }, { status: 429, headers: { "Retry-After": "23" } }),
  );
  fetch.mockImplementationOnce(async () => Response.json(key));
  const onFinalityWait = vi.fn();
  const result = waitForAppEnvEncryptPubKey(client, request, {
    retryLegacyTransientErrors: true,
    onFinalityWait,
  });

  await vi.advanceTimersByTimeAsync(14_999);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(23_000);
  expect(fetch).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toEqual(key);
  expect(onFinalityWait).not.toHaveBeenCalled();
});

it("uses a retry interval, not an ETA, when Retry-After is invalid", async () => {
  vi.useFakeTimers();
  const { client, fetch } = mockHttp();
  fetch.mockImplementationOnce(async () => pending(null, "not-a-delay"));
  fetch.mockImplementationOnce(async () => Response.json(key));
  const result = waitForAppEnvEncryptPubKey(client, request);

  await vi.advanceTimersByTimeAsync(4_999);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toEqual(key);
});

it("cancels during a long Retry-After without issuing another request", async () => {
  vi.useFakeTimers();
  const { client, fetch } = mockHttp();
  fetch.mockImplementation(async () => pending(1200, "300"));
  const controller = new AbortController();
  const reason = new Error("Cancelled by caller");
  const result = waitForAppEnvEncryptPubKey(client, request, { signal: controller.signal });
  const cancelled = expect(result).rejects.toBe(reason);

  await vi.advanceTimersByTimeAsync(1000);
  controller.abort(reason);
  await cancelled;
  await vi.advanceTimersByTimeAsync(300_000);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("keeps the original action non-waiting even when the key is not finalized", async () => {
  const { client, fetch } = mockHttp();
  fetch.mockImplementation(async () => pending(1200, "3600"));
  // The existing action leaves transport retry configuration up to the client.
  const singleRequestClient = createClient({ baseURL: client.config.baseURL, retry: 0 });
  await expect(getAppEnvEncryptPubKey(singleRequestClient, request)).rejects.toMatchObject({
    status: 409,
    errorCode: "ERR-12-008",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
