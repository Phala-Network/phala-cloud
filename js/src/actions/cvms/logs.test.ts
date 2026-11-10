import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Client } from "../../client";
import {
  CVM_LOGS_INFO_API_VERSION,
  fetchContainerLogsEntries,
  fetchCvmChannelLogs,
  fetchCvmLogs,
  followCvmLogs,
  LogAccessError,
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
  return new Response(records.map((record) => JSON.stringify(record)).join("\n"));
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

describe("CVM log access", () => {
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

  test("container follow de-duplicates the boundary second and omits tail on reconnect", async () => {
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
      get: vi.fn(async () => ({ public_logs: false, logs: {} })),
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
      expect(String(path)).not.toContain("/composition");
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
    expect(get).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("container not found is not retried", async () => {
    const client = mockClient();
    await expect(
      streamContainerLogsEntries(client, "app_test", () => {}, { container: "missing" }),
    ).rejects.toThrow(/Container 'missing' not found/);
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
});
