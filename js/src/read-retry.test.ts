import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createClient } from "./client";

const contract = JSON.parse(readFileSync(new URL("../../go/testdata/read-retry.json", import.meta.url), "utf8"));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("shared read retry contract", () => {
  for (const scenario of contract.cases) {
    test(scenario.name, async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const start = Date.now();
      const calls: number[] = [];
      vi.stubGlobal("fetch", vi.fn(async (_request, options) => {
        calls.push((Date.now() - start) / 1000);
        const headers = new Headers(options.headers);
        expect(headers.get("X-Phala-Version")).toBe("2026-06-23");
        const reply = scenario.responses[Math.min(calls.length - 1, scenario.responses.length - 1)];
        const responseHeaders = new Headers({ "Content-Type": "application/json" });
        if (reply.retry_after !== undefined) responseHeaders.set("Retry-After", reply.retry_after);
        if (reply.http_date_seconds !== undefined) {
          responseHeaders.set("Retry-After", new Date(Date.now() + reply.http_date_seconds * 1000).toUTCString());
        }
        return new Response(JSON.stringify({ ok: true, error_code: reply.error_code }), {
          status: reply.status, headers: responseHeaders,
        });
      }));
      const controller = new AbortController();
      if (scenario.operation_timeout !== undefined) {
        setTimeout(() => controller.abort(new DOMException("Operation deadline exceeded", "TimeoutError")), scenario.operation_timeout * 1000);
      }
      if (scenario.cancel_after !== undefined) {
        setTimeout(() => controller.abort(new DOMException("Operation cancelled", "AbortError")), scenario.cancel_after * 1000);
      }
      const client = createClient({ apiKey: "test-key", timeout: contract.request_timeout * 1000,
        ...(scenario.max_retries === undefined ? {} : { retry: scenario.max_retries }) });
      const result = client.request("/retry-contract", {
        method: scenario.method, signal: controller.signal,
      }).then(data => ({ status: 200, data }), error => ({ status: error.status ?? 0, error }));
      await vi.runAllTimersAsync();
      const actual = await result;
      expect(calls).toEqual(scenario.expected_times);
      expect(actual.status).toBe(scenario.expected_status);
      if (scenario.expected_error) {
        expect("error" in actual).toBe(true);
      }
    });
  }
});

test("requestFull retries reads and returns the exhausted HTTP response", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn(async () => new Response("{}", { status: 429 }));
  vi.stubGlobal("fetch", fetch);
  const client = createClient({ retry: 2 });
  const pending = client.requestFull("/test");
  await vi.runAllTimersAsync();
  expect((await pending).status).toBe(429);
  expect(fetch).toHaveBeenCalledTimes(3);
});

test("read retry budgets reject invalid values", () => {
  for (const retry of [-1, 1.5, Infinity]) {
    expect(() => createClient({ retry })).toThrow(RangeError);
  }
});

test("an operation signal preserves the individual request timeout", async () => {
  vi.useFakeTimers();
  const operation = new AbortController();
  let timedOutAt = 0;
  const started = Date.now();
  const fetch = vi.fn((_request, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => {
      timedOutAt = Date.now() - started;
      reject(options.signal.reason);
    }, { once: true });
  }));
  vi.stubGlobal("fetch", fetch);
  const pending = createClient({ timeout: 1000 }).get("/test", { signal: operation.signal })
    .then(() => undefined, error => error);
  await vi.runAllTimersAsync();
  expect((await pending).code).toBe("TIMEOUT");
  expect(timedOutAt).toBe(1000);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("an already cancelled operation sends no request", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const controller = new AbortController();
  controller.abort();
  await expect(createClient().get("/test", { signal: controller.signal })).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});

test("a transport error is not replayed", async () => {
  const fetch = vi.fn(async () => { throw new Error("Network unavailable"); });
  vi.stubGlobal("fetch", fetch);
  await expect(createClient().get("/test")).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test.each(["text", "blob", "arrayBuffer"] as const)("structured conflicts stay permanent with responseType=%s", async responseType => {
  const fetch = vi.fn(async () => new Response('{"error_code":"PERMANENT"}', {
    status: 409, headers: { "Content-Type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetch);
  await expect(createClient().get("/test", { responseType })).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});
