import { describe, test, expect, mock, beforeEach } from "bun:test";
import type { CommandContext } from "@/src/core/types";

class MockResourceError extends Error {}

const mockPost = mock(() =>
	Promise.resolve({
		app_id: "app-123",
		vm_uuid: "vm-123",
		name: "redis-0",
		status: "running",
		teepod_id: 5,
		vcpu: 2,
		memory: 4096,
		disk_size: 20,
	}),
);

mock.module("@phala/cloud", () => ({
	ResourceError: MockResourceError,
	safeAddComposeHash: mock(() => Promise.resolve({ success: true, data: {} })),
	safeAddDevice: mock(() => Promise.resolve({ success: true, data: {} })),
	safeCheckOnChainPrerequisites: mock(() =>
		Promise.resolve({
			success: true,
			data: { composeHashAllowed: true, deviceAllowed: true },
		}),
	),
	safeGetAvailableNodes: mock(() =>
		Promise.resolve({ success: true, data: { nodes: [] } }),
	),
	safeGetAppCvms: mock(() => Promise.resolve({ success: true, data: [] })),
	safeGetCvmInfo: mock(() => Promise.resolve({ success: true, data: {} })),
	safeGetAppEnvEncryptPubKey: mock(() =>
		Promise.resolve({ success: true, data: { public_key: "pubkey" } }),
	),
	encryptEnvVars: mock(() => "encrypted-env"),
	formatErrorMessage: (error: Error) => error.message,
	formatStructuredError: (error: Error) => error.message,
}));

mock.module("@/src/lib/client", () => ({
	getClient: mock(() => Promise.resolve({ post: mockPost })),
}));

const noop = () => {};
mock.module("@/src/utils/logger", () => ({
	logger: {
		info: noop,
		warn: noop,
		error: noop,
		success: noop,
		logDetailedError: noop,
	},
}));

const { instancesAddCommand } = await import("./index");

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
	return {
		argv: [],
		rawFlags: {},
		rawPositionals: [],
		cwd: process.cwd(),
		env: process.env,
		stdout: { write: mock(() => true) } as unknown as NodeJS.WriteStream,
		stderr: { write: mock(() => true) } as unknown as NodeJS.WriteStream,
		stdin: process.stdin,
		projectConfig: {},
		success() {},
		fail() {},
		...overrides,
	};
}

describe("instances add command", () => {
	beforeEach(() => {
		mockPost.mockClear();
	});

	test("sends custom name when creating an app instance", async () => {
		const code = await instancesAddCommand.run(
			{ appId: "app-123", name: "redis-0", nodeId: "5" },
			makeContext(),
		);

		expect(code).toBe(0);
		expect(mockPost).toHaveBeenCalledWith(
			"/apps/app-123/instances",
			{ name: "redis-0", node_id: 5 },
			{ headers: undefined },
		);
	});

	test("does not send custom name in commit mode", async () => {
		const code = await instancesAddCommand.run(
			{
				appId: "app-123",
				name: "redis-0",
				commit: true,
				token: "token-123",
				composeHash: "hash-123",
				transactionHash: "0xtx",
			},
			makeContext(),
		);

		expect(code).toBe(0);
		expect(mockPost).toHaveBeenCalledWith("/apps/app-123/instances", {
			token: "token-123",
			compose_hash: "hash-123",
			transaction_hash: "0xtx",
		});
	});
});
