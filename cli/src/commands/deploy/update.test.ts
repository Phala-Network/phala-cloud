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
const { forgetDevOsMode, recallDevOsMode, rememberDevOsMode } = await import(
	"./dev-os-selection"
);
const { deployCommand } = await import("./index");
const { dispatchCommand } = await import("@/src/core/dispatcher");
const { CommandRegistry } = await import("@/src/core/registry");

type Recorded = {
	method: string;
	path: string;
	search: string;
	authorization: string | null;
	body: Record<string, unknown> | undefined;
};

// The identifier the user passes; the API resolves it to the real vm_uuid.
const CVM_ID = "0123456789abcdef0123456789abcdef";
const VM_UUID = "fedcba9876543210fedcba9876543210";
const COMPOSE = "services:\n  app:\n    image: nginx\n";

let server: ReturnType<typeof Bun.serve>;
let requests: Recorded[] = [];
// Per-test response override; return undefined to fall through to defaults.
let respond:
	| ((
			method: string,
			path: string,
			query: URLSearchParams,
	  ) => Response | undefined)
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
	],
	total: 1,
	page: 1,
	page_size: 100,
	pages: 1,
};

/** The CVM the stub reports; overrides replace individual fields. */
function cvmInfo(overrides: Record<string, unknown> = {}) {
	return {
		id: CVM_ID,
		vm_uuid: VM_UUID,
		name: "my-app",
		app_id: "abc",
		status: "running",
		resource: {},
		gateway: {},
		...overrides,
	};
}

/** A dev box as the backend reads it: the four markers, custom volumes. */
const DEPLOYED_DEV_BOX = `services:
  app:
    image: nginx
  ssh:
    image: ghcr.io/dstack-tee/dstack-dev-box:sha-7725235@sha256:0dc661ea51fcbd70007d117b9e60883d9a96bac510a80683f5bdd6b7947b0291
    privileged: true
    pid: host
    network_mode: host
    uts: host
    volumes:
      - /:/host:rslave
      - keys:/etc/ssh/host-keys
      - root:/root
`;

let tmpDir: string;
let composePath: string;
let previousCloudDir: string | undefined;

