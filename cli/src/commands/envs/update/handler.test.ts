/**
 * Tests for envs update command schema and validation
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { envsUpdateCommandSchema } from "./command";

const CVM_ID = "cvm-example";
const CVM_PATH = `/api/v1/cvms/${CVM_ID}`;
// The integrated ASGI run returned this body when the encrypted environment matched.
const NO_CHANGE = {
	message: "Environment unchanged",
	correlation_id: "",
	status: "no_change",
	allowed_envs_changed: false,
};
const dir = mkdtempSync(join(tmpdir(), "phala-env-update-"));
const requests: string[] = [];
const server = Bun.serve({
	port: 0,
	fetch(request) {
		const key = `${request.method} ${new URL(request.url).pathname}`;
		requests.push(key);
		if (key === `GET ${CVM_PATH}`) {
			return Response.json({
				id: CVM_ID,
				name: "example",
				status: "running",
				resource: { memory_in_mb: 4096 },
				gateway: {},
			});
		}
		if (key === `PATCH ${CVM_PATH}/envs`) {
			return Response.json(NO_CHANGE, { status: 202 });
		}
		return new Response("Unexpected request", { status: 500 });
	},
});

afterAll(() => {
	server.stop(true);
	rmSync(dir, { recursive: true, force: true });
});

test.each([false, true])(
	"reports an unchanged environment without tracking or resubmitting (JSON: %s)",
	async (json) => {
		requests.length = 0;
		const child = Bun.spawn(
			[
				process.execPath,
				"cli/src/index.ts",
				"envs",
				"update",
				CVM_ID,
				"--encrypted-env",
				"abcd",
				...(json ? ["--json"] : []),
			],
			{
				cwd: join(import.meta.dir, "../../../../.."),
				env: {
					...process.env,
					PHALA_CLOUD_API_KEY: "test-key",
					PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}/api/v1`,
					PHALA_DISABLE_UPDATE_CHECK: "1",
					PHALA_CLOUD_DIR: dir,
				},
				stdin: "ignore",
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const [code, stdout, stderr] = await Promise.all([
			child.exited,
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
		]);
		expect(code, `${stdout}\n${stderr}`).toBe(0);
		if (json)
			expect(JSON.parse(stdout)).toEqual({ success: true, ...NO_CHANGE });
		else expect(stdout).toContain(NO_CHANGE.message);
		expect(`${stdout}\n${stderr}`).not.toContain(
			"did not return an operation ID",
		);
		expect(requests).toEqual([`GET ${CVM_PATH}`, `PATCH ${CVM_PATH}/envs`]);
	},
);

describe("envsUpdateCommandSchema", () => {
	test("validates with env inputs", () => {
		const result = envsUpdateCommandSchema.safeParse({
			env: ["NODE_ENV=production"],
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.env).toEqual(["NODE_ENV=production"]);
		}
	});

	test("validates with encryptedEnv", () => {
		const result = envsUpdateCommandSchema.safeParse({
			encryptedEnv: "deadbeef1234",
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.encryptedEnv).toBe("deadbeef1234");
		}
	});

	test("validates with neither env nor encryptedEnv (handler validates)", () => {
		const result = envsUpdateCommandSchema.safeParse({});

		expect(result.success).toBe(true);
	});

	test("validates with both env and encryptedEnv (handler validates mutual exclusion)", () => {
		const result = envsUpdateCommandSchema.safeParse({
			env: ["A=1"],
			encryptedEnv: "deadbeef",
		});

		// Schema allows both; the handler does the mutual exclusion check
		expect(result.success).toBe(true);
	});

	test("accepts optional privateKey", () => {
		const result = envsUpdateCommandSchema.safeParse({
			env: ["A=1"],
			privateKey: "0xdeadbeef",
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.privateKey).toBe("0xdeadbeef");
		}
	});

	test("accepts optional rpcUrl", () => {
		const result = envsUpdateCommandSchema.safeParse({
			env: ["A=1"],
			rpcUrl: "https://rpc.example.com",
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.rpcUrl).toBe("https://rpc.example.com");
		}
	});

	test("defaults interactive to false", () => {
		const result = envsUpdateCommandSchema.safeParse({
			env: ["A=1"],
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.interactive).toBe(false);
		}
	});

	test("accepts cvmId", () => {
		const result = envsUpdateCommandSchema.safeParse({
			env: ["A=1"],
			cvmId: "my-cvm",
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.cvmId).toBe("my-cvm");
		}
	});
});
