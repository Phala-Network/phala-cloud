import { afterAll, describe, expect, mock, test } from "bun:test";
import type { CommandContext } from "@/src/core/types";

const realCloud = await import(
	`${require.resolve("@phala/cloud")}?serial-log-test-real`
);
mock.module("@phala/cloud", () => ({ ...realCloud }));
const realClient = await import(
	`${require.resolve("@/src/lib/client")}?serial-log-test-real`
);
const realLogger = await import(
	`${require.resolve("@/src/utils/logger")}?serial-log-test-real`
);
mock.module("@/src/utils/logger", () => ({ ...realLogger }));
const realApi = await import(
	`${require.resolve("@/src/api/cvms")}?serial-log-test-real`
);

const fetchSerialLogs = mock(() => Promise.resolve(""));
const streamSerialLogs = mock(() => Promise.resolve());
const getClient = mock(() => Promise.resolve({}));

mock.module("@/src/api/cvms", () => ({
	...realApi,
	fetchSerialLogs,
	streamSerialLogs,
}));
mock.module("@/src/lib/client", () => ({ ...realClient, getClient }));

const { cvmsSerialLogsCommand } = await import("./index");

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
		cvmId: { id: "app_abc123" },
		...overrides,
	} as CommandContext;
}

afterAll(() => {
	mock.module("@/src/api/cvms", () => ({ ...realApi }));
	mock.module("@/src/lib/client", () => ({ ...realClient }));
	mock.module("@phala/cloud", () => ({ ...realCloud }));
	mock.module("@/src/utils/logger", () => ({ ...realLogger }));
});

describe("deprecated cvms serial-logs command", () => {
	test("rejects --timestamps before CVM detail or log requests", async () => {
		const failMessages: string[] = [];
		const code = await cvmsSerialLogsCommand.run(
			{
				cvmId: "app_abc123",
				tail: undefined,
				follow: false,
				timestamps: true,
				json: false,
				interactive: false,
			},
			makeContext({ fail: (message: string) => failMessages.push(message) }),
		);

		expect(code).toBe(1);
		expect(failMessages[0]).toContain(
			"not supported for serial/stdout/stderr logs",
		);
		expect(getClient).not.toHaveBeenCalled();
		expect(fetchSerialLogs).not.toHaveBeenCalled();
		expect(streamSerialLogs).not.toHaveBeenCalled();
	});
});
