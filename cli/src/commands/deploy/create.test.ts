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
import { buildJsonCliError, normalizeCliError } from "@/src/utils/logger";
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
const { recallDevOsMode } = await import("./dev-os-selection");

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

const OS_IMAGES = {
	items: [
		{
			name: "dstack-0.6.0",
			slug: "dstack-0.6.0",
			version: "0.6.0",
			os_image_hash: "aa".repeat(32),
			is_dev: false,
			requires_gpu: false,
		},
		{
			name: "prod-0.5.7",
			slug: "dstack-0.5.7",
			version: "0.5.7",
			os_image_hash: "bb".repeat(32),
			is_dev: false,
			requires_gpu: false,
		},
		{
			name: "dev-0.5.7",
			slug: "dstack-dev-0.5.7",
			version: "0.5.7",
			os_image_hash: "cc".repeat(32),
			is_dev: true,
			requires_gpu: false,
		},
		{
			// A release with no dev variant at all.
			name: "prod-0.5.4",
			slug: "dstack-0.5.4",
			version: "0.5.4",
			os_image_hash: "dd".repeat(32),
			is_dev: false,
			requires_gpu: false,
		},
	],
	total: 2,
	page: 1,
	page_size: 100,
	pages: 1,
};

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
let previousCloudDir: string | undefined;
let appComposePath: string;
let stdout = "";
// Per-test response for GET requests (CVM info, operations); defaults to 404.
let respondGet: ((path: string) => Response) | undefined;

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
			if (req.method === "GET" && url.pathname === "/api/v1/os-images") {
				return Response.json(OS_IMAGES);
			}
			if (req.method === "GET" && respondGet) return respondGet(url.pathname);
			return Response.json({ detail: "unexpected" }, { status: 404 });
		},
	});
	tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "phala-deploy-create-"));
	// `--dev-os` creates record their choice in the CLI state file; keep the
	// developer's real one out of these tests.
	previousCloudDir = process.env.PHALA_CLOUD_DIR;
	process.env.PHALA_CLOUD_DIR = tmpDir;
	composePath = path.join(tmpDir, "docker-compose.yml");
	appComposePath = path.join(tmpDir, "app-compose.json");
	await fs.writeFile(composePath, COMPOSE);
	await fs.writeFile(appComposePath, APP_COMPOSE);
});

afterAll(async () => {
	if (previousCloudDir === undefined) {
		process.env.PHALA_CLOUD_DIR = undefined;
	} else {
		process.env.PHALA_CLOUD_DIR = previousCloudDir;
	}
	server.stop(true);
	await fs.remove(tmpDir);
});

