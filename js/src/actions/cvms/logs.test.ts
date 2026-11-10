import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Client } from "../../client";
import { UnknownError } from "../../utils/errors";
import {
  CVM_LOGS_INFO_API_VERSION,
  fetchContainerLogs,
  fetchContainerLogsEntries,
  fetchCvmChannelLogs,
  fetchCvmLogs,
  followCvmLogs,
  LogAccessError,
  streamContainerLogs,
  streamContainerLogsEntries,
  streamCvmChannelLogs,
} from "./logs";

const detail = {
  id: "cvm_test",
  name: "test",
  status: "running",
  logs: {
    serial:
      "https://cloud-logs.example/logs/123/node/serial?uid=7&exp=2000000000&kid=test&sig=signature",
    stdout:
      "https://cloud-logs.example/logs/123/node/stdout?uid=7&exp=2000000000&kid=test&sig=signature",
    stderr: null,
    container_log_base: "https://cloud-logs.example/logs/123/container",
    auth_query: "uid=7&exp=2000000000&kid=test&sig=signature",
  },
};

const composition = {
  containers: [
    {
      id: "container-id",
      names: ["/app"],
      log_endpoint:
        "https://cloud-logs.example/logs/123/container/app?uid=7&exp=2000000000&kid=test&sig=signature",
    },
  ],
};

function mockClient(): Client {
  return {
    get: vi.fn(async (path: string) => {
      if (String(path).endsWith("/composition")) return composition;
      return detail;
    }),
    config: { version: "2026-06-23" },
  } as unknown as Client;
}

let fetchImplementation: (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;
const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) =>
  fetchImplementation(input, init),
);
const originalFetch = globalThis.fetch;

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status });
}

