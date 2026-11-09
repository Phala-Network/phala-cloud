/**
 * Wire contract of `phala cvms init-scripts` against GET/PATCH/PUT init-scripts.
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
import type { CommandContext } from "@/src/core/types";

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
const previousClient = { ...(await import("@/src/lib/client")) };
const realClient = await import(`${require.resolve("@/src/lib/client")}?real`);
mock.module("@/src/lib/client", () => ({ ...realClient }));
afterAll(() => {
	mock.module("@/src/lib/client", () => previousClient);
});
const { cvmsInitScriptsCommand } = await import("./init-scripts/index");

type Recorded = {
	method: string;
	path: string;
	body: Record<string, unknown> | undefined;
};

const CVM_ID = "my-cvm";
const ENV_KEYS = [
	"PHALA_CLOUD_API_KEY",
	"PHALA_CLOUD_API_PREFIX",
	"PHALA_CLOUD_DIR",
] as const;

const PLATFORM = {
	items: [
		{
			slug: "docker_cleanup",
			selected: false,
			selectable: true,
			reason: null,
		},
		{ slug: "env_merge", selected: true, selectable: true, reason: null },
	],
	has_custom_scripts: false,
};

let server: ReturnType<typeof Bun.serve>;
let requests: Recorded[] = [];
let respond:
	| ((method: string, path: string) => Response | undefined)
	| undefined;
let tmpDir: string;
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
			if (req.method === "GET" && url.pathname.endsWith("/init-scripts")) {
				return Response.json(PLATFORM);
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
	tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "phala-cvms-init-scripts-"));
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

describe("phala cvms init-scripts", () => {
	test("lists platform scripts", async () => {
		const { context, failure } = makeContext();
		const exitCode = await cvmsInitScriptsCommand.run(
			{ json: true } as Parameters<typeof cvmsInitScriptsCommand.run>[0],
			context,
		);

		expect(failure()).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(requests).toEqual([
			{
				method: "GET",
				path: `/api/v1/cvms/${CVM_ID}/init-scripts`,
				body: undefined,
			},
		]);
	});

	test("turns docker_cleanup on through PATCH init_scripts", async () => {
		const { context, failure } = makeContext();
		const exitCode = await cvmsInitScriptsCommand.run(
			{
				slug: "docker_cleanup",
				state: "on",
				confirmDataWipe: true,
			} as Parameters<typeof cvmsInitScriptsCommand.run>[0],
			context,
		);

		expect(failure()).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(requests.filter((r) => r.method === "PATCH")).toEqual([
			{
				method: "PATCH",
				path: `/api/v1/cvms/${CVM_ID}`,
				body: {
					init_scripts: ["docker_cleanup", "env_merge"],
					confirm_data_wipe: true,
				},
			},
		]);
	});

	test("rejects docker_cleanup on without --confirm-data-wipe", async () => {
		const { context, failure } = makeContext();
		const exitCode = await cvmsInitScriptsCommand.run(
			{
				slug: "docker_cleanup",
				state: "on",
			} as Parameters<typeof cvmsInitScriptsCommand.run>[0],
			context,
		);

		expect(exitCode).toBe(1);
		expect(String(failure())).toContain("--confirm-data-wipe");
		expect(requests.filter((r) => r.method === "PATCH")).toEqual([]);
	});

	test("refuses to replace custom scripts without --yes", async () => {
		respond = (method, pathname) =>
			method === "GET" && pathname.endsWith("/init-scripts")
				? Response.json({ ...PLATFORM, has_custom_scripts: true })
				: undefined;
		const { context, failure } = makeContext();
		const exitCode = await cvmsInitScriptsCommand.run(
			{
				slug: "env_merge",
				state: "off",
			} as Parameters<typeof cvmsInitScriptsCommand.run>[0],
			context,
		);

		expect(exitCode).toBe(1);
		expect(String(failure())).toContain("--yes");
		expect(requests.filter((r) => r.method !== "GET")).toEqual([]);
	});

	test("hidden --file sends PUT scripts", async () => {
		const scriptPath = path.join(tmpDir, "custom.sh");
		await fs.writeFile(scriptPath, "echo custom\n");
		const { context, failure } = makeContext();
		const exitCode = await cvmsInitScriptsCommand.run(
			{ file: [scriptPath] } as Parameters<
				typeof cvmsInitScriptsCommand.run
			>[0],
			context,
		);

		expect(failure()).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(requests.filter((r) => r.method === "PUT")).toEqual([
			{
				method: "PUT",
				path: `/api/v1/cvms/${CVM_ID}/init-scripts`,
				body: { scripts: ["echo custom\n"] },
			},
		]);
	});

	test("rejects --file with a slug change", async () => {
		const { context, failure } = makeContext();
		const exitCode = await cvmsInitScriptsCommand.run(
			{
				file: ["custom.sh"],
				slug: "docker_cleanup",
				state: "on",
			} as Parameters<typeof cvmsInitScriptsCommand.run>[0],
			context,
		);

		expect(exitCode).toBe(1);
		expect(String(failure())).toContain("cannot be combined");
		expect(requests).toEqual([]);
	});
});
