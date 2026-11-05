/**
 * Wire contract of `phala deploy --cvm-id` against PATCH /cvms/{id}.
 *
 * Runs the real deploy handler and SDK client against a local HTTP server
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
const { runDeploy } = await import("./handler");

type Recorded = {
	method: string;
	path: string;
	body: Record<string, unknown> | undefined;
};

const CVM_ID = "0123456789abcdef0123456789abcdef";
const COMPOSE = "services:\n  app:\n    image: nginx\n";

let server: ReturnType<typeof Bun.serve>;
let requests: Recorded[] = [];
// Per-test response override; return undefined to fall through to defaults.
let respond:
	| ((method: string, path: string) => Response | undefined)
	| undefined;

const HASH_REQUIRED = {
	error_code: "ERR-01-005",
	message: "Compose hash registration required",
	details: [
		{ field: "compose_hash", value: "abc123" },
		{ field: "app_id", value: "abc" },
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
		{ field: "commit_token", value: "token-1" },
	],
};
let tmpDir: string;
let composePath: string;

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
					app_id: "abc",
					status: "running",
					resource: {},
					gateway: {},
				});
			}
			if (url.pathname.endsWith("/listed")) {
				return Response.json({ id: CVM_ID, name: "my-app" });
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
	tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "phala-deploy-update-"));
	composePath = path.join(tmpDir, "docker-compose.yml");
	await fs.writeFile(composePath, COMPOSE);
});

afterAll(async () => {
	server.stop(true);
	await fs.remove(tmpDir);
});

afterEach(() => {
	requests = [];
	respond = undefined;
});

function makeContext(): {
	context: CommandContext;
	failure: () => unknown;
} {
	let failure: unknown;
	const context = {
		env: {
			PHALA_CLOUD_API_KEY: "test-key",
			PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}/api/v1`,
			PHALA_CLOUD_DIR: tmpDir,
		},
		projectConfig: {},
		cvmId: { id: CVM_ID },
		stdout: { write: () => true },
		stderr: { write: () => true },
		failWithError: (error: unknown) => {
			failure = error;
		},
	} as unknown as CommandContext;
	return { context, failure: () => failure };
}

async function deploy(input: Record<string, unknown>) {
	const { context, failure } = makeContext();
	const exitCode = await runDeploy(
		{ compose: composePath, json: true, ...input } as Parameters<
			typeof runDeploy
		>[0],
		context,
	);
	return { exitCode, failure: failure() };
}

function updateRequest(): Recorded {
	const patches = requests.filter(
		(r) => r.method === "PATCH" && r.path === `/api/v1/cvms/${CVM_ID}`,
	);
	expect(patches).toHaveLength(1);
	return patches[0] as Recorded;
}

describe("phala deploy --cvm-id", () => {
	test("sends resource, image and tcbinfo flags in the update", async () => {
		const { exitCode, failure } = await deploy({
			instanceType: "tdx.medium",
			vcpu: "4",
			memory: "8G",
			diskSize: "100G",
			image: "dstack-0.5.5",
			publicTcbinfo: false,
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(updateRequest().body).toEqual({
			docker_compose_file: COMPOSE,
			public_tcbinfo: false,
			instance_type: "tdx.medium",
			vcpu: 4,
			memory: 8192,
			disk_size: 100,
			image: "dstack-0.5.5",
		});
	});

	test("sends compose flags as a merge patch, with init scripts and the data-wipe confirmation", async () => {
		const { exitCode, failure } = await deploy({
			secureTime: true,
			gateway: false,
			eventLogVersion: "2",
			ephemeralDataDisk: true,
			initScript: ["docker_cleanup"],
			confirmDataWipe: true,
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(updateRequest().body).toEqual({
			docker_compose_file: COMPOSE,
			compose: {
				secure_time: true,
				gateway_enabled: false,
				event_log_version: 2,
				requirements: { ephemeral_data_disk: true },
			},
			init_scripts: ["docker_cleanup"],
			confirm_data_wipe: true,
		});
	});

	test.each(["1536", "1.5G"])(
		"sends --memory %p as 1536 MB and leaves the spec to the backend",
		async (memory) => {
			const { exitCode, failure } = await deploy({ memory });

			expect(failure).toBeUndefined();
			expect(exitCode).toBe(0);
			expect(updateRequest().body?.memory).toBe(1536);
		},
	);

	test("sets the Trust Center listing after the update is accepted", async () => {
		const { exitCode, failure } = await deploy({ listed: true });

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(
			requests.filter((r) => r.method === "PATCH").map((r) => [r.path, r.body]),
		).toEqual([
			[`/api/v1/cvms/${CVM_ID}`, { docker_compose_file: COMPOSE }],
			[`/api/v1/cvms/${CVM_ID}/listed`, { listed: true }],
		]);
	});

	test("leaves the listing alone when the update is rejected", async () => {
		respond = (method, p) =>
			method === "PATCH" && p === `/api/v1/cvms/${CVM_ID}`
				? Response.json(
						{ detail: "Another operation is already in progress" },
						{ status: 409 },
					)
				: undefined;
		const { exitCode } = await deploy({ listed: true });

		expect(exitCode).toBe(1);
		expect(requests.some((r) => r.path.endsWith("/listed"))).toBe(false);
	});

	test("says the update was applied when only the listing fails", async () => {
		respond = (_method, p) =>
			p.endsWith("/listed")
				? Response.json({ detail: "Forbidden" }, { status: 403 })
				: undefined;
		const { exitCode, failure } = await deploy({ listed: false });

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain(
			"The CVM update was already applied, but setting the Trust Center listing failed",
		);
	});

	test("does not set the listing for --prepare-only", async () => {
		respond = (method, p) =>
			method === "PATCH" && p === `/api/v1/cvms/${CVM_ID}`
				? Response.json(HASH_REQUIRED, { status: 465 })
				: undefined;
		const { exitCode, failure } = await deploy({
			listed: true,
			prepareOnly: true,
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(requests.some((r) => r.path.endsWith("/listed"))).toBe(false);
	});

	test("sets the listing after --commit succeeds", async () => {
		const { exitCode, failure } = await deploy({
			commit: true,
			token: "token-1",
			composeHash: "abc123",
			transactionHash: "0xtx",
			listed: true,
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(requests.map((r) => [r.method, r.path])).toEqual([
			["POST", `/api/v1/cvms/${CVM_ID}/commit-update`],
			["PATCH", `/api/v1/cvms/${CVM_ID}/listed`],
		]);
	});

	test.each([
		[{ name: "my-app" }, "--name"],
		[{ region: "us-west" }, "--region"],
		[{ node: "usw5" }, "--node"],
		[{ customAppId: "abc" }, "--custom-app-id"],
		[{ nonce: "1" }, "--nonce"],
		[{ keyProviderMode: "local" }, "--key-provider-mode"],
		[{ devOs: true }, "--dev-os"],
		[{ devOs: false }, "--dev-os"],
		[{ sshPubkey: "~/.ssh/id_ed25519.pub" }, "--ssh-pubkey"],
		[{ fs: "ext4" }, "--fs"],
		[{ skipGateway: true }, "--skip-gateway"],
		[{ kms: "base" }, "--kms"],
		[{ kmsId: "kms-1" }, "--kms-id"],
		[{ kmsContract: "0xabc" }, "--kms-contract"],
		[{ kmsContractId: "contract_1" }, "--kms-contract-id"],
		[
			{ experimentalKeyProviderType: "tpm" },
			"--experimental-key-provider-type",
		],
		[{ runner: "bash" }, "--runner"],
		[{ appCompose: "app-compose.json" }, "--app-compose"],
		[{ launchToken: "t".repeat(32) }, "--launch-token"],
		[{ generateLaunchToken: true }, "--generate-launch-token"],
	])("rejects create-only flag %p before any request", async (flags, flag) => {
		const { exitCode, failure } = await deploy(flags);

		expect(exitCode).toBe(1);
		expect(failure).toBeInstanceOf(Error);
		expect((failure as Error).message).toContain(
			`${flag} cannot be changed on an existing CVM`,
		);
		expect(requests).toEqual([]);
	});

	test("rejects create-only flags before reading the compose file", async () => {
		const { exitCode, failure } = await deploy({
			compose: path.join(tmpDir, "missing.yml"),
			name: "my-app",
		});

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain(
			"--name cannot be changed on an existing CVM",
		);
	});

	test("rejects create-only flags in --commit mode", async () => {
		const { exitCode, failure } = await deploy({
			commit: true,
			token: "token-1",
			fs: "ext4",
		});

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain(
			"--fs cannot be changed on an existing CVM",
		);
		expect(requests).toEqual([]);
	});
});
