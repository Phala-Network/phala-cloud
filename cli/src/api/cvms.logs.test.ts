import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	test,
} from "bun:test";

const detail = {
	id: "cvm_test",
	name: "test",
	status: "running",
	resource: { instance_type: null },
	gateway: {},
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

const realCloud = await import(
	`${require.resolve("@phala/cloud")}?cvm-log-test-real`
);
mock.module("@phala/cloud", () => ({ ...realCloud }));
const realClient = await import(
	`${require.resolve("@/src/lib/client")}?cvm-log-test-real`
);
const realLogger = await import(
	`${require.resolve("@/src/utils/logger")}?cvm-log-test-real`
);
mock.module("@/src/utils/logger", () => ({ ...realLogger }));

const safeGetCvmInfo = mock(async () => ({
	success: true as const,
	data: detail,
}));
const clientGet = mock(async (path: string) => {
	if (path.endsWith("/composition")) {
		return {
			containers: [
				{
					id: "container-id",
					names: ["/app"],
					log_endpoint:
						"https://cloud-logs.example/logs/123/container/app?uid=7&exp=2000000000&kid=test&sig=signature",
				},
			],
		};
	}
	return detail;
});
const getClient = mock(async () => ({ get: clientGet }));

mock.module("@phala/cloud", () => ({ ...realCloud, safeGetCvmInfo }));
mock.module("@/src/lib/client", () => ({ ...realClient, getClient }));
mock.module("@/src/utils/logger", () => ({ ...realLogger }));

const {
	fetchCvmChannelLogs,
	streamContainerLogsEntries,
	streamCvmChannelLogs,
	fetchContainerLogsEntries,
	LogAccessError,
} = await import("./cvms");

let fetchImplementation: (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;
const fetchMock = mock((input: string | URL | Request, init?: RequestInit) =>
	fetchImplementation(input, init),
);
const originalFetch = globalThis.fetch;

function jsonResponse(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), { status });
}

function ndjsonResponse(records: unknown[]): Response {
	return new Response(
		records.map((record) => JSON.stringify(record)).join("\n"),
	);
}

