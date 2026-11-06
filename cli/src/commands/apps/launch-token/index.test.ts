/**
 * Wire contract of `phala apps launch-token` against
 * POST / DELETE /apps/{app_id}/launch-token, through the real SDK client.
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
const { appsLaunchTokenSetCommand, appsLaunchTokenClearCommand } = await import(
	"./index"
);

type Recorded = { method: string; path: string; body: unknown };

const APP_ID = "0123456789abcdef0123456789abcdef01234567";
const TOKEN = "t".repeat(32);
const HASH = "a".repeat(64);

let server: ReturnType<typeof Bun.serve>;
let requests: Recorded[] = [];
let tmpDir: string;

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
			if (req.method === "DELETE") return new Response(null, { status: 204 });
			return Response.json({ launch_token: TOKEN, launch_token_hash: HASH });
		},
	});
	tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "phala-launch-token-"));
});

afterAll(async () => {
	server.stop(true);
	await fs.remove(tmpDir);
});

afterEach(() => {
	requests = [];
});

function makeContext() {
	let stdout = "";
	let failure: unknown;
	const context = {
		env: {
			PHALA_CLOUD_API_KEY: "test-key",
			PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}/api/v1`,
			PHALA_CLOUD_DIR: tmpDir,
		},
		projectConfig: {},
		stdout: {
			write: (chunk: string) => {
				stdout += chunk;
				return true;
			},
		},
		stderr: { write: () => true },
		failWithError: (error: unknown) => {
			failure = error;
		},
	} as unknown as CommandContext;
	return { context, stdout: () => stdout, failure: () => failure };
}

describe("phala apps launch-token", () => {
	test("set asks Phala Cloud to generate a token and prints it with its hash", async () => {
		const { context, stdout, failure } = makeContext();
		const exitCode = await appsLaunchTokenSetCommand.run(
			{ appId: APP_ID },
			context,
		);

		expect(failure()).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(requests).toEqual([
			{ method: "POST", path: `/api/v1/apps/${APP_ID}/launch-token`, body: {} },
		]);
		expect(stdout()).toContain(TOKEN);
		expect(stdout()).toContain(HASH);
	});

	test("set sends a caller-supplied --token", async () => {
		const { context } = makeContext();
		await appsLaunchTokenSetCommand.run(
			{ appId: APP_ID, token: TOKEN },
			context,
		);

		expect(requests[0]?.body).toEqual({ launch_token: TOKEN });
	});

	test("clear sends DELETE", async () => {
		const { context, failure } = makeContext();
		const exitCode = await appsLaunchTokenClearCommand.run(
			{ appId: APP_ID },
			context,
		);

		expect(failure()).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(requests.map((r) => [r.method, r.path])).toEqual([
			["DELETE", `/api/v1/apps/${APP_ID}/launch-token`],
		]);
	});
});
