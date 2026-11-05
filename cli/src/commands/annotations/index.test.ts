/**
 * Wire contract of `phala annotations` against GET / PUT
 * /cvms/{id}/annotations, through the real SDK client and a local server.
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

// Other test files replace @phala/cloud and @/src/lib/client with
// mock.module; load fresh real instances (see deploy/update.test.ts).
const realCloud = await import(`${require.resolve("@phala/cloud")}?real`);
mock.module("@phala/cloud", () => ({ ...realCloud }));
const previousClient = { ...(await import("@/src/lib/client")) };
const realClient = await import(`${require.resolve("@/src/lib/client")}?real`);
mock.module("@/src/lib/client", () => ({ ...realClient }));
afterAll(() => {
	mock.module("@/src/lib/client", () => previousClient);
});
const { annotationsCommand } = await import("./index");
const { dispatchCommand } = await import("@/src/core/dispatcher");
const { CommandRegistry } = await import("@/src/core/registry");

type Recorded = { method: string; path: string; body: unknown };

const CVM_ID = "0123456789abcdef0123456789abcdef";
const TOML_CVM_ID = "fedcba9876543210fedcba9876543210";

let server: ReturnType<typeof Bun.serve>;
let requests: Recorded[] = [];
let stored: Record<string, string> = {};
let tmpDir: string;

beforeAll(async () => {
	server = Bun.serve({
		port: 0,
		async fetch(req) {
			const url = new URL(req.url);
			const text = await req.text();
			const body = text ? JSON.parse(text) : undefined;
			requests.push({ method: req.method, path: url.pathname, body });
			if (req.method === "PUT") {
				return Response.json({ annotations: body.annotations });
			}
			return Response.json({ annotations: stored });
		},
	});
	tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "phala-annotations-"));
});

afterAll(async () => {
	server.stop(true);
	await fs.remove(tmpDir);
});

afterEach(() => {
	requests = [];
	stored = {};
});

async function run(input: Record<string, unknown>) {
	let failure: unknown;
	let stdout = "";
	const context = {
		env: {
			PHALA_CLOUD_API_KEY: "test-key",
			PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}/api/v1`,
			PHALA_CLOUD_DIR: tmpDir,
		},
		projectConfig: {},
		cvmId: { id: TOML_CVM_ID },
		stdout: {
			write: (chunk: string) => {
				stdout += chunk;
				return true;
			},
		},
		stderr: { write: () => true },
		fail: (message: string) => {
			failure = new Error(message);
		},
		failWithError: (error: unknown) => {
			failure = error;
		},
	} as unknown as CommandContext;
	const exitCode = await annotationsCommand.run(
		{ args: [], "--": [], clear: false, replace: false, ...input },
		context,
	);
	return { exitCode, failure, stdout };
}

/** Run `phala <argv>` through the real argument parser and dispatcher. */
async function runCli(argv: string[]) {
	const registry = new CommandRegistry();
	registry.registerCommand(annotationsCommand);
	const output = {
		write: () => true,
		isTTY: false,
	} as unknown as NodeJS.WriteStream;
	return dispatchCommand({
		registry,
		argv,
		executableName: "phala",
		version: "0.0.0",
		packageName: "phala",
		packageVersion: "0.0.0",
		runtime: "bun",
		cwd: tmpDir,
		env: {
			...process.env,
			PHALA_DISABLE_UPDATE_CHECK: "1",
			PHALA_CLOUD_API_KEY: "test-key",
			PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}/api/v1`,
			PHALA_CLOUD_DIR: tmpDir,
		},
		stdout: output,
		stderr: output,
		stdin: process.stdin,
	});
}

describe("phala annotations (parsed argv)", () => {
	test("treats pairs after -- as pairs and sends the PUT", async () => {
		stored = { old: "x" };
		const code = await runCli([
			"annotations",
			CVM_ID,
			"--",
			"tier=fast",
			"-host-key=value",
		]);

		expect(code).toBe(0);
		expect(requests.map((r) => [r.method, r.path, r.body])).toEqual([
			["GET", `/api/v1/cvms/${CVM_ID}/annotations`, undefined],
			[
				"PUT",
				`/api/v1/cvms/${CVM_ID}/annotations`,
				{ annotations: { old: "x", tier: "fast", "-host-key": "value" } },
			],
		]);
	});
});

describe("phala annotations", () => {
	test("shows the annotations of the CVM given as the first argument", async () => {
		stored = { memory_tier: "fast" };
		const { exitCode, stdout } = await run({ args: [CVM_ID] });

		expect(exitCode).toBe(0);
		expect(requests).toEqual([
			{
				method: "GET",
				path: `/api/v1/cvms/${CVM_ID}/annotations`,
				body: undefined,
			},
		]);
		expect(stdout).toBe("memory_tier=fast\n");
	});

	test("merges pairs into the current set, removes --unset keys, and PUTs the full map", async () => {
		stored = { memory_tier: "slow", pin_numa: "0", old: "x" };
		const { exitCode } = await run({
			args: [CVM_ID, "memory_tier=fast", "note=a=b"],
			unset: ["old"],
		});

		expect(exitCode).toBe(0);
		expect(requests.map((r) => [r.method, r.path, r.body])).toEqual([
			["GET", `/api/v1/cvms/${CVM_ID}/annotations`, undefined],
			[
				"PUT",
				`/api/v1/cvms/${CVM_ID}/annotations`,
				{ annotations: { memory_tier: "fast", pin_numa: "0", note: "a=b" } },
			],
		]);
	});

	test("uses the phala.toml CVM when the first argument is a pair", async () => {
		const { exitCode } = await run({ args: ["memory_tier=fast"] });

		expect(exitCode).toBe(0);
		expect(requests.at(-1)?.path).toBe(
			`/api/v1/cvms/${TOML_CVM_ID}/annotations`,
		);
	});

	test("--replace sends only the given pairs without reading", async () => {
		stored = { old: "x" };
		const { exitCode } = await run({
			args: [CVM_ID, "memory_tier=fast"],
			replace: true,
		});

		expect(exitCode).toBe(0);
		expect(requests.map((r) => [r.method, r.body])).toEqual([
			["PUT", { annotations: { memory_tier: "fast" } }],
		]);
	});

	test("--clear sends an empty map", async () => {
		const { exitCode } = await run({ args: [CVM_ID], clear: true });

		expect(exitCode).toBe(0);
		expect(requests.map((r) => [r.method, r.body])).toEqual([
			["PUT", { annotations: {} }],
		]);
	});

	test("rejects --clear with pairs before any request", async () => {
		const { exitCode, failure } = await run({
			args: [CVM_ID, "a=b"],
			clear: true,
		});

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain("--clear cannot be combined");
		expect(requests).toEqual([]);
	});
});