beforeEach(() => {
	safeGetCvmInfo.mockClear();
	clientGet.mockClear();
	getClient.mockClear();
	fetchMock.mockClear();
	fetchImplementation = async () => new Response("");
	globalThis.fetch = Object.assign(
		(input: string | URL | Request, init?: RequestInit) =>
			fetchMock(input, init),
		{ preconnect: originalFetch.preconnect },
	);
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

afterAll(() => {
	globalThis.fetch = originalFetch;
	mock.module("@phala/cloud", () => ({ ...realCloud }));
	mock.module("@/src/lib/client", () => ({ ...realClient }));
	mock.module("@/src/utils/logger", () => ({ ...realLogger }));
});

describe("CVM log access client", () => {
	test("node follow reconnects with tail=0, uses the node path, and filters only exact heartbeat lines", async () => {
		const controller = new AbortController();
		const output: string[] = [];
		fetchImplementation = async () => {
			if (fetchMock.mock.calls.length === 1) {
				return new Response(
					"[vmm heartbeat]\n[teepod heartbeat]\n\ncontains [vmm heartbeat]\n",
				);
			}
			return new Response("reconnected\n");
		};

		await streamCvmChannelLogs(
			"app_test",
			"serial",
			(data) => {
				output.push(data);
				if (data === "reconnected\n") controller.abort();
			},
			{ tail: 7 },
			controller.signal,
		);

		expect(output).toEqual([
			"\n",
			"contains [vmm heartbeat]\n",
			"reconnected\n",
		]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
		expect(urls[0]?.pathname).toBe("/logs/123/node/serial");
		expect(urls[0]?.searchParams.get("tail")).toBe("7");
		expect(urls[0]?.searchParams.has("lines")).toBe(false);
		expect(urls[0]?.searchParams.has("ansi")).toBe(false);
		expect(urls[1]?.searchParams.get("tail")).toBe("0");
		expect(urls[1]?.searchParams.has("lines")).toBe(false);
	});

	test("successful clean EOF reconnects indefinitely until aborted", async () => {
		const controller = new AbortController();
		const output: string[] = [];
		fetchImplementation = async () =>
			fetchMock.mock.calls.length <= 6
				? new Response("")
				: new Response("still following\n");

		await streamCvmChannelLogs(
			"app_test",
			"serial",
			(data) => {
				output.push(data);
				controller.abort();
			},
			{},
			controller.signal,
		);

		expect(fetchMock).toHaveBeenCalledTimes(7);
		expect(output).toEqual(["still following\n"]);
	});

	test("ordinary network failures stop after five consecutive failures", async () => {
		fetchImplementation = async () => {
			throw new TypeError("network unavailable");
		};

		const error = await streamCvmChannelLogs(
			"app_test",
			"serial",
			() => {},
		).then(
			() => undefined,
			(reason: unknown) => reason,
		);
		expect(error).toBeInstanceOf(TypeError);
		expect(error).toMatchObject({ message: "network unavailable" });
		expect(fetchMock).toHaveBeenCalledTimes(5);
	});

	test("retryable non-200 StructuredErrors stop after five failures and retain suggestions", async () => {
		fetchImplementation = async () =>
			jsonResponse(
				{
					error_code: "ERR-17-008",
					message: "Node VMM unavailable",
					suggestions: ["Try again later"],
				},
				502,
			);

		const error = await streamCvmChannelLogs(
			"app_test",
			"serial",
			() => {},
		).then(
			() => undefined,
			(reason: unknown) => reason,
		);
		expect(error).toBeInstanceOf(LogAccessError);
		expect(error).toMatchObject({
			code: "ERR-17-008",
			suggestions: ["Try again later"],
			message: expect.stringContaining("Node VMM unavailable"),
		});
		expect(fetchMock).toHaveBeenCalledTimes(5);
	});

	test("a successful HTTP 200 clean EOF resets the ordinary failure counter", async () => {
		const controller = new AbortController();
		let requestCount = 0;
		const output: string[] = [];
		fetchImplementation = async () => {
			requestCount += 1;
			if (requestCount <= 2 || (requestCount >= 4 && requestCount <= 6)) {
				throw new TypeError("temporary network failure");
			}
			if (requestCount === 3) return new Response("");
			return new Response("recovered after a reset\n");
		};

		await streamCvmChannelLogs(
			"app_test",
			"serial",
			(data) => {
				output.push(data);
				controller.abort();
			},
			{},
			controller.signal,
		);

		expect(requestCount).toBe(7);
		expect(output).toEqual(["recovered after a reset\n"]);
	});

	test("container follow preserves same-second duplicate counts while reconnecting", async () => {
		const controller = new AbortController();
		const output: string[] = [];
		const first = [
			{ channel: "stdout", message: "2026-11-09T12:00:00.123456789Z repeated" },
			{ channel: "stdout", message: "2026-11-09T12:00:00.123456789Z repeated" },
		];
		const second = [
			...first,
			{ channel: "stdout", message: "2026-11-09T12:00:00.123456789Z repeated" },
		];
		fetchImplementation = async () =>
			fetchMock.mock.calls.length === 1
				? ndjsonResponse(first)
				: ndjsonResponse(second);

		await streamContainerLogsEntries(
			"app_test",
			(entry) => {
				output.push(entry.message);
				if (output.length === 3) controller.abort();
			},
			{},
			controller.signal,
		);

		expect(output).toHaveLength(3);
		expect(output).toEqual(["repeated", "repeated", "repeated"]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
		for (const url of urls) {
			expect(url.searchParams.get("format")).toBe("ndjson");
			expect(url.searchParams.get("timestamps")).toBe("true");
			expect(url.searchParams.has("ansi")).toBe(false);
			expect(url.searchParams.has("lines")).toBe(false);
		}
		expect(urls[0]?.searchParams.has("tail")).toBe(false);
		expect(urls[1]?.searchParams.get("since")).toBe("1794225600");
		expect(urls[1]?.searchParams.has("tail")).toBe(false);
	});

	test("--timestamps preserves transport prefixes while deduplicating with the raw message", async () => {
		const controller = new AbortController();
		const output: string[] = [];
		const repeated = {
			channel: "stdout",
			message: "2026-11-09T12:00:00.123456789Z repeated",
		};
		fetchImplementation = async () =>
			fetchMock.mock.calls.length === 1
				? ndjsonResponse([repeated, repeated])
				: ndjsonResponse([repeated, repeated, repeated]);

		await streamContainerLogsEntries(
			"app_test",
			(entry) => {
				output.push(entry.message);
				if (output.length === 3) controller.abort();
			},
			{ timestamps: true },
			controller.signal,
		);

		expect(output).toEqual([
			"2026-11-09T12:00:00.123456789Z repeated",
			"2026-11-09T12:00:00.123456789Z repeated",
			"2026-11-09T12:00:00.123456789Z repeated",
		]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(
			new URL(String(fetchMock.mock.calls[1]?.[0])).searchParams.get("since"),
		).toBe("1794225600");
	});

	test("stripping one timestamp prefix preserves an empty or timestamp-leading body", async () => {
		const controller = new AbortController();
		const output: string[] = [];
		fetchImplementation = async () =>
			ndjsonResponse([
				{
					channel: "stdout",
					message: "2026-11-09T12:00:00.123456789Z ",
				},
				{
					channel: "stdout",
					message: "2026-11-09T12:00:00.123456789Z 2026-11-09T12:00:00Z body",
				},
			]);

		await streamContainerLogsEntries(
			"app_test",
			(entry) => {
				output.push(entry.message);
				if (output.length === 2) controller.abort();
			},
			{},
			controller.signal,
		);

		expect(output).toEqual(["", "2026-11-09T12:00:00Z body"]);
	});

	test("container logs preserve empty messages and heartbeat-like application content", async () => {
		fetchImplementation = async () =>
			ndjsonResponse([
				{ channel: "stdout", message: "" },
				{ channel: "stderr", message: "[vmm heartbeat]" },
			]);

		const entries = await fetchContainerLogsEntries("app_test");
		expect(entries).toEqual([
			{ channel: "stdout", message: "" },
			{ channel: "stderr", message: "[vmm heartbeat]" },
		]);
	});

	test("HTTP StructuredError exposes message and suggestions without retrying 4xx", async () => {
		fetchImplementation = async () =>
			jsonResponse(
				{
					error_code: "ERR-17-004",
					message: "CVM unavailable",
					details: [],
					suggestions: ["Check the CVM ID"],
					links: [],
					request_id: "request-1",
				},
				404,
			);

		await expect(
			fetchCvmChannelLogs("app_test", "serial"),
		).rejects.toMatchObject({
			name: "LogAccessError",
			code: "ERR-17-004",
			httpStatus: 404,
			suggestions: ["Check the CVM ID"],
			message: expect.stringContaining("CVM unavailable"),
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("midstream ERR-17-003 refreshes CVM detail and retries with a fresh endpoint", async () => {
		const controller = new AbortController();
		const output: string[] = [];
		fetchImplementation = async () =>
			fetchMock.mock.calls.length === 1
				? ndjsonResponse([{ error_code: "ERR-17-003", message: "URL expired" }])
				: ndjsonResponse([{ channel: "stdout", message: "reconnected log" }]);

		await streamContainerLogsEntries(
			"app_test",
			(entry) => {
				output.push(entry.message);
				controller.abort();
			},
			{},
			controller.signal,
		);

		expect(output).toEqual(["reconnected log"]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(safeGetCvmInfo).toHaveBeenCalledTimes(1);
	});

	test("repeated HTTP ERR-17-003 refreshes only a finite number of times", async () => {
		fetchImplementation = async () =>
			jsonResponse({ error_code: "ERR-17-003", message: "URL expired" }, 401);

		const error = await streamCvmChannelLogs(
			"app_test",
			"serial",
			() => {},
		).then(
			() => undefined,
			(reason: unknown) => reason,
		);
		expect(error).toBeInstanceOf(LogAccessError);
		expect(error).toMatchObject({ code: "ERR-17-003" });
		expect(fetchMock).toHaveBeenCalledTimes(4);
		expect(safeGetCvmInfo).toHaveBeenCalledTimes(7);
	});

	test("repeated midstream ERR-17-003 is also limited across HTTP 200 bodies", async () => {
		fetchImplementation = async () =>
			ndjsonResponse([{ error_code: "ERR-17-003", message: "URL expired" }]);

		const error = await streamContainerLogsEntries("app_test", () => {}).then(
			() => undefined,
			(reason: unknown) => reason,
		);
		expect(error).toBeInstanceOf(LogAccessError);
		expect(error).toMatchObject({ code: "ERR-17-003" });
		expect(fetchMock).toHaveBeenCalledTimes(4);
		expect(safeGetCvmInfo).toHaveBeenCalledTimes(3);
	});

	test("midstream 4xx error is surfaced with its message and suggestions and not retried", async () => {
		fetchImplementation = async () =>
			ndjsonResponse([
				{
					error_code: "ERR-17-007",
					message: "Container missing",
					suggestions: ["Choose another container"],
				},
			]);

		const error = await streamContainerLogsEntries("app_test", () => {}).then(
			() => undefined,
			(reason: unknown) => reason,
		);
		expect(error).toBeInstanceOf(LogAccessError);
		expect(error).toMatchObject({
			code: "ERR-17-007",
			suggestions: ["Choose another container"],
			message: expect.stringContaining("Container missing"),
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
