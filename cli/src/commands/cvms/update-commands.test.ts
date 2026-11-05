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
	test,
} from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { setJsonMode } from "@/src/core/json-mode";
import type { CommandContext } from "@/src/core/types";

// Other test files replace @phala/cloud and @/src/lib/client with
// mock.module, and bun keeps module mocks for the rest of the process. Load
// fresh real instances for this file so it talks to the local server through
// the real SDK client. @phala/cloud stays real afterwards; the CLI client
// module is put back as it was.
const realCloud = await import(`${require.resolve("@phala/cloud")}?real`);
mock.module("@phala/cloud", () => ({ ...realCloud }));
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
			if (req.method === "GET") {
				return Response.json({
					id: CVM_ID,
					name: "my-app",
					app_id: APP_ID,
					status: "running",
					resource: { vcpu: 2, memory_in_gb: 4, disk_in_gb: 20 },
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
});

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
