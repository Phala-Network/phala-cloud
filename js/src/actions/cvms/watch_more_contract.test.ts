import { afterEach, expect, it, vi } from "vitest";
import { createBaseClient, createClient, watchCvmState, WatchAbortedError, MaxRetriesExceededError } from "../../index";

const complete = 'event: state\ndata: {"id":"cvm-123","name":"example","status":"running","boot_progress":"done"}\n\nevent: complete\ndata: {"status":"running","target":"running","elapsed":1}\n\n';
const timeout = 'event: timeout\ndata: {"error":"Timeout waiting for target status","elapsed":10,"target":"running"}\n\n';
const request = { id: "cvm-123", target: "running", maxRetries: 1, retryDelay: 0 };

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("propagates environment credentials, workspace, and custom headers", async () => {
  vi.stubEnv("PHALA_CLOUD_API_KEY", "");
  vi.stubEnv("PHALA_OIDC_TOKEN", "env-token");
  vi.stubEnv("PHALA_CLOUD_WORKSPACE", " env-workspace ");
  let headers = new Headers();
  vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    headers = new Headers(init?.headers);
    return new Response(complete);
  }));
  await watchCvmState(createBaseClient({ baseURL: "https://example.test", headers: { "X-Custom": "value" } }), request);
  expect(headers.get("authorization")).toBe("Bearer env-token");
  expect(headers.get("x-phala-workspace")).toBe("env-workspace");
  expect(headers.get("x-custom")).toBe("value");
});

it("prefers explicit bearer and workspace configuration over environment values", async () => {
  vi.stubEnv("PHALA_CLOUD_API_KEY", "");
  vi.stubEnv("PHALA_OIDC_TOKEN", "env-token");
  vi.stubEnv("PHALA_CLOUD_WORKSPACE", "env-workspace");
  let headers = new Headers();
  vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    headers = new Headers(init?.headers);
    return new Response(complete);
  }));
  await watchCvmState(createBaseClient({ baseURL: "https://example.test", bearerToken: "explicit-token", workspace: "explicit-workspace" }), request);
  expect(headers.get("authorization")).toBe("Bearer explicit-token");
  expect(headers.get("x-phala-workspace")).toBe("explicit-workspace");
});

it("applies configured credentials and workspace over case-insensitive custom header names", async () => {
  let headers = new Headers();
  vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    headers = new Headers(init?.headers);
    return new Response(complete);
  }));
  await watchCvmState(createBaseClient({ baseURL: "https://example.test", apiKey: "actual", workspace: "correct", headers: { "x-api-key": "stale", "x-phala-workspace": "wrong" } }), request);
  expect(headers.get("x-api-key")).toBe("actual");
  expect(headers.get("x-phala-workspace")).toBe("correct");
});

it.each(["x-phala-version", "X-PHALA-VERSION"])("uses the selected version for SSE requests despite %s", async headerName => {
  const versions: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    versions.push(new Headers(init?.headers).get("x-phala-version") ?? "missing");
    return new Response(complete);
  }));
  const client = createClient({ baseURL: "https://example.test", version: "2026-05-22", headers: { [headerName]: "2026-06-23" } });
  await client.watchCvmState({ ...request, maxRetries: 0 });
  await client.withVersion("2025-10-28").watchCvmState({ ...request, maxRetries: 0 });
  expect(versions).toEqual(["2026-05-22", "2025-10-28"]);
});

it("uses cookie credentials without configured API key or bearer headers", async () => {
  let headers = new Headers();
  let credentials: RequestCredentials | undefined;
  vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    headers = new Headers(init?.headers); credentials = init?.credentials;
    return new Response(complete);
  }));
  await watchCvmState(createBaseClient({ baseURL: "https://example.test", apiKey: "key", bearerToken: "token", workspace: "workspace", useCookieAuth: true }), request);
  expect(credentials).toBe("include");
  expect(headers.get("authorization")).toBeNull();
  expect(headers.get("x-api-key")).toBeNull();
  expect(headers.get("x-phala-workspace")).toBe("workspace");
});

it.each([408, 429, 500, 503])("retries transient HTTP %i before succeeding", async status => {
  let attempts = 0;
  vi.stubGlobal("fetch", vi.fn(async () => ++attempts === 1 ? new Response("temporary", { status }) : new Response(complete)));
  const state = await watchCvmState(createBaseClient({ baseURL: "https://example.test" }), request);
  expect(state.status).toBe("running");
  expect(attempts).toBe(2);
});

it("retries a transport failure before succeeding", async () => {
  let attempts = 0;
  vi.stubGlobal("fetch", vi.fn(async () => {
    if (++attempts === 1) throw new TypeError("network failed");
    return new Response(complete);
  }));
  const events: string[] = [];
  const state = await watchCvmState(createBaseClient({ baseURL: "https://example.test" }), request, { onEvent: event => events.push(event.type) });
  expect(state.status).toBe("running");
  expect(attempts).toBe(2);
  expect(events).toEqual(["error", "state", "complete"]);
});