function ndjsonResponse(records: unknown[]): Response {
  if (records.length === 0) return new Response("");
  return new Response(`${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
}

beforeEach(() => {
  fetchMock.mockClear();
  fetchImplementation = async () => new Response("");
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe("CVM log access", { timeout: 20_000 }, () => {
  test("node follow reconnects with tail=0 and drops only exact heartbeat lines", async () => {
    const client = mockClient();
    const controller = new AbortController();
    const output: string[] = [];
    fetchImplementation = async () => {
      if (fetchMock.mock.calls.length === 1) {
        return new Response("[vmm heartbeat]\n[teepod heartbeat]\n\ncontains [vmm heartbeat]\n");
      }
      return new Response("reconnected\n");
    };

    await streamCvmChannelLogs(
      client,
      "app_test",
      "serial",
      (data) => {
        output.push(data);
        if (data === "reconnected\n") controller.abort();
      },
      { tail: 7 },
      controller.signal,
    );

    expect(output).toEqual(["\n", "contains [vmm heartbeat]\n", "reconnected\n"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
    expect(urls[0]?.pathname).toBe("/logs/123/node/serial");
    expect(urls[0]?.searchParams.get("tail")).toBe("7");
    expect(urls[0]?.searchParams.has("lines")).toBe(false);
    expect(urls[1]?.searchParams.get("tail")).toBe("0");
  });

  test("node short empty EOF backs off before reconnecting and does not stop", async () => {
    const client = mockClient();
    const controller = new AbortController();
    let n = 0;
    fetchImplementation = async () => {
      n += 1;
      if (n >= 3) return new Response("after-backoff\n");
      return new Response("");
    };
    const started = performance.now();
    await streamCvmChannelLogs(
      client,
      "app_test",
      "serial",
      (data) => {
        if (data.includes("after-backoff")) controller.abort();
      },
      {},
      controller.signal,
    );
    expect(n).toBe(3);
    expect(performance.now() - started).toBeGreaterThanOrEqual(700);
  });

  test("ordinary network failures stop after five consecutive failures", async () => {
    const client = mockClient();
    fetchImplementation = async () => {
      throw new TypeError("network unavailable");
    };

    const error = await streamCvmChannelLogs(client, "app_test", "serial", () => {}).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(TypeError);
    expect(error).toMatchObject({ message: "network unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  test("a successful HTTP 200 with a record resets the ordinary failure counter", async () => {
    const client = mockClient();
    const controller = new AbortController();
    let requestCount = 0;
    const output: string[] = [];
    fetchImplementation = async () => {
      requestCount += 1;
      if (requestCount <= 2 || (requestCount >= 5 && requestCount <= 7)) {
        throw new TypeError("temporary network failure");
      }
      if (requestCount === 3) return new Response("checkpoint\n");
      return new Response("recovered after a reset\n");
    };

    await streamCvmChannelLogs(
      client,
      "app_test",
      "serial",
      (data) => {
        output.push(data);
        if (data.includes("recovered")) controller.abort();
      },
      {},
      controller.signal,
    );

    expect(requestCount).toBe(4);
    expect(output).toEqual(["checkpoint\n", "recovered after a reset\n"]);
  });

  test("in-stream gateway error lines count toward the 5-failure cap", async () => {
    const client = mockClient();
    fetchImplementation = async () => new Response("[error] ERR-17-008 upstream stream failed\n");
    const error = await streamCvmChannelLogs(client, "app_test", "serial", () => {}).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(LogAccessError);
    expect(error).toMatchObject({ code: "ERR-17-008", message: "upstream stream failed" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  test("container follow de-duplicates the boundary second and reconnects with tail=all", async () => {
    const client = mockClient();
    const controller = new AbortController();
    const output: string[] = [];
    const first = [
      { channel: "stdout", message: "2026-11-09T12:00:00.123456789Z repeated\n" },
      { channel: "stdout", message: "2026-11-09T12:00:00.123456789Z repeated\n" },
    ];
    const second = [
      ...first,
      { channel: "stdout", message: "2026-11-09T12:00:00.123456789Z repeated\n" },
    ];
    fetchImplementation = async () =>
      fetchMock.mock.calls.length === 1 ? ndjsonResponse(first) : ndjsonResponse(second);

    await streamContainerLogsEntries(
      client,
      "app_test",
      (entry) => {
        output.push(entry.message);
        if (output.length === 3) controller.abort();
      },
      {},
      controller.signal,
    );

    expect(output).toEqual(["repeated\n", "repeated\n", "repeated\n"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
    for (const url of urls) {
      expect(url.searchParams.get("format")).toBe("ndjson");
      expect(url.searchParams.get("timestamps")).toBe("true");
    }
    expect(urls[0]?.searchParams.has("tail")).toBe(false);
    expect(urls[1]?.searchParams.get("since")).toBe("1794225600");
    expect(urls[1]?.searchParams.get("tail")).toBe("all");
  });

  test("container logs keep empty lines and heartbeat-like application content", async () => {
    const client = mockClient();
    fetchImplementation = async () =>
      ndjsonResponse([
        { channel: "stdout", message: "" },
        { channel: "stderr", message: "[vmm heartbeat]" },
      ]);

    const entries = await fetchContainerLogsEntries(client, "app_test");
    expect(entries).toEqual([
      { channel: "stdout", message: "" },
      { channel: "stderr", message: "[vmm heartbeat]" },
    ]);
  });

  test("HTTP StructuredError maps to LogAccessError without retrying 4xx", async () => {
    const client = mockClient();
    fetchImplementation = async () =>
      jsonResponse(
        {
          error_code: "ERR-17-004",
          message: "CVM unavailable",
          suggestions: ["Check the CVM ID"],
        },
        404,
      );

    await expect(fetchCvmChannelLogs(client, "app_test", "serial")).rejects.toMatchObject({
      name: "LogAccessError",
      code: "ERR-17-004",
      httpStatus: 404,
      suggestions: ["Check the CVM ID"],
      message: expect.stringContaining("CVM unavailable"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("repeated HTTP ERR-17-003 refreshes only a finite number of times", async () => {
    const client = mockClient();
    fetchImplementation = async () =>
      jsonResponse({ error_code: "ERR-17-003", message: "URL expired" }, 401);

    const error = await streamCvmChannelLogs(client, "app_test", "serial", () => {}).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(LogAccessError);
    expect(error).toMatchObject({ code: "ERR-17-003" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(client.get).toHaveBeenCalled();
  });

  test("CVM info lookup pins 2026-01-21 so a 2025-10-28 client still gets logs", async () => {
    const get = vi.fn(async (_path: string, options?: { headers?: Record<string, string> }) => {
      expect(options?.headers?.["X-Phala-Version"]).toBe(CVM_LOGS_INFO_API_VERSION);
      return detail;
    });
    const client = {
      get,
      config: { version: "2025-10-28" },
    } as unknown as Client;
    fetchImplementation = async () => new Response("ok");
    await expect(fetchCvmChannelLogs(client, "app_test", "serial")).resolves.toBe("ok");
    expect(get).toHaveBeenCalled();
    expect(String(get.mock.calls[0]?.[0])).not.toContain("/composition");
  });

  test("container logs with public_logs false raise ERR-17-006", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (String(path).endsWith("/composition")) {
          return {
            containers: [{ id: "x", names: ["/app"], log_endpoint: "https://x/app" }],
          };
        }
        return { public_logs: false, logs: {} };
      }),
      config: { version: "2026-06-23" },
    } as unknown as Client;
    await expect(fetchContainerLogsEntries(client, "app_test")).rejects.toMatchObject({
      name: "LogAccessError",
      code: "ERR-17-006",
      httpStatus: 409,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("container follow with public_logs false raises ERR-17-006 without connecting", async () => {
    const get = vi.fn(async (path: string) => {
      if (String(path).endsWith("/composition")) {
        return {
          containers: [{ id: "x", names: ["/anything"], log_endpoint: "https://x/a" }],
        };
      }
      return { public_logs: false, logs: {} };
    });
    const client = {
      get,
      config: { version: "2026-06-23" },
    } as unknown as Client;
    await expect(
      streamContainerLogsEntries(client, "app_test", () => {}, { container: "anything" }),
    ).rejects.toMatchObject({
      name: "LogAccessError",
      code: "ERR-17-006",
      httpStatus: 409,
    });
    expect(get).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("container not found is not retried", async () => {
    const client = mockClient();
    await expect(
      streamContainerLogsEntries(client, "app_test", () => {}, { container: "missing" }),
    ).rejects.toMatchObject({ code: "ERR-17-007", message: "Container not found" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.get).toHaveBeenCalled();
  });

  test("glued guest error without newline is parsed as ERR-17-009", async () => {
    const client = mockClient();
    fetchImplementation = async () =>
      new Response('{"error":"x"}{"channel":"stdout","message":"y\n"}\n');
    await expect(fetchContainerLogsEntries(client, "app_test")).rejects.toMatchObject({
      name: "LogAccessError",
      code: "ERR-17-009",
      message: "x",
    });
  });

  test("guest-agent ndjson error record is ERR-17-009 and does not retry", async () => {
    const client = mockClient();
    const guestError =
      "Docker responded with status code 501: configured logging driver does not support reading";
    fetchImplementation = async () => ndjsonResponse([{ error: guestError }]);

    await expect(streamContainerLogsEntries(client, "app_test", () => {})).rejects.toMatchObject({
      name: "LogAccessError",
      code: "ERR-17-009",
      message: guestError,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("HTTP 502 ERR-17-009 still reconnects in follow", async () => {
    const client = mockClient();
    fetchImplementation = async () =>
      jsonResponse(
        { error_code: "ERR-17-009", message: "Guest agent or gateway unreachable" },
        502,
      );
    const error = await streamContainerLogsEntries(client, "app_test", () => {}).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(LogAccessError);
    expect(error).toMatchObject({ code: "ERR-17-009" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  test("in-stream ndjson gateway error counts toward the 5-failure cap", async () => {
    const client = mockClient();
    fetchImplementation = async () =>
      ndjsonResponse([{ error_code: "ERR-17-008", message: "upstream stream failed" }]);
    const error = await streamContainerLogsEntries(client, "app_test", () => {}).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(LogAccessError);
    expect(error).toMatchObject({ code: "ERR-17-008", message: "upstream stream failed" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  test("container text guest error without newline is ERR-17-009", async () => {
    const client = mockClient();
    const guestError =
      "Docker responded with status code 501: configured logging driver does not support reading";
    fetchImplementation = async () => new Response(JSON.stringify({ error: guestError }));
    await expect(
      fetchCvmLogs(client, "app_test", { type: "container" }, { format: "text" }),
    ).rejects.toMatchObject({
      name: "LogAccessError",
      code: "ERR-17-009",
      message: guestError,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("container follow stops after 5 empty clean ends", async () => {
    const client = mockClient();
    fetchImplementation = async () => new Response("");
    await expect(streamContainerLogsEntries(client, "app_test", () => {})).rejects.toMatchObject({
      message: expect.stringContaining("keeps ending without new output"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  test("container follow with data keeps reconnecting", async () => {
    const client = mockClient();
    let n = 0;
    fetchImplementation = async () => {
      n += 1;
      return ndjsonResponse([
        { channel: "stdout", message: `2026-11-09T12:00:0${n}.0Z line${n}\n` },
      ]);
    };
    const controller = new AbortController();
    let count = 0;
    await streamContainerLogsEntries(
      client,
      "app_test",
      () => {
        count += 1;
        if (count >= 6) controller.abort();
      },
      {},
      controller.signal,
    );
    expect(count).toBe(6);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  test("delivered record then in-stream error resets the failure counter", async () => {
    const client = mockClient();
    const controller = new AbortController();
    let n = 0;
    const output: string[] = [];
    fetchImplementation = async () => {
      n += 1;
      if (n <= 4) return jsonResponse({ error_code: "ERR-17-008", message: "up" }, 503);
      if (n === 5) return new Response("recovered\n[error] ERR-17-008 upstream stream failed\n");
      return new Response("ok\n");
    };
    await streamCvmChannelLogs(
      client,
      "app_test",
      "serial",
      (data) => {
        output.push(data);
        if (data.includes("ok")) controller.abort();
      },
      {},
      controller.signal,
    );
    expect(output.some((line) => line.includes("recovered"))).toBe(true);
    expect(output.some((line) => line.includes("ok"))).toBe(true);
    expect(n).toBeGreaterThanOrEqual(6);
  });

  test("empty-end counter resets on HTTP failure", async () => {
    const client = mockClient();
    const controller = new AbortController();
    let n = 0;
    fetchImplementation = async () => {
      n += 1;
      if (n <= 4) return new Response("");
      if (n === 5) return jsonResponse({ error_code: "ERR-17-008", message: "up" }, 503);
      if (n === 6) return new Response("");
      return ndjsonResponse([{ channel: "stdout", message: "still-going\n" }]);
    };
    await streamContainerLogsEntries(
      client,
      "app_test",
      (entry) => {
        if (entry.message.includes("still-going")) controller.abort();
      },
      {},
      controller.signal,
    );
    expect(n).toBeGreaterThanOrEqual(7);
  });

  test("quiet tail=0 reconnect uses first-200 since and tail=all", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_794_225_600_000);
    const client = mockClient();
    const controller = new AbortController();
    let n = 0;
    fetchImplementation = async () => {
      n += 1;
      if (n === 1) return new Response("");
      return ndjsonResponse([{ channel: "stdout", message: "2026-11-09T12:00:10.0Z later\n" }]);
    };
    await streamContainerLogsEntries(
      client,
      "app_test",
      () => controller.abort(),
      { tail: 0 },
      controller.signal,
    );
    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
    expect(urls[0]?.searchParams.get("tail")).toBe("0");
    expect(urls[0]?.searchParams.has("since")).toBe(false);
    expect(urls[1]?.searchParams.get("tail")).toBe("all");
    expect(urls[1]?.searchParams.get("since")).toBe("1794225600");
  });

  test("until reached ends follow without error", async () => {
    const client = mockClient();
    let n = 0;
    fetchImplementation = async () => {
      n += 1;
      return ndjsonResponse([
        { channel: "stdout", message: "2026-11-09T12:00:00.000000001Z one\n" },
      ]);
    };
    await streamContainerLogsEntries(client, "app_test", () => {}, {
      until: 1794225600,
    });
    expect(n).toBe(1);
  });

  test("HTTP 429 is retried up to five times", async () => {
    const client = mockClient();
    fetchImplementation = async () =>
      jsonResponse({ error_code: "ERR-17-011", message: "rate limited" }, 429);
    const error = await streamCvmChannelLogs(client, "app_test", "serial", () => {}).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toMatchObject({ code: "ERR-17-011" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  test("followCvmLogs yields node lines as an async iterator", async () => {
    const client = mockClient();
    const controller = new AbortController();
    fetchImplementation = async () => new Response("hello\n");
    const lines: string[] = [];
    for await (const line of followCvmLogs(
      client,
      { id: "app_test" },
      { type: "node", channel: "serial" },
      { signal: controller.signal },
    )) {
      lines.push(String(line));
      controller.abort();
    }
    expect(lines).toEqual(["hello\n"]);
  });

  test("default format with ansi true keeps escapes and does not send ansi on NDJSON", async () => {
    const client = mockClient();
    fetchImplementation = async () =>
      ndjsonResponse([{ channel: "stdout", message: "\x1b[31mred\x1b[0m\n" }]);
    const text = await fetchCvmLogs(client, "app_test", { type: "container" }, { ansi: true });
    expect(text).toBe("\x1b[31mred\x1b[0m\n");
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.has("ansi")).toBe(false);
    expect(url.searchParams.get("format")).toBe("ndjson");
  });

  test("invalid container names error before any request", async () => {
    const client = mockClient();
    for (const name of ["app/foo", "a..b", "_hidden"]) {
      await expect(
        fetchCvmLogs(client, "app_test", { type: "container", name }, { ansi: true }),
      ).rejects.toThrow(/Invalid container name/);
    }
    expect(client.get).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("empty NDJSON message is delivered as an empty string", async () => {
    const client = mockClient();
    fetchImplementation = async () => ndjsonResponse([{ channel: "stdout", message: "" }]);
    await expect(fetchContainerLogs(client, "app_test")).resolves.toBe("");
  });

  test("reconnect without a timestamp keeps the caller since", async () => {
    const client = mockClient();
    const controller = new AbortController();
    let n = 0;
    fetchImplementation = async () => {
      n += 1;
      if (n === 1) throw new TypeError("temporary");
      return ndjsonResponse([{ channel: "stdout", message: "ok\n" }]);
    };
    await streamContainerLogsEntries(
      client,
      "app_test",
      () => controller.abort(),
      { since: 100, tail: "all" },
      controller.signal,
    );
    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
    expect(urls[0]?.searchParams.get("since")).toBe("100");
    expect(urls[1]?.searchParams.get("since")).toBe("100");
    expect(urls[1]?.searchParams.get("tail")).toBe("all");
  });

  test("until on a clean end finishes without the empty-end error", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_794_268_801_000);
    const client = mockClient();
    fetchImplementation = async () => new Response("");
    await streamContainerLogsEntries(client, "app_test", () => {}, { until: 1794268801 });
    await streamContainerLogs(client, "app_test", () => {}, {
      format: "text",
      until: 1794268801,
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test("text follow strips ANSI and detects a glued guest error", async () => {
    const client = mockClient();
    fetchImplementation = async () => new Response('{"error":"x"}hello\n');
    await expect(
      fetchCvmLogs(client, "app_test", { type: "container" }, { format: "text" }),
    ).rejects.toMatchObject({ code: "ERR-17-009", message: "x" });
  });

  test("node fetch does not treat JSON error objects as guest errors", async () => {
    const client = mockClient();
    fetchImplementation = async () => new Response('{"error":"not a guest record"}\n');
    await expect(fetchCvmChannelLogs(client, "app_test", "serial")).resolves.toBe(
      '{"error":"not a guest record"}\n',
    );
  });

  test("already-aborted signal makes no request", async () => {
    const client = mockClient();
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchContainerLogsEntries(client, "app_test", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(client.get).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("ANSI stripping removes SGR, CSI private mode, and OSC 8", async () => {
    const client = mockClient();
    fetchImplementation = async () =>
      ndjsonResponse([
        { channel: "stdout", message: "\x1b[31mred\x1b[0m\n" },
        { channel: "stdout", message: "\x1b[?25lhidden\n" },
        { channel: "stdout", message: "\x1b]8;;https://example.com\x07link\x1b]8;;\x07\n" },
      ]);
    const entries = await fetchContainerLogsEntries(client, "app_test");
    expect(entries.map((entry) => entry.message)).toEqual(["red\n", "hidden\n", "link\n"]);
  });

  test("follow retries lookup network errors up to five times", async () => {
    const client = {
      get: vi.fn(async () => {
        throw new UnknownError("network", { status: 0, statusText: "" });
      }),
      config: { version: "2026-06-23" },
    } as unknown as Client;
    const error = await streamCvmChannelLogs(client, "app_test", "serial", () => {}).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(UnknownError);
    expect(client.get).toHaveBeenCalledTimes(5);
  });

  test("follow waits at least 1s between consecutive connections", async () => {
    const client = mockClient();
    const controller = new AbortController();
    const started: number[] = [];
    fetchImplementation = async () => {
      started.push(performance.now());
      return new Response(`line${started.length}\n`);
    };
    await streamCvmChannelLogs(
      client,
      "app_test",
      "serial",
      () => {
        if (started.length >= 2) controller.abort();
      },
      {},
      controller.signal,
    );
    expect(started.length).toBe(2);
    expect(started[1]! - started[0]!).toBeGreaterThanOrEqual(900);
  });

  test("accepts console and stdin NDJSON channels", async () => {
    const client = mockClient();
    fetchImplementation = async () =>
      ndjsonResponse([
        { channel: "console", message: "c\n" },
        { channel: "stdin", message: "i\n" },
      ]);
    await expect(fetchContainerLogsEntries(client, "app_test")).resolves.toEqual([
      { channel: "console", message: "c\n" },
      { channel: "stdin", message: "i\n" },
    ]);
  });

  test("HTTP 401 ERR-17-002 is retried as a failure", async () => {
    const client = mockClient();
    fetchImplementation = async () =>
      jsonResponse({ error_code: "ERR-17-002", message: "unauthorized" }, 401);
    const error = await streamCvmChannelLogs(client, "app_test", "serial", () => {}).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toMatchObject({ code: "ERR-17-002" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  test("cancel during backoff returns promptly", async () => {
    const client = mockClient();
    const controller = new AbortController();
    fetchImplementation = async () => {
      throw new TypeError("network unavailable");
    };
    const started = performance.now();
    setTimeout(() => controller.abort(), 50);
    await streamCvmChannelLogs(client, "app_test", "serial", () => {}, {}, controller.signal);
    expect(performance.now() - started).toBeLessThan(500);
  });

  test("log requests send the client User-Agent", async () => {
    const client = mockClient();
    fetchImplementation = async () => new Response("ok\n");
    await fetchCvmChannelLogs(client, "app_test", "serial");
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers as HeadersInit);
    expect(headers.get("User-Agent")).toMatch(/phala-cloud-sdk-js\//);
  });

  test("partial output then a read error recovers and continues", async () => {
    const client = mockClient();
    const controller = new AbortController();
    let n = 0;
    const output: string[] = [];
    fetchImplementation = async () => {
      n += 1;
      if (n === 1) {
        let pulls = 0;
        return new Response(
          new ReadableStream({
            pull(stream) {
              pulls += 1;
              if (pulls === 1) {
                stream.enqueue(new TextEncoder().encode("partial\n"));
                return;
              }
              stream.error(new TypeError("read failed"));
            },
          }),
        );
      }
      return new Response("recovered\n");
    };
    await streamCvmChannelLogs(
      client,
      "app_test",
      "serial",
      (data) => {
        output.push(data);
        if (data.includes("recovered")) controller.abort();
      },
      {},
      controller.signal,
    );
    expect(output.some((line) => line.includes("partial"))).toBe(true);
    expect(output.some((line) => line.includes("recovered"))).toBe(true);
  });

  test("container long idle EOF keeps following", async () => {
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => {
      now += 11_000;
      return now;
    });
    const client = mockClient();
    const controller = new AbortController();
    let n = 0;
    fetchImplementation = async () => {
      n += 1;
      if (n <= 6) return new Response("");
      return ndjsonResponse([{ channel: "stdout", message: "after-idle\n" }]);
    };
    await streamContainerLogsEntries(
      client,
      "app_test",
      (entry) => {
        if (entry.message.includes("after-idle")) controller.abort();
      },
      {},
      controller.signal,
    );
    expect(n).toBe(7);
  });

  test("follow resolves composition once and CVM-info once per connection", async () => {
    const client = mockClient();
    const controller = new AbortController();
    let n = 0;
    fetchImplementation = async () => {
      n += 1;
      return ndjsonResponse([
        { channel: "stdout", message: `2026-11-09T12:00:0${n}.0Z line${n}\n` },
      ]);
    };
    await streamContainerLogsEntries(
      client,
      "app_test",
      () => {
        if (n >= 3) controller.abort();
      },
      {},
      controller.signal,
    );
    const paths = vi.mocked(client.get).mock.calls.map(([path]) => String(path));
    expect(paths.filter((path) => path.endsWith("/composition"))).toHaveLength(1);
    expect(paths.filter((path) => !path.endsWith("/composition"))).toHaveLength(3);
  });

  test("unknown container is ERR-17-007", async () => {
    const client = mockClient();
    client.get = vi.fn(async (path: string) => {
      if (String(path).endsWith("/composition")) {
        return {
          containers: [{ id: "other", names: ["/other"], log_endpoint: "https://x/c" }],
        };
      }
      return detail;
    }) as Client["get"];
    await expect(
      fetchContainerLogsEntries(client, "app_test", {
        container: "missing",
        matchContainerIdPrefix: true,
      }),
    ).rejects.toMatchObject({ code: "ERR-17-007", message: "Container not found" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("ambiguous container prefix is ERR-17-001", async () => {
    const client = mockClient();
    client.get = vi.fn(async (path: string) => {
      if (String(path).endsWith("/composition")) {
        return {
          containers: [
            { id: "abc1", names: ["/a"], log_endpoint: "https://x/a" },
            { id: "abc2", names: ["/b"], log_endpoint: "https://x/b" },
          ],
        };
      }
      return detail;
    }) as Client["get"];
    await expect(
      fetchContainerLogsEntries(client, "app_test", {
        container: "abc",
        matchContainerIdPrefix: true,
      }),
    ).rejects.toMatchObject({ code: "ERR-17-001" });
  });
});
