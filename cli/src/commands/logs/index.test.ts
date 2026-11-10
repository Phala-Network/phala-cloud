import {
	describe,
	test,
	expect,
	mock,
	afterAll,
	beforeEach,
	afterEach,
	spyOn,
} from "bun:test";
import type { CommandContext } from "@/src/core/types";

const realCloud = await import(
	`${require.resolve("@phala/cloud")}?logs-command-test-real`
);
mock.module("@phala/cloud", () => ({ ...realCloud }));
const realLogger = await import(
	`${require.resolve("@/src/utils/logger")}?logs-command-test-real`
);
mock.module("@/src/utils/logger", () => ({ ...realLogger }));
const realApi = await import(
	`${require.resolve("@/src/api/cvms")}?logs-command-test-real`
);
const realLogsHandler = await import(
	`${require.resolve("@/src/commands/cvms/logs-handler")}?logs-command-test-real`
);

type ContainerLogsOptions = {
	container?: string;
	since?: string;
	until?: string;
	tail?: number | "all";
	timestamps?: boolean;
	matchContainerIdPrefix?: boolean;
};

type SerialLogsOptions = {
	tail?: number | "all";
	timestamps?: boolean;
	since?: string;
	until?: string;
};

type CvmLogChannel = "serial" | "stdout" | "stderr";
type LogEntry = {
	channel: "stdout" | "stderr" | "stdin" | "console";
	message: string;
};

const mockFetchContainerLogsEntries = mock(
	(_appId: string, _options: ContainerLogsOptions) =>
		Promise.resolve<LogEntry[]>([{ channel: "stdout", message: "hello\n" }]),
);

const mockStreamContainerLogsEntries = mock(
	(
		_appId: string,
		onEntry: (entry: LogEntry) => void,
		_options: ContainerLogsOptions,
		_signal?: AbortSignal,
	) => {
		onEntry({ channel: "stdout", message: "out\n" });
		onEntry({ channel: "stderr", message: "err\n" });
		onEntry({ channel: "stdin", message: "in\n" });
		onEntry({ channel: "console", message: "con\n" });
		return Promise.resolve();
	},
);

const mockFetchCvmChannelLogs = mock(
	(_appId: string, _channel: CvmLogChannel, _options: SerialLogsOptions) =>
		Promise.resolve("serial log output\n"),
);

const mockStreamCvmChannelLogs = mock(
	(
		_appId: string,
		_channel: CvmLogChannel,
		onData: (data: string) => void,
		_options: SerialLogsOptions,
		_signal?: AbortSignal,
	) => {
		onData("streaming serial\n");
		return Promise.resolve();
	},
);

const mockGetCvmStatus = mock((_appId: string) => Promise.resolve("running"));

mock.module("@/src/api/cvms", () => ({
	...realApi,
	fetchContainerLogsEntries: mockFetchContainerLogsEntries,
	streamContainerLogsEntries: mockStreamContainerLogsEntries,
	fetchCvmChannelLogs: mockFetchCvmChannelLogs,
	streamCvmChannelLogs: mockStreamCvmChannelLogs,
	getCvmStatus: mockGetCvmStatus,
}));

mock.module("@phala/cloud", () => ({
	...realCloud,
	CvmIdSchema: {
		parse: (input: unknown) => {
			const obj = input as { id?: string; app_id?: string };
			return { cvmId: obj.id ?? obj.app_id ?? "app_abc123" };
		},
	},
}));

mock.module("@/src/commands/cvms/logs-handler", () => ({
	...realLogsHandler,
	checkAndWarnIfLogsDisabled: mock(() => Promise.resolve(false)),
}));

const noop = () => {};
mock.module("@/src/utils/logger", () => ({
	...realLogger,
	setJsonMode: noop,
	logger: {
		startSpinner: () => ({ stop: noop }),
		table: noop,
		info: noop,
		warn: noop,
		error: noop,
		success: noop,
		break: noop,
		logDetailedError: noop,
		debug: noop,
	},
}));

// Import after mocking
const { logsCommand } = await import("./index");

afterAll(() => {
	mock.module("@phala/cloud", () => ({ ...realCloud }));
	mock.module("@/src/api/cvms", () => ({ ...realApi }));
	mock.module("@/src/commands/cvms/logs-handler", () => ({
		...realLogsHandler,
	}));
	mock.module("@/src/utils/logger", () => ({ ...realLogger }));
});

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
	return {
		argv: [],
		rawFlags: {},
		rawPositionals: [],
		cwd: process.cwd(),
		env: process.env,
		stdout: process.stdout,
		stderr: process.stderr,
		stdin: process.stdin,
		projectConfig: {},
		success() {},
		fail() {},
		failWithError() {},
		...overrides,
	} as CommandContext;
}

