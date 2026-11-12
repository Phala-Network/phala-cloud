/**
 * Wire contract of `phala cvms resize` and `phala cvms upgrade` against
 * PATCH /cvms/{id}.
 *
 * Runs the real command handlers and SDK client against a local HTTP server
 * and asserts the requests that reach it.
 */

import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import type { CommandContext } from "@/src/core/types";

// Other test files replace @phala/cloud and @/src/lib/client with
// mock.module, and bun keeps module mocks for the rest of the process. Load
// fresh real instances for this file so it talks to the local server through
// the real SDK client. @phala/cloud stays real afterwards; the CLI client
// module is put back as it was.
//
// Files that mock @/src/utils/logger with a no-op setJsonMode also overwrite
// the setJsonMode of @/src/core/json-mode, which the logger re-exports. Load
// fresh real instances of both, or setJsonMode(true) below does nothing and
// resize stops at an interactive prompt.
const realCloud = await import(`${require.resolve("@phala/cloud")}?real`);
mock.module("@phala/cloud", () => ({ ...realCloud }));
const realJsonMode: typeof import("@/src/core/json-mode") = await import(
	`${require.resolve("@/src/core/json-mode")}?real`
);
mock.module("@/src/core/json-mode", () => ({ ...realJsonMode }));
const realLogger: typeof import("@/src/utils/logger") = await import(
	`${require.resolve("@/src/utils/logger")}?real`
);
mock.module("@/src/utils/logger", () => ({ ...realLogger }));
const { setJsonMode } = realJsonMode;
const { logger } = realLogger;
const previousClient = { ...(await import("@/src/lib/client")) };
const realClient = await import(`${require.resolve("@/src/lib/client")}?real`);
mock.module("@/src/lib/client", () => ({ ...realClient }));
afterAll(() => {
	mock.module("@/src/lib/client", () => previousClient);
});
const { cvmsResizeCommand } = await import("./resize/index");
const { cvmsUpgradeCommand } = await import("./upgrade/index");

type Recorded = {
	method: string;
	path: string;
	body: Record<string, unknown> | undefined;
};

const CVM_ID = "0123456789abcdef0123456789abcdef";
const APP_ID = "fedcba9876543210fedcba9876543210fedcba98";
const COMPOSE = "services:\n  app:\n    image: nginx\n";
const ENV_KEYS = [
	"PHALA_CLOUD_API_KEY",
	"PHALA_CLOUD_API_PREFIX",
	"PHALA_CLOUD_DIR",
] as const;

let server: ReturnType<typeof Bun.serve>;
let requests: Recorded[] = [];
// Per-test response override; return undefined to fall through to defaults.
let respond:
	| ((method: string, path: string) => Response | undefined)
	| undefined;
let tmpDir: string;
let composePath: string;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

beforeAll(async () => {
	server = Bun.serve({
		port: 0,
		async fetch(req) {
			const url = new URL(req.url);
			const text = await req.text();
			requests.push({
				method: req.method,
				path: url.pathname,
				body: text ? JSON.parse(text) : undefined,
			});
			const overridden = respond?.(req.method, url.pathname);
			if (overridden) return overridden;
			if (req.method === "GET") {
				return Response.json({
					id: CVM_ID,
					name: "my-app",
					app_id: APP_ID,
					status: "running",
					resource: {
						vcpu: 2,
						memory_in_gb: 4,
						memory_in_mb: 4096,
						disk_in_gb: 20,
					},
					gateway: {},
				});
			}
			return Response.json(
				{
					message: "CVM update initiated",
					correlation_id: "corr-1",
					status: "in_progress",
				},
				{ status: 202 },
			);
		},
	});
	tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "phala-cvms-update-"));
	composePath = path.join(tmpDir, "docker-compose.yml");
	await fs.writeFile(composePath, COMPOSE);

	// resizeCvm builds its client from process.env, not from the context.
	for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
	process.env.PHALA_CLOUD_API_KEY = "test-key";
	process.env.PHALA_CLOUD_API_PREFIX = `http://127.0.0.1:${server.port}/api/v1`;
	process.env.PHALA_CLOUD_DIR = tmpDir;
	setJsonMode(true);
});

afterAll(async () => {
	setJsonMode(false);
	for (const key of ENV_KEYS) {
		if (savedEnv[key] === undefined) delete process.env[key];
		else process.env[key] = savedEnv[key];
	}
	server.stop(true);
	await fs.remove(tmpDir);
});

afterEach(() => {
	requests = [];
	respond = undefined;
	for (const spy of spies) spy.mockRestore();
	spies.length = 0;
});

const spies: Array<ReturnType<typeof spyOn>> = [];
function spyLogger(method: "info" | "success" | "error") {
	const spy = spyOn(logger, method).mockImplementation(() => {});
	spies.push(spy);
	return spy;
}