beforeAll(async () => {
	server = Bun.serve({
		port: 0,
		async fetch(req) {
			const url = new URL(req.url);
			const text = await req.text();
			requests.push({
				method: req.method,
				path: url.pathname,
				search: url.search,
				authorization: req.headers.get("authorization"),
				body: text ? JSON.parse(text) : undefined,
			});
			const overridden = respond?.(req.method, url.pathname, url.searchParams);
			if (overridden) return overridden;
			if (req.method === "GET" && url.pathname === "/api/v1/os-images") {
				return Response.json(OS_IMAGES);
			}
			if (url.pathname.endsWith("/operations")) {
				return Response.json({
					items: [{ correlation_id: "corr-1", status: "completed" }],
					next_cursor: null,
					total: 1,
				});
			}
			if (req.method === "GET") {
				return Response.json(cvmInfo());
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
	// The credentials file is read from process.env, so keep the developer's
	// stored profile token out of these tests.
	previousCloudDir = process.env.PHALA_CLOUD_DIR;
	process.env.PHALA_CLOUD_DIR = tmpDir;
});

afterAll(async () => {
	if (previousCloudDir === undefined)
		Reflect.deleteProperty(process.env, "PHALA_CLOUD_DIR");
	else process.env.PHALA_CLOUD_DIR = previousCloudDir;
	server.stop(true);
	await fs.remove(tmpDir);
});

afterEach(() => {
	requests = [];
	respond = undefined;
	// The state file lives for the whole file; drop any record a test wrote.
	forgetDevOsMode(VM_UUID);
});

function makeContext(
	auth: Record<string, string>,
	cvmId: { id: string } = { id: CVM_ID },
): {
	context: CommandContext;
	failure: () => unknown;
} {
	let failure: unknown;
	const context = {
		env: {
			...auth,
			PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}/api/v1`,
			PHALA_CLOUD_DIR: tmpDir,
		},
		projectConfig: {},
		cvmId,
		stdout: { write: () => true },
		stderr: { write: () => true },
		failWithError: (error: unknown) => {
			failure = error;
		},
	} as unknown as CommandContext;
	return { context, failure: () => failure };
}

async function deploy(
	input: Record<string, unknown>,
	auth: Record<string, string> = { PHALA_CLOUD_API_KEY: "test-key" },
	cvmId: { id: string } = { id: CVM_ID },
) {
	const { context, failure } = makeContext(auth, cvmId);
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
		(r) => r.method === "PATCH" && /^\/api\/v1\/cvms\/[^/]+$/.test(r.path),
	);
	expect(patches).toHaveLength(1);
	return patches[0] as Recorded;
}

/** Run `phala <argv>` through the real argument parser and dispatcher. */
async function runCli(argv: string[]) {
	const registry = new CommandRegistry();
	registry.registerCommand(deployCommand);
	let stdout = "";
	let stderr = "";
	const output = (append: (chunk: string) => void) =>
		({
			write: (chunk: string) => {
				append(chunk);
				return true;
			},
			isTTY: false,
		}) as unknown as NodeJS.WriteStream;
	const code = await dispatchCommand({
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
		stdout: output((chunk) => {
			stdout += chunk;
		}),
		stderr: output((chunk) => {
			stderr += chunk;
		}),
		stdin: process.stdin,
	});
	return { code, stdout, stderr };
}

describe("phala deploy --help", () => {
	test("says what --wait does on a create and on an update", async () => {
		const { code, stdout } = await runCli(["deploy", "--help"]);

		expect(code).toBe(0);
		const wait = stdout.split("\n").find((line) => line.includes("--wait "));
		expect(wait).toContain("New CVM: wait until it is running");
		expect(wait).toContain(
			"stays stopped if it was not running before the update",
		);
	});

	test("describes --init-script as slugs only", async () => {
		const { code, stdout } = await runCli(["deploy", "--help"]);

		expect(code).toBe(0);
		const option = stdout
			.split("\n")
			.find(
				(line) =>
					line.includes("--init-script") && line.includes("docker_cleanup"),
			);
		expect(option).toBeDefined();
		expect(option).not.toMatch(/file/i);
		expect(option).not.toMatch(/admin/i);
	});
});

describe("phala deploy --cvm-id --clear-init-scripts (parsed argv)", () => {
	test("sends an empty init_scripts set", async () => {
		const { code } = await runCli([
			"deploy",
			"--cvm-id",
			CVM_ID,
			"-c",
			composePath,
			"--clear-init-scripts",
		]);

		expect(code).toBe(0);
		expect(updateRequest().body).toEqual({
			docker_compose_file: COMPOSE,
			init_scripts: [],
		});
	});

	test("rejects --clear-init-scripts with --init-script before any request", async () => {
		const { code, stderr } = await runCli([
			"deploy",
			"--cvm-id",
			CVM_ID,
			"-c",
			composePath,
			"--clear-init-scripts",
			"--init-script",
			"docker_cleanup",
		]);

		expect(code).toBe(1);
		expect(stderr).toContain(
			"--clear-init-scripts cannot be combined with --init-script",
		);
		expect(requests).toEqual([]);
	});
});

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

	test("adds the dev box recorded at create when the update passes no --dev-os", async () => {
		// What `phala deploy --dev-os --image dstack-0.6.0` recorded: the server's
		// vm_uuid, which a create and an update can both agree on.
		rememberDevOsMode(VM_UUID, "dev-box");

		const { exitCode, failure } = await deploy({});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		const compose = updateRequest().body?.docker_compose_file as string;
		expect(compose).toContain("dev-box:");
		expect(compose).toContain(
			"image: ghcr.io/dstack-tee/dstack-dev-box:sha-7725235@sha256:0dc661ea51fcbd70007d117b9e60883d9a96bac510a80683f5bdd6b7947b0291",
		);
	});

	test("finds the record when the update names the CVM by app id", async () => {
		// The record is keyed by vm_uuid; `app_<40hex>` is the same CVM under a
		// different spelling, and only the server can say so.
		rememberDevOsMode(VM_UUID, "dev-box");

		const { exitCode, failure } = await deploy({}, undefined, {
			id: `app_${CVM_ID}`,
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(updateRequest().body?.docker_compose_file).toContain("dev-box:");
		expect(recallDevOsMode(VM_UUID)).toBe("dev-box");
	});

	test("finds the record when the update names the CVM by dashed UUID", async () => {
		rememberDevOsMode(VM_UUID, "dev-box");

		const { exitCode, failure } = await deploy({}, undefined, {
			id: "01234567-89ab-cdef-0123-456789abcdef",
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(updateRequest().body?.docker_compose_file).toContain("dev-box:");
		expect(recallDevOsMode(VM_UUID)).toBe("dev-box");
	});

	test("records the choice an update makes with an explicit --dev-os", async () => {
		const first = await deploy({ devOs: true, image: "dstack-0.6.0" });

		expect(first.failure).toBeUndefined();
		expect(first.exitCode).toBe(0);
		expect(updateRequest().body?.docker_compose_file).toContain("dev-box:");
		expect(recallDevOsMode(VM_UUID)).toBe("dev-box");

		// The next update, without the flag, keeps the dev box.
		requests = [];
		const second = await deploy({});

		expect(second.exitCode).toBe(0);
		expect(updateRequest().body?.docker_compose_file).toContain("dev-box:");
	});

	test("a failed update neither writes nor drops the record", async () => {
		rememberDevOsMode(VM_UUID, "dev-box");
		respond = (method, urlPath) =>
			method === "PATCH" && /^\/api\/v1\/cvms\/[^/]+$/.test(urlPath)
				? Response.json({ detail: "boom" }, { status: 500 })
				: undefined;

		const { exitCode } = await deploy({ devOs: false });

		expect(exitCode).toBe(1);
		// --no-dev-os would have cleared it; the update never landed.
		expect(recallDevOsMode(VM_UUID)).toBe("dev-box");
	});

	test("a failed update does not record an explicit --dev-os", async () => {
		respond = (method, urlPath) =>
			method === "PATCH" && /^\/api\/v1\/cvms\/[^/]+$/.test(urlPath)
				? Response.json({ detail: "boom" }, { status: 500 })
				: undefined;

		const { exitCode } = await deploy({ devOs: true, image: "dstack-0.6.0" });

		expect(exitCode).toBe(1);
		expect(recallDevOsMode(VM_UUID)).toBeUndefined();
	});

	test("--no-dev-os clears the record once the update is applied", async () => {
		rememberDevOsMode(VM_UUID, "dev-box");

		const { exitCode, failure } = await deploy({ devOs: false });

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(updateRequest().body?.docker_compose_file).not.toContain("dev-box:");
		expect(recallDevOsMode(VM_UUID)).toBeUndefined();

		// And it stays gone for the next update.
		requests = [];
		const next = await deploy({});
		expect(next.exitCode).toBe(0);
		expect(updateRequest().body?.docker_compose_file).not.toContain("dev-box:");
	});

	test("keeps a dev box the record does not know about, then records it", async () => {
		// A CVM deployed from another machine, or before the CLI kept a record,
		// still reads as a dev box from the server's compose.
		respond = (method, urlPath) =>
			method === "GET" && /^\/api\/v1\/cvms\/[^/]+$/.test(urlPath)
				? Response.json(
						cvmInfo({
							compose_file: { docker_compose_file: DEPLOYED_DEV_BOX },
						}),
					)
				: undefined;

		expect(recallDevOsMode(VM_UUID)).toBeUndefined();
		const { exitCode, failure } = await deploy({});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(updateRequest().body?.docker_compose_file).toContain("dev-box:");
		expect(recallDevOsMode(VM_UUID)).toBe("dev-box");
	});

	test("refuses an update it cannot decide, instead of dropping SSH", async () => {
		// No compose in the payload, but the server says the CVM has SSH: the CLI
		// must not treat "unknown" as "SSH is off" and send a compose without the
		// dev box.
		respond = (method, urlPath) =>
			method === "GET" && /^\/api\/v1\/cvms\/[^/]+$/.test(urlPath)
				? Response.json(cvmInfo({ enabled_ssh_access: true }))
				: undefined;

		const { exitCode, failure } = await deploy({});

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain(
			"cannot tell whether that comes from a dev box",
		);
		expect(requests.some((request) => request.method === "PATCH")).toBe(false);

		// An explicit choice gets through.
		requests = [];
		const retry = await deploy({ devOs: false });
		expect(retry.exitCode).toBe(0);
		expect(updateRequest().body?.docker_compose_file).toBe(COMPOSE);
	});

	test("keeps a dev box the local compose already carries", async () => {
		// The CVM has a hand-written dev box (custom volume names) and so does the
		// compose on disk: carrying it over must not stack a second box on it.
		const localPath = path.join(tmpDir, "dev-box-compose.yml");
		await fs.writeFile(localPath, DEPLOYED_DEV_BOX);
		respond = (method, urlPath) =>
			method === "GET" && /^\/api\/v1\/cvms\/[^/]+$/.test(urlPath)
				? Response.json(
						cvmInfo({
							compose_file: { docker_compose_file: DEPLOYED_DEV_BOX },
						}),
					)
				: undefined;

		const { exitCode, failure } = await deploy({ compose: localPath });

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(updateRequest().body?.docker_compose_file).toBe(DEPLOYED_DEV_BOX);
		expect(recallDevOsMode(VM_UUID)).toBe("dev-box");
	});

	test("rejects --init-script file paths on update before any request", async () => {
		const { exitCode, failure } = await deploy({
			initScript: [path.join(tmpDir, "init.sh")],
		});

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain("creating a CVM");
		expect(requests).toEqual([]);
	});

	test("rejects a mistyped init script slug on update as unknown slug, not only as a file", async () => {
		const { exitCode, failure } = await deploy({
			initScript: ["docker_clenaup"],
		});

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain(
			"not a known init script slug",
		);
		expect((failure as Error).message).toContain("docker_cleanup, env_merge");
		expect((failure as Error).message).toContain("creating a CVM");
		expect(requests).toEqual([]);
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

	test.each([
		["a".repeat(64), "a".repeat(64)],
		["", null],
	])(
		"sends --launch-token-hash %p as requirements.launch_token_hash",
		async (value, sent) => {
			const { exitCode } = await deploy({
				launchTokenHash: value,
				ephemeralDataDisk: false,
			});

			expect(exitCode).toBe(0);
			expect(updateRequest().body?.compose).toEqual({
				requirements: { ephemeral_data_disk: false, launch_token_hash: sent },
			});
		},
	);

	test.each(["1536", "1.5G"])(
		"sends --memory %p as 1536 MB and leaves the spec to the backend",
		async (memory) => {
			const { exitCode, failure } = await deploy({ memory });

			expect(failure).toBeUndefined();
			expect(exitCode).toBe(0);
			expect(updateRequest().body?.memory).toBe(1536);
		},
	);

	test("--wait succeeds when a stopped CVM stays stopped after the update", async () => {
		respond = (method, path) =>
			method === "GET" && !path.endsWith("/operations")
				? Response.json({
						id: CVM_ID,
						name: "my-app",
						app_id: "abc",
						status: "stopped",
						in_progress: false,
						resource: {},
						gateway: {},
					})
				: undefined;

		const { exitCode, failure } = await deploy({ wait: true });

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
	}, 10000);

	test("--wait succeeds when an update leaves a CVM in error stopped", async () => {
		// The backend keeps the live VM's power state: an error CVM whose VM
		// is down ends the update stopped, never running.
		let reads = 0;
		respond = (method, path) =>
			method === "GET" && !path.endsWith("/operations")
				? Response.json({
						id: CVM_ID,
						name: "my-app",
						app_id: "abc",
						status: reads++ === 0 ? "error" : "stopped",
						in_progress: false,
						resource: {},
						gateway: {},
					})
				: undefined;

		const { exitCode, failure } = await deploy({ wait: true });

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
	}, 10000);

	test("--wait waits for running when the CVM was running before the update", async () => {
		const states = [
			["running", false],
			["updating", true],
			["running", false],
		] as const;
		let reads = 0;
		respond = (method, path) => {
			if (method !== "GET" || path.endsWith("/operations")) return undefined;
			const [status, inProgress] =
				states[Math.min(reads++, states.length - 1)] ?? states[0];
			return Response.json({
				id: CVM_ID,
				name: "my-app",
				app_id: "abc",
				status,
				in_progress: inProgress,
				resource: {},
				gateway: {},
			});
		};

		const { exitCode, failure } = await deploy({ wait: true });

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
	}, 10000);

	test("--wait under GitHub OIDC fails when the update operation failed", async () => {
		// A deploy OIDC token may read one operation, by correlation_id, of its
		// deploy target; listing operations stays refused.
		respond = (_method, path, query) => {
			if (!path.endsWith("/operations")) return undefined;
			if (query.get("correlation_id") === null) {
				return Response.json({ detail: "Not authenticated" }, { status: 401 });
			}
			return Response.json({
				items: [
					{
						correlation_id: "corr-1",
						status: "failed",
						error_message: "Compose update failed: image not found",
					},
				],
				next_cursor: null,
				total: 1,
			});
		};

		const { exitCode, failure } = await deploy(
			{ wait: true },
			{ PHALA_OIDC_TOKEN: "oidc-jwt" },
		);

		expect(exitCode).not.toBe(0);
		expect(String(failure)).toContain("Compose update failed: image not found");
		expect(
			requests
				.filter((r) => r.path.endsWith("/operations"))
				.map((r) => [r.search, r.authorization]),
		).toEqual([["?correlation_id=corr-1", "Bearer oidc-jwt"]]);
	});

	test("--wait fails when the update of a stopped CVM fails", async () => {
		// The failure cleanup also leaves the CVM stopped and not in progress.
		const states = [
			["stopped", false],
			["stopped", true],
			["updating", true],
			["stopped", false],
		] as const;
		let reads = 0;
		respond = (method, path) => {
			if (path.endsWith("/operations")) {
				return Response.json({
					items: [
						{
							correlation_id: "corr-1",
							status: "failed",
							error_message: "Compose update failed: image not found",
						},
					],
					next_cursor: null,
					total: 1,
				});
			}
			if (method !== "GET") return undefined;
			const [status, inProgress] =
				states[Math.min(reads++, states.length - 1)] ?? states[0];
			return Response.json({
				id: CVM_ID,
				name: "my-app",
				app_id: "abc",
				status,
				in_progress: inProgress,
				resource: {},
				gateway: {},
			});
		};

		const { exitCode, failure } = await deploy({ wait: true });

		expect(exitCode).not.toBe(0);
		expect(String(failure)).toContain("Compose update failed: image not found");
	}, 15000);

	test("--wait fails fast with the operation error when a failed update leaves a running CVM stopped", async () => {
		// A boot failure stops the CVM that was running before the update.
		let reads = 0;
		respond = (method, path) => {
			if (path.endsWith("/operations")) {
				return Response.json({
					items: [
						{
							correlation_id: "corr-1",
							status: "failed",
							error_message: "app-compose.service failed",
						},
					],
					next_cursor: null,
					total: 1,
				});
			}
			if (method !== "GET") return undefined;
			return Response.json({
				id: CVM_ID,
				vm_uuid: VM_UUID,
				name: "my-app",
				app_id: "abc",
				status: reads++ === 0 ? "running" : "stopped",
				in_progress: false,
				resource: {},
				gateway: {},
			});
		};

		const { exitCode, failure } = await deploy({ wait: true });

		expect(exitCode).not.toBe(0);
		expect(String(failure)).toContain("app-compose.service failed");
		expect(String(failure)).not.toContain("Timeout");
	}, 15000);

	test("sends the file as compose.bash_script for a bash-runner app", async () => {
		respond = (method) =>
			method === "GET"
				? Response.json({
						id: CVM_ID,
						name: "my-app",
						app_id: "abc",
						status: "running",
						resource: {},
						gateway: {},
						compose_file: { runner: "bash", bash_script: "echo old" },
					})
				: undefined;

		const { exitCode, failure } = await deploy({ secureTime: true });

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(updateRequest().body).toEqual({
			compose: { secure_time: true, bash_script: COMPOSE },
		});
	});

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

/**
 * Run the real `phala` entry point the way phala-deploy-action does: one
 * process, stdout and stderr read together and parsed as one JSON document.
 */
async function runPhalaJson(argv: string[], auth: Record<string, string>) {
	const child = Bun.spawn(
		[process.execPath, path.join(import.meta.dir, "../../index.ts"), ...argv],
		{
			cwd: tmpDir,
			env: {
				PATH: process.env.PATH ?? "",
				HOME: tmpDir,
				PHALA_CLOUD_DIR: tmpDir,
				PHALA_DISABLE_UPDATE_CHECK: "1",
				PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}/api/v1`,
				...auth,
			},
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	// Throws unless the whole output is a single JSON value.
	const output = JSON.parse(stdout + stderr) as Record<string, unknown>;
	return { code, output };
}

const JSON_UPDATE = ["deploy", "--cvm-id", CVM_ID, "--json"];
const OIDC = { PHALA_OIDC_TOKEN: "oidc-jwt" };

describe("phala deploy --cvm-id --json output", () => {
	test("--wait writes only the success object", async () => {
		const { code, output } = await runPhalaJson(
			[...JSON_UPDATE, "-c", composePath, "--wait"],
			OIDC,
		);

		expect(code).toBe(0);
		expect(output).toMatchObject({
			success: true,
			vm_uuid: VM_UUID,
			app_id: "abc",
			name: "my-app",
			dashboard_url: expect.stringContaining(VM_UUID),
		});
		expect(requests.some((r) => r.path.endsWith("/operations"))).toBe(true);
	});

	test("--wait writes only one error object when the update failed", async () => {
		respond = (_method, path) =>
			path.endsWith("/operations")
				? Response.json({
						items: [
							{
								correlation_id: "corr-1",
								status: "failed",
								error_message: "Compose update failed: image not found",
							},
						],
						next_cursor: null,
						total: 1,
					})
				: undefined;

		const { code, output } = await runPhalaJson(
			[...JSON_UPDATE, "-c", composePath, "--wait"],
			OIDC,
		);

		expect(code).not.toBe(0);
		expect(output.success).toBe(false);
		expect(String(output.error)).toContain(
			"Compose update failed: image not found",
		);
	});

	test("no_change prints the success object and skips the operations read", async () => {
		respond = (method) =>
			method === "PATCH"
				? Response.json({
						status: "no_change",
						message: "Compose configuration unchanged",
						correlation_id: "",
					})
				: undefined;

		const { code, output } = await runPhalaJson(
			[...JSON_UPDATE, "-c", composePath, "--wait"],
			OIDC,
		);

		expect(code).toBe(0);
		expect(output).toMatchObject({
			success: true,
			vm_uuid: VM_UUID,
			app_id: "abc",
			name: "my-app",
			dashboard_url: expect.stringContaining(VM_UUID),
		});
		expect(requests.some((r) => r.path.endsWith("/operations"))).toBe(false);
	});

	test("--prepare-only writes only the pending-approval object", async () => {
		respond = (method) =>
			method === "PATCH"
				? Response.json(HASH_REQUIRED, { status: 465 })
				: undefined;

		const { code, output } = await runPhalaJson(
			[...JSON_UPDATE, "-c", composePath, "--prepare-only"],
			{ PHALA_CLOUD_API_KEY: "test-key" },
		);

		expect(code).toBe(0);
		expect(output).toMatchObject({
			success: true,
			prepare_only: true,
			compose_hash: "0xabc123",
			app_id: "abc",
			commit_token: "token-1",
		});
	});
});