const defaultInput = {
	json: false,
	interactive: false,
	follow: false,
	timestamps: false,
	stderr: false,
	stdout: false,
	serial: false,
	cvmStdout: false,
	cvmStderr: false,
};

describe("logs command", () => {
	let fakeStdout: { write: (s: string) => boolean };
	let fakeStderr: { write: (s: string) => boolean };
	let stdoutWriteSpy: ReturnType<typeof spyOn>;
	let stderrWriteSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mockFetchContainerLogsEntries.mockClear();
		mockStreamContainerLogsEntries.mockClear();
		mockFetchCvmChannelLogs.mockClear();
		mockStreamCvmChannelLogs.mockClear();
		mockGetCvmStatus.mockClear();

		// Reset defaults
		mockFetchContainerLogsEntries.mockResolvedValue([
			{ channel: "stdout", message: "hello\n" },
		]);
		mockFetchCvmChannelLogs.mockResolvedValue("serial log output\n");
		mockGetCvmStatus.mockResolvedValue("running");

		fakeStdout = { write: () => true };
		fakeStderr = { write: () => true };
		stdoutWriteSpy = spyOn(fakeStdout, "write");
		stderrWriteSpy = spyOn(fakeStderr, "write");
	});

	afterEach(() => {
		stdoutWriteSpy.mockRestore();
		stderrWriteSpy.mockRestore();
	});

	test("returns 1 when no CVM ID provided", async () => {
		const failMessages: string[] = [];
		const code = await logsCommand.run(
			{
				...defaultInput,
				containerName: "my-service",
			},
			makeContext({
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
				fail: (msg: string) => failMessages.push(msg),
			}),
		);

		expect(code).toBe(1);
		expect(failMessages[0]).toContain("No CVM ID");
	});

	// --- Container mode tests ---

	test("passes --tail all through to the SDK", async () => {
		const code = await logsCommand.run(
			{
				...defaultInput,
				containerName: "my-service",
				tail: "all",
			},
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
			}),
		);

		expect(code).toBe(0);
		const firstCall = mockFetchContainerLogsEntries.mock.calls[0] as
			| [string, ContainerLogsOptions]
			| undefined;
		expect(firstCall?.[1]).toMatchObject({ tail: "all" });
	});

	test("fetches container logs with container name", async () => {
		const code = await logsCommand.run(
			{
				...defaultInput,
				containerName: "my-service",
			},
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
			}),
		);

		expect(code).toBe(0);
		expect(mockFetchContainerLogsEntries).toHaveBeenCalledTimes(1);
		const firstCall = mockFetchContainerLogsEntries.mock.calls[0] as
			| [string, ContainerLogsOptions]
			| undefined;
		expect(firstCall?.[1]).toMatchObject({
			container: "my-service",
			matchContainerIdPrefix: true,
		});
		expect(stdoutWriteSpy).toHaveBeenCalledWith("hello\n");
	});

	test("writes an empty container log message as an empty string", async () => {
		mockFetchContainerLogsEntries.mockResolvedValue([
			{ channel: "stdout", message: "" },
		]);

		const code = await logsCommand.run(
			{ ...defaultInput, containerName: "my-service" },
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
			}),
		);

		expect(code).toBe(0);
		expect(stdoutWriteSpy).toHaveBeenCalledWith("");
	});

	test("outputs container logs as json", async () => {
		const successData: unknown[] = [];

		const code = await logsCommand.run(
			{
				...defaultInput,
				containerName: "my-service",
				json: true,
			},
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
				success: (data: unknown) => successData.push(data),
			}),
		);

		expect(code).toBe(0);
		expect(successData).toHaveLength(1);
		const result = successData[0] as { logs?: string; cvm_id?: string };
		expect(result.logs).toBe("hello\n");
		expect(result.cvm_id).toBe("app_abc123");
	});

	test("rejects --json with --follow", async () => {
		const failMessages: string[] = [];
		const code = await logsCommand.run(
			{
				...defaultInput,
				containerName: "my-service",
				json: true,
				follow: true,
			},
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
				fail: (msg: string) => failMessages.push(msg),
			}),
		);

		expect(code).toBe(1);
		expect(failMessages[0]).toContain("Cannot use --json with --follow");
	});

	test("streams logs and routes container stderr to stderr when --stderr is used", async () => {
		const code = await logsCommand.run(
			{
				...defaultInput,
				containerName: "my-service",
				follow: true,
				stderr: true,
			},
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
			}),
		);

		expect(code).toBe(0);
		expect(mockStreamContainerLogsEntries).toHaveBeenCalledTimes(1);
		expect(stdoutWriteSpy).not.toHaveBeenCalledWith("out\n");
		expect(stdoutWriteSpy).not.toHaveBeenCalledWith("in\n");
		expect(stdoutWriteSpy).not.toHaveBeenCalledWith("con\n");
		expect(stderrWriteSpy).toHaveBeenCalledWith("err\n");
	});

	test("--stdout shows only stdout, console, and stdin", async () => {
		const code = await logsCommand.run(
			{
				...defaultInput,
				containerName: "my-service",
				follow: true,
				stdout: true,
			},
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
			}),
		);

		expect(code).toBe(0);
		expect(stdoutWriteSpy).toHaveBeenCalledWith("out\n");
		expect(stdoutWriteSpy).toHaveBeenCalledWith("in\n");
		expect(stdoutWriteSpy).toHaveBeenCalledWith("con\n");
		expect(stderrWriteSpy).not.toHaveBeenCalledWith("err\n");
	});

	// --- CVM mode tests ---

	test("rejects node-only unsupported filters before any API call", async () => {
		for (const nodeMode of [
			{ serial: true },
			{ cvmStdout: true },
			{ cvmStderr: true },
		]) {
			for (const unsupported of [
				{ timestamps: true },
				{ since: "10m" },
				{ until: "2026-11-09T12:00:00Z" },
			]) {
				const failMessages: string[] = [];
				const code = await logsCommand.run(
					{ ...defaultInput, ...nodeMode, ...unsupported },
					makeContext({
						cvmId: { id: "app_abc123" },
						stdout: fakeStdout as unknown as NodeJS.WriteStream,
						stderr: fakeStderr as unknown as NodeJS.WriteStream,
						fail: (message: string) => failMessages.push(message),
					}),
				);

				expect(code).toBe(1);
				expect(failMessages[0]).toContain(
					"not supported for serial/stdout/stderr logs",
				);
			}
		}

		expect(mockGetCvmStatus).not.toHaveBeenCalled();
		expect(mockFetchCvmChannelLogs).not.toHaveBeenCalled();
		expect(mockStreamCvmChannelLogs).not.toHaveBeenCalled();
	});

	test("rejects invalid time values before any API call", async () => {
		const failMessages: string[] = [];
		const code = await logsCommand.run(
			{ ...defaultInput, since: "not-a-time" },
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
				fail: (message: string) => failMessages.push(message),
			}),
		);

		expect(code).toBe(1);
		expect(failMessages[0]).toContain("Invalid log time");
		expect(mockGetCvmStatus).not.toHaveBeenCalled();
		expect(mockFetchContainerLogsEntries).not.toHaveBeenCalled();
	});

	test("time filters select container mode without a status request", async () => {
		const code = await logsCommand.run(
			{ ...defaultInput, since: "10m" },
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
			}),
		);

		expect(code).toBe(0);
		expect(mockGetCvmStatus).not.toHaveBeenCalled();
		expect(mockFetchContainerLogsEntries).toHaveBeenCalledTimes(1);
	});

	test("resolves relative filters once before fetching container logs", async () => {
		const nowSpy = spyOn(Date, "now").mockReturnValue(
			Date.parse("2026-11-09T12:00:00.750Z"),
		);
		try {
			const code = await logsCommand.run(
				{
					...defaultInput,
					containerName: "my-service",
					since: "10m",
					until: "2m",
				},
				makeContext({
					cvmId: { id: "app_abc123" },
					stdout: fakeStdout as unknown as NodeJS.WriteStream,
					stderr: fakeStderr as unknown as NodeJS.WriteStream,
				}),
			);

			expect(code).toBe(0);
			const call = mockFetchContainerLogsEntries.mock.calls[0] as
				| [string, ContainerLogsOptions]
				| undefined;
			expect(call?.[1]).toMatchObject({ since: 1794225000, until: 1794225481 });
			expect(nowSpy).toHaveBeenCalledTimes(1);
		} finally {
			nowSpy.mockRestore();
		}
	});

	test("--serial fetches CVM serial logs", async () => {
		const code = await logsCommand.run(
			{
				...defaultInput,
				serial: true,
			},
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
			}),
		);

		expect(code).toBe(0);
		expect(mockFetchCvmChannelLogs).toHaveBeenCalledTimes(1);
		const call = mockFetchCvmChannelLogs.mock.calls[0] as [
			string,
			CvmLogChannel,
			SerialLogsOptions,
		];
		expect(call[1]).toBe("serial");
		expect(stdoutWriteSpy).toHaveBeenCalledWith("serial log output\n");
	});

	test("--cvm-stdout fetches CVM stdout logs", async () => {
		mockFetchCvmChannelLogs.mockResolvedValue("cvm stdout\n");

		const code = await logsCommand.run(
			{
				...defaultInput,
				cvmStdout: true,
			},
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
			}),
		);

		expect(code).toBe(0);
		const call = mockFetchCvmChannelLogs.mock.calls[0] as [
			string,
			CvmLogChannel,
			SerialLogsOptions,
		];
		expect(call[1]).toBe("stdout");
	});

	test("--cvm-stderr fetches CVM stderr logs", async () => {
		mockFetchCvmChannelLogs.mockResolvedValue("cvm stderr\n");

		const code = await logsCommand.run(
			{
				...defaultInput,
				cvmStderr: true,
			},
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
			}),
		);

		expect(code).toBe(0);
		const call = mockFetchCvmChannelLogs.mock.calls[0] as [
			string,
			CvmLogChannel,
			SerialLogsOptions,
		];
		expect(call[1]).toBe("stderr");
	});

	test("--serial with --follow streams CVM serial logs", async () => {
		const code = await logsCommand.run(
			{
				...defaultInput,
				serial: true,
				follow: true,
			},
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
			}),
		);

		expect(code).toBe(0);
		expect(mockStreamCvmChannelLogs).toHaveBeenCalledTimes(1);
		expect(stdoutWriteSpy).toHaveBeenCalledWith("streaming serial\n");
	});

	test("--serial with --json returns JSON output", async () => {
		const successData: unknown[] = [];

		const code = await logsCommand.run(
			{
				...defaultInput,
				serial: true,
				json: true,
			},
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
				success: (data: unknown) => successData.push(data),
			}),
		);

		expect(code).toBe(0);
		expect(successData).toHaveLength(1);
		const result = successData[0] as {
			logs?: string;
			cvm_id?: string;
			channel?: string;
		};
		expect(result.logs).toBe("serial log output\n");
		expect(result.channel).toBe("serial");
	});

	// --- Mutual exclusivity tests ---

	test("errors when container-name combined with --serial", async () => {
		const failMessages: string[] = [];
		const code = await logsCommand.run(
			{
				...defaultInput,
				containerName: "my-service",
				serial: true,
			},
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
				fail: (msg: string) => failMessages.push(msg),
			}),
		);

		expect(code).toBe(1);
		expect(failMessages[0]).toContain("Cannot combine container name");
	});

	test("errors when multiple CVM flags given", async () => {
		const failMessages: string[] = [];
		const code = await logsCommand.run(
			{
				...defaultInput,
				serial: true,
				cvmStdout: true,
			},
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
				fail: (msg: string) => failMessages.push(msg),
			}),
		);

		expect(code).toBe(1);
		expect(failMessages[0]).toContain("mutually exclusive");
	});

	test("errors when --stderr used with CVM flag", async () => {
		const failMessages: string[] = [];
		const code = await logsCommand.run(
			{
				...defaultInput,
				serial: true,
				stderr: true,
			},
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
				fail: (msg: string) => failMessages.push(msg),
			}),
		);

		expect(code).toBe(1);
		expect(failMessages[0]).toContain(
			"--stdout and --stderr are only valid in container mode",
		);
	});

	// --- Smart fallback tests ---

	test("auto-selects container mode when CVM is running and no flags given", async () => {
		mockGetCvmStatus.mockResolvedValue("running");

		const code = await logsCommand.run(
			{ ...defaultInput },
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
			}),
		);

		expect(code).toBe(0);
		expect(mockGetCvmStatus).toHaveBeenCalledTimes(1);
		expect(mockFetchContainerLogsEntries).toHaveBeenCalledTimes(1);
		expect(mockFetchCvmChannelLogs).not.toHaveBeenCalled();
	});

	test("falls back to serial when CVM is stopped and no flags given", async () => {
		mockGetCvmStatus.mockResolvedValue("stopped");

		const code = await logsCommand.run(
			{ ...defaultInput },
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
			}),
		);

		expect(code).toBe(0);
		expect(mockGetCvmStatus).toHaveBeenCalledTimes(1);
		expect(mockFetchCvmChannelLogs).toHaveBeenCalledTimes(1);
		const call = mockFetchCvmChannelLogs.mock.calls[0] as [
			string,
			CvmLogChannel,
			SerialLogsOptions,
		];
		expect(call[1]).toBe("serial");
	});

	test("defaults to container mode when getCvmStatus fails", async () => {
		mockGetCvmStatus.mockRejectedValue(new Error("network error"));

		const code = await logsCommand.run(
			{ ...defaultInput },
			makeContext({
				cvmId: { id: "app_abc123" },
				stdout: fakeStdout as unknown as NodeJS.WriteStream,
				stderr: fakeStderr as unknown as NodeJS.WriteStream,
			}),
		);

		expect(code).toBe(0);
		expect(mockFetchContainerLogsEntries).toHaveBeenCalledTimes(1);
	});
});
