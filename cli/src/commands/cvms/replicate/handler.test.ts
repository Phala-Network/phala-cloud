import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SOURCE = "0123456789abcdef0123456789abcdef";
const REPLICA = "fedcba9876543210fedcba9876543210";
const OPERATION = "replica-operation-exact";
const vm = {
	id: "cvm-replica",
	name: "replica",
	status: "starting",
	app_id: "a".repeat(40),
	vm_uuid: REPLICA,
	instance_id: null,
	teepod_id: 1,
	teepod: { id: 1, name: "node" },
	vcpu: 2,
	memory: 4096,
	disk_size: 20,
	created_at: "2026-11-23T00:00:00Z",
	encrypted_env_pubkey: null,
	finality_wait: {
		operation: "create",
		correlation_id: OPERATION,
		phase: "awaiting_finality",
		stage: "safe",
		transaction: null,
		finality: {
			block_tag: "finalized",
			policy_block_number: 100,
			blocks_remaining: null,
			eta_seconds: null,
		},
	},
};
const dir = mkdtempSync(join(tmpdir(), "phala-replica-"));
let requests: string[] = [];
const server = Bun.serve({
	port: 0,
	fetch(request) {
		const key = `${request.method} ${new URL(request.url).pathname}`;
		requests.push(key);
		if (key === `GET /api/v1/cvms/${SOURCE}`) {
			return Response.json({
				id: "cvm-source",
				name: "source",
				vm_uuid: SOURCE,
				status: "running",
				kms_type: "base",
				resource: { memory_in_mb: 4096 },
				gateway: {},
			});
		}
		if (key === `POST /api/v1/cvms/${SOURCE}/replicas`)
			return Response.json(vm);
		return new Response("Unexpected request", { status: 500 });
	},
});

afterAll(() => {
	server.stop(true);
	rmSync(dir, { recursive: true, force: true });
});

test.each([false, true])(
	"preserves HTTP 200 replica acceptance (JSON: %s)",
	async (json) => {
		requests = [];
		const child = Bun.spawn(
			[
				process.execPath,
				"cli/src/index.ts",
				"cvms",
				"replicate",
				SOURCE,
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
		if (json) {
			expect(JSON.parse(stdout)).toEqual({ success: true, ...vm });
		} else {
			expect(stdout).toContain(`Status:          ${vm.status}`);
			expect(stdout).toContain("On-chain stage: safe.");
			expect(stdout).toContain(
				`/cvms/${REPLICA}/operations?correlation_id=${OPERATION}`,
			);
		}
		expect(requests).toEqual([
			`GET /api/v1/cvms/${SOURCE}`,
			`POST /api/v1/cvms/${SOURCE}/replicas`,
		]);
	},
);