function makeContext(): { context: CommandContext; failure: () => unknown } {
	let failure: unknown;
	const context = {
		env: process.env,
		projectConfig: {},
		cvmId: { id: CVM_ID },
		stdout: { write: () => true },
		stderr: { write: () => true },
		success: () => {},
		fail: (message: string) => {
			failure = new Error(message);
		},
		failWithError: (error: unknown) => {
			failure = error;
		},
	} as unknown as CommandContext;
	return { context, failure: () => failure };
}

function patches(): Recorded[] {
	return requests.filter((r) => r.method === "PATCH");
}

describe("phala cvms resize", () => {
	test("does not send allow_restart", async () => {
		const { context, failure } = makeContext();
		const exitCode = await cvmsResizeCommand.run(
			{ vcpu: "4", allowRestart: "true", yes: true } as Parameters<
				typeof cvmsResizeCommand.run
			>[0],
			context,
		);

		expect(failure()).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(patches()).toEqual([
			{
				method: "PATCH",
				path: `/api/v1/cvms/app_${APP_ID}`,
				body: { vcpu: 4, memory: 4096, disk_size: 20 },
			},
		]);
	});
});

describe("phala cvms upgrade", () => {
	test("sends the compose file through the unified PATCH endpoint", async () => {
		const { context, failure } = makeContext();
		const exitCode = await cvmsUpgradeCommand.run(
			{ compose: composePath } as Parameters<typeof cvmsUpgradeCommand.run>[0],
			context,
		);

		expect(failure()).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(requests.some((r) => r.method === "PUT")).toBe(false);
		expect(patches()).toEqual([
			{
				method: "PATCH",
				path: `/api/v1/cvms/${CVM_ID}`,
				body: { docker_compose_file: COMPOSE },
			},
		]);
	});
});

describe("phala cvms upgrade with an unchanged compose", () => {
	test("reports that there is nothing to do", async () => {
		respond = (method) =>
			method === "PATCH"
				? Response.json({
						status: "no_change",
						message: "Compose configuration unchanged",
						correlation_id: "",
					})
				: undefined;
		const info = spyLogger("info");
		const success = spyLogger("success");
		const { context } = makeContext();
		const exitCode = await cvmsUpgradeCommand.run(
			{ compose: composePath } as Parameters<typeof cvmsUpgradeCommand.run>[0],
			context,
		);

		expect(exitCode).toBe(0);
		expect(info).toHaveBeenCalledWith("Compose unchanged; nothing to do");
		expect(success).not.toHaveBeenCalled();
	});
});

describe("phala cvms upgrade edge cases", () => {
	test("stops with an error on contract-owned KMS (465)", async () => {
		respond = (method) =>
			method === "PATCH"
				? Response.json(
						{
							error_code: "ERR-01-005",
							message: "Compose hash registration required",
							details: [
								{ field: "compose_hash", value: "abc123" },
								{ field: "app_id", value: APP_ID },
								{ field: "device_id", value: "dev-1" },
								{
									field: "kms_info",
									value: {
										id: "1",
										slug: "base",
										url: "https://kms.example.com",
										version: "1.0.0",
										chain_id: 8453,
										kms_contract_address: "0xkms",
										gateway_app_id: "0xgateway",
									},
								},
							],
						},
						{ status: 465 },
					)
				: undefined;
		const error = spyLogger("error");
		const success = spyLogger("success");
		const { context } = makeContext();
		const exitCode = await cvmsUpgradeCommand.run(
			{ compose: composePath } as Parameters<typeof cvmsUpgradeCommand.run>[0],
			context,
		);

		expect(exitCode).toBe(1);
		expect(error).toHaveBeenCalledWith(
			`This CVM uses on-chain KMS: compose hash abc123 must be registered on-chain first. Use "phala deploy --cvm-id app_${APP_ID}" instead.`,
		);
		expect(success).not.toHaveBeenCalled();
	});

	test("sends allowed_envs and encrypted_env with --env-file", async () => {
		respond = (method) =>
			method === "GET"
				? Response.json({
						id: CVM_ID,
						name: "my-app",
						app_id: APP_ID,
						status: "running",
						resource: {
							vcpu: 2,
							memory_in_gb: 4,
							memory_in_mb: 4096,
							disk_in_gb: 20,
						},
						gateway: {},
						kms_info: { encrypted_env_pubkey: "11".repeat(32) },
					})
				: undefined;
		const envFile = path.join(tmpDir, ".env");
		await fs.writeFile(envFile, "FOO=bar\nBAZ=qux\n");
		const { context, failure } = makeContext();
		const exitCode = await cvmsUpgradeCommand.run(
			{ compose: composePath, envFile } as Parameters<
				typeof cvmsUpgradeCommand.run
			>[0],
			context,
		);

		expect(failure()).toBeUndefined();
		expect(exitCode).toBe(0);
		const body = patches()[0]?.body ?? {};
		expect(Object.keys(body).sort()).toEqual([
			"allowed_envs",
			"docker_compose_file",
			"encrypted_env",
		]);
		expect(body.allowed_envs).toEqual(["FOO", "BAZ"]);
		expect(body.docker_compose_file).toBe(COMPOSE);
		expect(body.encrypted_env).toMatch(/^[0-9a-f]+$/);
	});
});
