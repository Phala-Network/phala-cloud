import { beforeEach, describe, expect, mock, test } from "bun:test";
import { buildCommandSchemaInput } from "@/src/core/input-builder";
import { parseCommandArguments } from "@/src/core/parser";
import { CommandRegistry } from "@/src/core/registry";
import type { CommandContext } from "@/src/core/types";
import {
	cvmsReplicateCommandMeta,
	cvmsReplicateCommandSchema,
} from "../../cvms/replicate/command";
import { instancesAddCommandMeta, instancesAddCommandSchema } from "./command";

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
	SUPPORTED_CHAINS: {},
	safeAddComposeHash: mock(() => Promise.resolve({ success: true, data: {} })),
	safeAddDevice: mock(() => Promise.resolve({ success: true, data: {} })),
	safeCheckOnChainPrerequisites: mock(() =>
		Promise.resolve({
			success: true,
			data: { composeHashAllowed: true, deviceAllowed: true },
		}),
	),
	safeGetAppCvms: mock(() => Promise.resolve({ success: true, data: [] })),
	safeGetCvmInfo: mock(() =>
		Promise.resolve({ success: true, data: { vm_uuid: "source-uuid" } }),
	),
	safeGetAppEnvEncryptPubKey: mock(() =>
		Promise.resolve({
			success: true,
			data: { public_key: "aa", signature: "bb" },
		}),
	),
	verifyEnvEncryptPublicKeyLegacy: mock(() => "0xexpected_kms_pubkey"),
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
const { cvmsReplicateCommand } = await import("../../cvms/replicate/index");

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
		failWithError() {},
		...overrides,
	} as CommandContext;
}

describe("instances add command", () => {
	beforeEach(() => {
		mockPost.mockClear();
	});

	test("registers and parses only the physical node flag", () => {
		const registry = new CommandRegistry();
		registry.registerCommand(instancesAddCommand);
		registry.registerCommand(cvmsReplicateCommand);
		for (const [path, meta] of [
			[["instances", "add"], instancesAddCommandMeta],
			[["cvms", "replicate"], cvmsReplicateCommandMeta],
		] as const) {
			const registered = registry.resolveCommand(path)?.definition;
			expect(registered?.meta).toBe(meta);
			const parsed = parseCommandArguments(
				["--node", "usw5"],
				registered?.meta.options,
			);
			expect(buildCommandSchemaInput(meta, parsed).options.node).toBe("usw5");
			expect(
				meta.options?.some(
					(option) => option.name === "node" && option.target === "node",
				),
			).toBe(true);
			expect(
				meta.options?.some(
					(option) =>
						option.name === "node-id" || option.aliases?.includes("teepod-id"),
				),
			).toBe(false);
		}
	});

	test("sends physical node name for an instance", async () => {
		const code = await instancesAddCommand.run(
			instancesAddCommandSchema.parse({
				appId: "app-123",
				name: "redis-0",
				node: "usw5",
			}),
			makeContext(),
		);
		expect(code).toBe(0);
		expect(mockPost).toHaveBeenCalledWith(
			"/apps/app-123/instances",
			{ name: "redis-0", node: "usw5" },
			{ headers: undefined },
		);
	});

	test("sends physical node name for a replica", async () => {
		const code = await cvmsReplicateCommand.run(
			cvmsReplicateCommandSchema.parse({ node: "usw5" }),
			makeContext({ cvmId: { id: "source-uuid" } }),
		);
		expect(code).toBe(0);
		expect(mockPost).toHaveBeenCalledWith(
			"/cvms/source-uuid/replicas",
			{ node: "usw5" },
			{ headers: undefined },
		);
	});

	test("does not send custom name in commit mode", async () => {
		const code = await instancesAddCommand.run(
			instancesAddCommandSchema.parse({
				appId: "app-123",
				name: "redis-0",
				commit: true,
				token: "token-123",
				composeHash: "hash-123",
				transactionHash: "0xtx",
			}),
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