afterEach(() => {
	requests = [];
	stdout = "";
	respondGet = undefined;
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

	test("sends --init-script file contents as compose_file.init_script in order", async () => {
		const first = path.join(tmpDir, "init-a.sh");
		const second = path.join(tmpDir, "init-b.sh");
		await fs.writeFile(first, "echo first\n");
		await fs.writeFile(second, "echo second\n");

		const { exitCode, failure } = await deploy({
			compose: composePath,
			initScript: [first, second],
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		const body = prepareRequest().body as Record<string, unknown>;
		const composeFile = body.compose_file as Record<string, unknown>;
		expect(composeFile.init_script).toEqual(["echo first\n", "echo second\n"]);
		expect("init_scripts" in body).toBe(false);
	});

	test("omits compose_file.init_script when --init-script is not passed", async () => {
		const { exitCode } = await deploy({ compose: composePath });

		expect(exitCode).toBe(0);
		const body = prepareRequest().body as Record<string, unknown>;
		const composeFile = body.compose_file as Record<string, unknown>;
		expect("init_script" in composeFile).toBe(false);
		expect("init_scripts" in body).toBe(false);
	});

	test("rejects a non-slug --init-script that is not a file before any request", async () => {
		const { exitCode, failure } = await deploy({
			compose: composePath,
			initScript: ["not-a-slug-or-file"],
		});

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain(
			"not a known init script slug",
		);
		expect((failure as Error).message).toContain("no such file");
		expect(requests).toEqual([]);
	});

	test("rejects a mistyped slug on create before mix or file checks", async () => {
		const { exitCode, failure } = await deploy({
			compose: composePath,
			initScript: ["docker_cleanup", "docker_clenaup"],
		});

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain(
			"not a known init script slug",
		);
		expect((failure as Error).message).toContain("docker_cleanup, env_merge");
		expect((failure as Error).message).toContain("no such file");
		expect((failure as Error).message).not.toContain("not both");
		expect(requests).toEqual([]);
	});

	test("rejects mixing init script slugs and files before any request", async () => {
		const script = path.join(tmpDir, "init-mix.sh");
		await fs.writeFile(script, "echo mix\n");
		const { exitCode, failure } = await deploy({
			compose: composePath,
			initScript: ["docker_cleanup", script],
		});

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain("not both");
		expect(requests).toEqual([]);
	});

	test("rejects more than 5 init script files before any request", async () => {
		const files: string[] = [];
		for (const name of ["a", "b", "c", "d", "e", "f"]) {
			const filePath = path.join(tmpDir, `init-${name}.sh`);
			await fs.writeFile(filePath, `echo ${name}\n`);
			files.push(filePath);
		}
		const { exitCode, failure } = await deploy({
			compose: composePath,
			initScript: files,
		});

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain("at most 5");
		expect(requests).toEqual([]);
	});

	test("--json writes exactly one JSON object to stdout", async () => {
		const { exitCode, failure } = await deploy({ compose: composePath });

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		// Throws unless stdout holds a single JSON value and nothing else.
		expect(JSON.parse(stdout)).toMatchObject({
			success: true,
			vm_uuid: CREATED_CVM.vm_uuid,
		});
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

	test("injects the dev-box service when --dev-os targets dstack 0.6+", async () => {
		const pubkeyPath = path.join(tmpDir, "id_ed25519.pub");
		await fs.writeFile(pubkeyPath, "ssh-ed25519 AAAA test@example\n");

		const { exitCode, failure } = await deploy({
			compose: composePath,
			devOs: true,
			image: "dstack-0.6.0",
			sshPubkey: pubkeyPath,
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		const body = prepareRequest().body as Record<string, unknown>;
		const composeFile = body.compose_file as Record<string, unknown>;
		const compose = composeFile.docker_compose_file as string;
		expect(compose).toContain(`${COMPOSE}  dev-box:`);
		expect(compose).toContain(
			"- SSH_AUTHORIZED_KEYS=${DSTACK_AUTHORIZED_KEYS}",
		);
		expect(compose).toContain("volumes:\n  ssh-host-keys:\n  home:");
		// The dev box reads the key through the env var, which must be allowed.
		expect(composeFile.allowed_envs).toEqual(["DSTACK_AUTHORIZED_KEYS"]);
		expect(body.prefer_dev).toBe(false);
	});

	test("refuses --dev-os when the compose only carries the markers", async () => {
		const markedPath = path.join(tmpDir, "marked-compose.yml");
		await fs.writeFile(
			markedPath,
			`services:
  app:
    image: nginx
    privileged: true
    pid: host
    network_mode: host
    uts: host
`,
		);

		const { exitCode, failure } = await deploy({
			compose: markedPath,
			devOs: true,
			image: "dstack-0.6.0",
		});

		// An explicit --dev-os asks for a usable dev box: a service that only
		// carries the markers is reported, never accepted as if SSH were there.
		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain(
			"which Phala Cloud reads as the dev box",
		);
		expect(requests.some((request) => request.method === "POST")).toBe(false);
	});

	test("does not inject a local key into a 0.6 dev box", async () => {
		const { exitCode, failure } = await deploy({
			compose: composePath,
			devOs: true,
			image: "dstack-0.6.0",
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		const body = prepareRequest().body as Record<string, unknown>;
		const composeFile = body.compose_file as Record<string, unknown>;
		// Keys travel through user_config: the backend authorizes every account
		// key when the request carries no ssh_key_ids.
		expect(composeFile.allowed_envs).toEqual([]);
		expect("ssh_key_ids" in body).toBe(false);
	});

	test("records the dev OS choice so a later update keeps the dev box", async () => {
		const pubkeyPath = path.join(tmpDir, "id_ed25519.pub");
		await fs.writeFile(pubkeyPath, "ssh-ed25519 AAAA test@example\n");

		const { exitCode, failure } = await deploy({
			compose: composePath,
			devOs: true,
			image: "dstack-0.6.0",
			sshPubkey: pubkeyPath,
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		// Keyed by the server's vm_uuid, and the compose file on disk is
		// untouched: the record is what an update has to work from.
		expect(recallDevOsMode(CREATED_CVM.vm_uuid)).toBe("dev-box");
		expect(await fs.readFile(composePath, "utf8")).toBe(COMPOSE);
	});

	test("requires a pinned image for --dev-os", async () => {
		const { exitCode, failure } = await deploy({
			compose: composePath,
			devOs: true,
		});

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain(
			"--dev-os needs an explicit OS image",
		);
		expect(requests).toEqual([]);
	});

	test("rejects an OS image that is not in the catalog", async () => {
		const { exitCode, failure } = await deploy({
			compose: composePath,
			devOs: true,
			image: "my-custom-image",
		});

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain(
			"is not in the OS image catalog",
		);
	});

	test("deploys the dev image for --dev-os below dstack 0.6", async () => {
		const pubkeyPath = path.join(tmpDir, "legacy_dev.pub");
		await fs.writeFile(pubkeyPath, "ssh-ed25519 AAAA legacy@example\n");

		const { exitCode, failure } = await deploy({
			compose: composePath,
			devOs: true,
			image: "dstack-0.5.7",
			sshPubkey: pubkeyPath,
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		const body = prepareRequest().body as Record<string, unknown>;
		// The backend ignores prefer_dev when the request names an image, so
		// sending the production slug would deploy a CVM with no sshd.
		expect(body.image).toBe("dstack-dev-0.5.7");
		expect(body.prefer_dev).toBe(true);
		const composeFile = body.compose_file as Record<string, unknown>;
		expect(composeFile.docker_compose_file).toBe(COMPOSE);
	});

	test("refuses a pre-0.6 production image with no dev variant", async () => {
		const { exitCode, failure } = await deploy({
			compose: composePath,
			devOs: true,
			image: "dstack-0.5.4",
		});

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain('no dev variant of "0.5.4"');
	});

	test("leaves the compose alone with --no-dev-os", async () => {
		const { exitCode } = await deploy({ compose: composePath, devOs: false });

		expect(exitCode).toBe(0);
		const composeFile = prepareRequest().body?.compose_file as Record<
			string,
			unknown
		>;
		expect(composeFile.docker_compose_file).toBe(COMPOSE);
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
	describe("--wait", () => {
		const INFO_PATH = `/api/v1/cvms/${CREATED_CVM.vm_uuid}`;
		const OPERATIONS_PATH = `${INFO_PATH}/operations`;

		const cvmInfo = (
			status: string,
			inProgress: boolean,
			correlationId?: string,
		) =>
			Response.json({
				id: "cvm_1",
				vm_uuid: CREATED_CVM.vm_uuid,
				name: "my-app",
				app_id: "abc",
				status,
				in_progress: inProgress,
				progress: correlationId
					? { target: "starting", correlation_id: correlationId }
					: null,
				resource: {},
				gateway: {},
			});

		const operation = (status: string, errorMessage?: string) =>
			Response.json({
				items: [
					{ correlation_id: "corr-1", status, error_message: errorMessage },
				],
				next_cursor: null,
				total: 1,
			});

		test("waits for the create operation and for the CVM to run", async () => {
			const states: Array<[string, boolean]> = [
				["starting", true],
				["running", false],
			];
			let infoReads = 0;
			respondGet = (path) => {
				if (path === OPERATIONS_PATH) return operation("completed");
				const [status, inProgress] =
					states[Math.min(infoReads++, states.length - 1)] ?? states[0] ?? [];
				return cvmInfo(status as string, inProgress as boolean, "corr-1");
			};

			const { exitCode, failure } = await deploy({
				compose: composePath,
				wait: true,
			});

			expect(failure).toBeUndefined();
			expect(exitCode).toBe(0);
			const operations = requests.filter((r) => r.path === OPERATIONS_PATH);
			expect(operations).toHaveLength(1);
			expect(infoReads).toBeGreaterThanOrEqual(2);
			// stdout stays one JSON object with the same fields as without --wait.
			expect(Object.keys(JSON.parse(stdout))).toEqual([
				"success",
				"vm_uuid",
				"name",
				"app_id",
				"dashboard_url",
				"launch_token",
			]);
		}, 15000);

		test("fails with the operation error when the create operation fails", async () => {
			respondGet = (path) =>
				path === OPERATIONS_PATH
					? operation("failed", "app-compose.service failed")
					: cvmInfo("starting", true, "corr-1");

			const startedAt = Date.now();
			const { exitCode, failure } = await deploy({
				compose: composePath,
				wait: true,
			});

			expect(exitCode).not.toBe(0);
			// What the user sees: the JSON error envelope the dispatcher prints.
			const envelope = buildJsonCliError(normalizeCliError(failure));
			expect(envelope.error).toBe(
				`The CVM ${CREATED_CVM.vm_uuid} was created but did not start: Create failed: app-compose.service failed`,
			);
			// The token is printed on success only; an error reaches CI logs.
			expect(JSON.stringify(envelope)).not.toContain(LAUNCH_TOKEN);
			expect(Date.now() - startedAt).toBeLessThan(5000);
			expect(stdout).toBe("");
		}, 15000);

		test("fails fast when the CVM ends in error without an operation to follow", async () => {
			respondGet = () => cvmInfo("error", false);

			const startedAt = Date.now();
			const { exitCode, failure } = await deploy({
				compose: composePath,
				wait: true,
			});

			expect(exitCode).not.toBe(0);
			expect(String(failure)).toContain("CVM is in error state");
			expect(Date.now() - startedAt).toBeLessThan(5000);
			expect(stdout).toBe("");
		}, 15000);

		test("without --wait returns without reading the CVM", async () => {
			const { exitCode } = await deploy({ compose: composePath });

			expect(exitCode).toBe(0);
			expect(requests.filter((r) => r.method === "GET")).toEqual([]);
		});
	});
});
