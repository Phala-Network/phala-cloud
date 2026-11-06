/**
 * Wire contract of `phala deploy` (create) against POST /cvms.
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
// the real SDK client (see update.test.ts).
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

const COMPOSE = "services:\n  app:\n    image: nginx\n";
const APP_COMPOSE = JSON.stringify({
	name: "raw",
	docker_compose_file: COMPOSE,
	secure_time: true,
});
const LAUNCH_TOKEN = "t".repeat(32);

const CREATED_CVM = {
	id: "cvm_1",
	user_id: null,
	name: "my-app",
	status: "creating",
	teepod_id: 1,
	teepod: null,
	app_id: "abc",
	vm_uuid: "0123456789abcdef0123456789abcdef",
	instance_id: null,
	base_image: "dstack-0.6.3",
	vcpu: 1,
	memory: 2048,
	disk_size: 20,
	docker_compose_file: COMPOSE,
	created_at: "2026-11-06T00:00:00Z",
};

let server: ReturnType<typeof Bun.serve>;
let requests: Recorded[] = [];
let tmpDir: string;
let composePath: string;
let appComposePath: string;
let stdout = "";

beforeAll(async () => {
	server = Bun.serve({
		port: 0,
		async fetch(req) {
			const url = new URL(req.url);
			const text = await req.text();
			const body = text ? JSON.parse(text) : undefined;
			requests.push({ method: req.method, path: url.pathname, body });
			if (req.method === "POST" && url.pathname === "/api/v1/cvms") {
				// Commit carries the prepare token; prepare does not.
				return body?.token
					? Response.json({ ...CREATED_CVM, launch_token: LAUNCH_TOKEN })
					: Response.json({
							app_id: "abc",
							app_env_encrypt_pubkey: "11".repeat(32),
							compose_hash: "hash-1",
							token: "prepare-token",
						});
			}
			return Response.json({ detail: "unexpected" }, { status: 404 });
		},
	});
	tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "phala-deploy-create-"));
	composePath = path.join(tmpDir, "docker-compose.yml");
	appComposePath = path.join(tmpDir, "app-compose.json");
	await fs.writeFile(composePath, COMPOSE);
	await fs.writeFile(appComposePath, APP_COMPOSE);
});

afterAll(async () => {
	server.stop(true);
	await fs.remove(tmpDir);
});

afterEach(() => {
	requests = [];
	stdout = "";
});

async function deploy(input: Record<string, unknown>) {
	let failure: unknown;
	const context = {
		env: {
			PHALA_CLOUD_API_KEY: "test-key",
			PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}/api/v1`,
			PHALA_CLOUD_DIR: tmpDir,
		},
		projectConfig: {},
		cvmId: undefined,
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
	const exitCode = await runDeploy(
		// --no-dev-os keeps a local ~/.ssh key out of the request.
		{ name: "my-app", json: true, devOs: false, ...input } as Parameters<
			typeof runDeploy
		>[0],
		context,
	);
	return { exitCode, failure };
}

function prepareRequest(): Recorded {
	const prepare = requests.filter(
		(r) => r.method === "POST" && r.path === "/api/v1/cvms" && !r.body?.token,
	);
	expect(prepare).toHaveLength(1);
	return prepare[0] as Recorded;
}

describe("phala deploy (create)", () => {
	test("sends runner, init scripts, launch token and compose fields", async () => {
		const { exitCode, failure } = await deploy({
			compose: composePath,
			runner: "nerdctl-compose",
			initScript: ["docker_cleanup"],
			launchToken: LAUNCH_TOKEN,
			eventLogVersion: "2",
			ephemeralDataDisk: true,
			gateway: false,
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		const body = prepareRequest().body as Record<string, unknown>;
		expect(body.compose_file).toEqual({
			name: "",
			docker_compose_file: COMPOSE,
			runner: "nerdctl-compose",
			allowed_envs: [],
			public_logs: true,
			public_sysinfo: true,
			public_tcbinfo: true,
			secure_time: false,
			gateway_enabled: false,
			event_log_version: 2,
			requirements: { ephemeral_data_disk: true },
		});
		expect(body.init_scripts).toEqual(["docker_cleanup"]);
		expect(body.launch_token).toBe(LAUNCH_TOKEN);
	});

	test("sends the --compose file as bash_script for the bash runner", async () => {
		const { exitCode } = await deploy({ compose: composePath, runner: "bash" });

		expect(exitCode).toBe(0);
		const composeFile = prepareRequest().body?.compose_file as Record<
			string,
			unknown
		>;
		expect(composeFile.runner).toBe("bash");
		expect(composeFile.bash_script).toBe(COMPOSE);
		expect("docker_compose_file" in composeFile).toBe(false);
	});

	test("sends --app-compose as compose_file_raw and prints the issued launch token", async () => {
		const { exitCode, failure } = await deploy({
			appCompose: appComposePath,
			generateLaunchToken: true,
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		const body = prepareRequest().body as Record<string, unknown>;
		expect(body.compose_file_raw).toBe(APP_COMPOSE);
		expect("compose_file" in body).toBe(false);
		expect(body.generate_launch_token).toBe(true);
		const result = JSON.parse(stdout.slice(stdout.indexOf("{")));
		expect(result.launch_token).toBe(LAUNCH_TOKEN);
	});

	test.each([
		[{ compose: "docker-compose.yml" }, "--compose"],
		[{ runner: "bash" }, "--runner"],
		[{ secureTime: true }, "--secure-time"],
		[{ publicLogs: false }, "--public-logs"],
		[{ noPreLaunchScript: true }, "--no-pre-launch-script"],
		[{ gateway: false }, "--gateway"],
	])(
		"rejects compose flag %p with --app-compose before any request",
		async (flags, flag) => {
			const { exitCode, failure } = await deploy({
				appCompose: appComposePath,
				...flags,
			});

			expect(exitCode).toBe(1);
			expect((failure as Error).message).toContain(
				`${flag} cannot be used with --app-compose`,
			);
			expect(requests).toEqual([]);
		},
	);

	test.each([
		[{ confirmDataWipe: true }, "--confirm-data-wipe"],
		[{ launchTokenHash: "a".repeat(64) }, "--launch-token-hash"],
		[{ clearInitScripts: true }, "--clear-init-scripts"],
	])("rejects update-only flag %p on create", async (flags, flag) => {
		const { exitCode, failure } = await deploy({
			compose: composePath,
			...flags,
		});

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain(
			`${flag} only applies to an update`,
		);
		expect(requests).toEqual([]);
	});
});
