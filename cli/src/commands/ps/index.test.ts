import {
	describe,
	test,
	expect,
	mock,
	beforeEach,
	afterEach,
	spyOn,
} from "bun:test";
import type { CommandContext } from "@/src/core/types";

// Mock @phala/cloud before importing the command
const mockSafeGetCvmContainersStats = mock(() =>
	Promise.resolve({ success: true as const, data: {} } as
		| { success: true; data: Record<string, unknown> }
		| { success: false; error: { message: string } }),
);

mock.module("@phala/cloud", () => ({
	safeGetCvmContainersStats: mockSafeGetCvmContainersStats,
}));

mock.module("@/src/lib/client", () => ({
	getClient: mock(() => Promise.resolve({})),
}));

const noop = () => {};
mock.module("@/src/utils/logger", () => ({
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
	},
}));

// Import after mocking
const { psCommand } = await import("./index");

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

describe("ps command", () => {
	let consoleSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mockSafeGetCvmContainersStats.mockClear();
		consoleSpy = spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	test("returns 1 when no CVM ID provided", async () => {
		const failMessages: string[] = [];
		const code = await psCommand.run(
			{ json: false, interactive: false },
			makeContext({
				fail: (msg: string) => {
					failMessages.push(msg);
				},
			}),
		);
		expect(code).toBe(1);
		expect(failMessages[0]).toContain("No CVM ID");
	});

	test("returns 0 with running containers", async () => {
		mockSafeGetCvmContainersStats.mockResolvedValue({
			success: true,
			data: {
				is_online: true,
				is_public: true,
				error: null,
				docker_compose_file: null,
				manifest_version: null,
				version: null,
				runner: null,
				features: null,
				containers: [
					{
						id: "abc123",
						names: ["/nginx"],
						image: "nginx:alpine",
						image_id: "sha256:abc",
						command: "/docker-entrypoint.sh nginx -g daemon off;",
						created: Math.floor(Date.now() / 1000) - 3600,
						state: "running",
						status: "Up 1 hour",
						log_endpoint: null,
					},
					{
						id: "def456",
						names: ["/redis"],
						image: "redis:latest",
						image_id: "sha256:def",
						command: "redis-server",
						created: Math.floor(Date.now() / 1000) - 7200,
						state: "running",
						status: "Up 2 hours",
						log_endpoint: null,
					},
				],
			},
		});

		const code = await psCommand.run(
			{ cvmId: "test-app", json: false, interactive: false },
			makeContext({ cvmId: { id: "test-app" } }),
		);
		expect(code).toBe(0);
	});

	test("returns 0 with JSON output", async () => {
		const successData: unknown[] = [];
		mockSafeGetCvmContainersStats.mockResolvedValue({
			success: true,
			data: {
				is_online: true,
				is_public: true,
				error: null,
				docker_compose_file: null,
				manifest_version: null,
				version: null,
				runner: null,
				features: null,
				containers: [
					{
						id: "abc123",
						names: ["/app"],
						image: "nginx:latest",
						image_id: "sha256:abc",
						command: "nginx",
						created: 1672531200,
						state: "running",
						status: "Up 2 hours",
						log_endpoint: null,
					},
				],
			},
		});

		const code = await psCommand.run(
			{ cvmId: "test-app", json: true, interactive: false },
			makeContext({
				cvmId: { id: "test-app" },
				success: (data: unknown) => {
					successData.push(data);
				},
			}),
		);
		expect(code).toBe(0);
		expect(successData.length).toBe(1);
		const result = successData[0] as { containers: unknown[] };
		expect(result.containers).toHaveLength(1);
	});

	test("returns 0 with warning when CVM is offline", async () => {
		mockSafeGetCvmContainersStats.mockResolvedValue({
			success: true,
			data: {
				is_online: false,
				is_public: true,
				error: "CVM is not reachable",
				docker_compose_file: null,
				manifest_version: null,
				version: null,
				runner: null,
				features: null,
				containers: null,
			},
		});

		const code = await psCommand.run(
			{ cvmId: "test-app", json: false, interactive: false },
			makeContext({ cvmId: { id: "test-app" } }),
		);
		expect(code).toBe(0);
	});

	test("returns 0 when no containers running", async () => {
		mockSafeGetCvmContainersStats.mockResolvedValue({
			success: true,
			data: {
				is_online: true,
				is_public: true,
				error: null,
				docker_compose_file: null,
				manifest_version: null,
				version: null,
				runner: null,
				features: null,
				containers: [],
			},
		});

		const code = await psCommand.run(
			{ cvmId: "test-app", json: false, interactive: false },
			makeContext({ cvmId: { id: "test-app" } }),
		);
		expect(code).toBe(0);
	});

	test("returns 1 when API call fails", async () => {
		mockSafeGetCvmContainersStats.mockResolvedValue({
			success: false,
			error: { message: "Unauthorized" },
		});

		const failErrors: unknown[] = [];
		const code = await psCommand.run(
			{ cvmId: "test-app", json: false, interactive: false },
			makeContext({
				cvmId: { id: "test-app" },
				failWithError: (error: unknown) => {
					failErrors.push(error);
				},
			}),
		);
		expect(code).toBe(1);
		expect(failErrors[0]).toEqual({ message: "Unauthorized" });
	});
});