it("exhausts the initial stream and every configured timeout retry", async () => {
  let attempts = 0;
  vi.stubGlobal("fetch", vi.fn(async () => { attempts++; return new Response(timeout); }));
  const result = watchCvmState(createBaseClient({ baseURL: "https://example.test" }), { ...request, maxRetries: 2 });
  await expect(result).rejects.toMatchObject({ name: "MaxRetriesExceededError", attempts: 3 });
  expect(attempts).toBe(3);
});

it("cancels during retry delay without making another request", async () => {
  let attempts = 0;
  const controller = new AbortController();
  vi.stubGlobal("fetch", vi.fn(async () => { attempts++; return new Response(timeout); }));
  const result = watchCvmState(createBaseClient({ baseURL: "https://example.test" }), { ...request, retryDelay: 10000 }, { signal: controller.signal, onEvent: event => { if (event.type === "timeout") setTimeout(() => controller.abort(), 0); } });
  await expect(result).rejects.toBeInstanceOf(WatchAbortedError);
  expect(attempts).toBe(1);
});

it("honors cancellation triggered by a terminal event callback", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(complete)));
  const controller = new AbortController();
  await expect(watchCvmState(createBaseClient({ baseURL: "https://example.test" }), request, {
    signal: controller.signal,
    onEvent: event => { if (event.type === "complete") controller.abort(); },
  })).rejects.toBeInstanceOf(WatchAbortedError);
});

it("makes no request when already aborted", async () => {
  const fetchMock = vi.fn(async () => new Response(complete));
  vi.stubGlobal("fetch", fetchMock);
  const controller = new AbortController(); controller.abort();
  await expect(watchCvmState(createBaseClient({ baseURL: "https://example.test" }), request, { signal: controller.signal })).rejects.toBeInstanceOf(WatchAbortedError);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("preserves an initial server error after retries are exhausted without a callback", async () => {
  let attempts = 0;
  vi.stubGlobal("fetch", vi.fn(async () => {
    attempts++;
    return new Response('event: error\ndata: {"error":"CVM status unavailable","elapsed":0}\n\n');
  }));
  await expect(watchCvmState(createBaseClient({ baseURL: "https://example.test" }), { ...request, maxRetries: 1 })).rejects.toThrow("CVM status unavailable");
  expect(attempts).toBe(2);
});

it("retains the most recent server diagnostic across a subsequent EOF", async () => {
  let attempts = 0;
  vi.stubGlobal("fetch", vi.fn(async () => ++attempts === 1
    ? new Response('event: error\ndata: {"error":"Internal server error","message":"upstream unavailable"}\n\n')
    : new Response('event: state\ndata: {"name":"example","status":"starting"}\n\n')));
  await expect(watchCvmState(createBaseClient({ baseURL: "https://example.test" }), request)).rejects.toMatchObject({
    name: "MaxRetriesExceededError", attempts: 2,
    lastServerError: { error: "Internal server error", message: "upstream unavailable" },
    message: expect.stringContaining("upstream unavailable"),
  });
});

it("retains a server diagnostic when the last retry ends with a transport failure", async () => {
  let attempts = 0;
  const transportError = new TypeError("network failed");
  vi.stubGlobal("fetch", vi.fn(async () => {
    if (++attempts === 1) return new Response('event: error\ndata: {"error":"CVM status unavailable","elapsed":0}\n\n');
    throw transportError;
  }));
  const error: unknown = await watchCvmState(createBaseClient({ baseURL: "https://example.test" }), request).catch(error => error);
  expect(error).toMatchObject({
    lastServerError: { error: "CVM status unavailable", elapsed: 0 },
    message: expect.stringContaining("CVM status unavailable"),
  });
  expect(error).toBeInstanceOf(MaxRetriesExceededError);
  if (!(error instanceof MaxRetriesExceededError)) throw new Error("Expected retry exhaustion");
  expect(error.lastAttemptError).toBe(transportError);
});

it("retries an error followed by EOF and can subsequently complete", async () => {
  let attempts = 0;
  vi.stubGlobal("fetch", vi.fn(async () => ++attempts === 1
    ? new Response('event: error\ndata: {"error":"CVM status unavailable","elapsed":0}\n\n')
    : new Response(complete)));
  const state = await watchCvmState(createBaseClient({ baseURL: "https://example.test" }), request);
  expect(state.status).toBe("running");
  expect(attempts).toBe(2);
});

it("does not claim success when a complete frame arrives without any state", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('event: complete\ndata: {"status":"running","target":"running","elapsed":1}\n\n')));
  await expect(watchCvmState(createBaseClient({ baseURL: "https://example.test" }), { ...request, maxRetries: 0 })).rejects.toBeInstanceOf(MaxRetriesExceededError);
});
