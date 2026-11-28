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
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import toml from "@iarna/toml";
import inquirer from "inquirer";
import { z } from "zod";
import { cvmIdOption, interactiveOption } from "@/src/core/common-flags";
import type { CommandContext, CommandDefinition } from "@/src/core/types";

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
const { linkCommand } = await import("../link");
const { dispatchCommand } = await import("@/src/core/dispatcher");
const { CommandRegistry } = await import("@/src/core/registry");
const { portPolicyCommands } = await import("../port-policy");

type Recorded = {
	method: string;
	path: string;
	search: string;
	authorization: string | null;
	composeHash: string | null;
	transactionHash: string | null;
	body: Record<string, unknown> | undefined;
};

// The identifier the user passes; the API resolves it to the real vm_uuid.
const CVM_ID = "0123456789abcdef0123456789abcdef";
const VM_UUID = "fedcba9876543210fedcba9876543210";
const COMPOSE = "services:\n  app:\n    image: nginx\n";
const UPDATE_CORRELATION_ID = "exact-update-operation";
const UPDATE_TX = `0x${"a2".repeat(32)}`;
const UPDATE_FINALITY = {
	operation: "update",
	correlation_id: UPDATE_CORRELATION_ID,
	phase: "awaiting_finality",
	stage: "submitted",
	transaction: { hash: UPDATE_TX, block_number: 38911000, chain_id: 8453 },
	finality: {
		block_tag: "finalized",
		policy_block_number: null,
		blocks_remaining: null,
		eta_seconds: 93,
	},
};
const UPDATE_ACCEPTANCE = {
	status: "in_progress",
	correlation_id: UPDATE_CORRELATION_ID,
	finality_wait: UPDATE_FINALITY,
};

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
		resource: { memory_in_mb: 4096 },
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
				composeHash: req.headers.get("x-compose-hash"),
				transactionHash: req.headers.get("x-transaction-hash"),
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

// `--dev-os` writes the dev box into the compose file it deploys; every test
// starts from the original.
beforeEach(async () => {
	await fs.writeFile(composePath, COMPOSE);
	await fs.remove(path.join(tmpDir, "phala.toml"));
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
	guidance: () => string | undefined;
} {
	let failure: unknown;
	let guidance: string | undefined;
	const context = {
		env: {
			...auth,
			PHALA_CLOUD_REQUESTS_PER_MINUTE: "60000",
			PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}/api/v1`,
			PHALA_CLOUD_DIR: tmpDir,
		},
		projectConfig: {},
		cvmId,
		stdout: { write: () => true },
		stderr: { write: () => true },
		failWithError: (error: unknown, options?: { guidance?: string }) => {
			failure = error;
			guidance = options?.guidance;
		},
	} as unknown as CommandContext;
	return { context, failure: () => failure, guidance: () => guidance };
}

async function deploy(
	input: Record<string, unknown>,
	auth: Record<string, string> = { PHALA_CLOUD_API_KEY: "test-key" },
	cvmId: { id: string } = { id: CVM_ID },
) {
	const { context, failure, guidance } = makeContext(auth, cvmId);
	const exitCode = await runDeploy(
		{ compose: composePath, json: true, ...input } as Parameters<
			typeof runDeploy
		>[0],
		context,
	);
	return { exitCode, failure: failure(), guidance: guidance() };
}

function updateRequest(): Recorded {
	const patches = requests.filter(
		(r) => r.method === "PATCH" && /^\/api\/v1\/cvms\/[^/]+$/.test(r.path),
	);
	expect(patches).toHaveLength(1);
	return patches[0] as Recorded;
}

/** Run `phala <argv>` through the real argument parser and dispatcher. */
async function runCli(
	argv: string[],
	auth: Record<string, string | undefined> = {
		PHALA_CLOUD_API_KEY: "test-key",
	},
	options?: { terminal?: boolean; command?: CommandDefinition },
) {
	const registry = new CommandRegistry();
	registry.registerCommand(deployCommand);
	registry.registerCommand(linkCommand);
	if (options?.command) registry.registerCommand(options.command);
	registry.registerGroup(portPolicyCommands.group);
	for (const command of portPolicyCommands.commands)
		registry.registerCommand(command);
	let stdout = "";
	let stderr = "";
	const output = (append: (chunk: string) => void) =>
		({
			write: (chunk: string) => {
				append(chunk);
				return true;
			},
			isTTY: options?.terminal === true,
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
			...auth,
			PHALA_CLOUD_REQUESTS_PER_MINUTE: "60000",
			PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}/api/v1`,
			PHALA_CLOUD_DIR: tmpDir,
		},
		stdout: output((chunk) => {
			stdout += chunk;
		}),
		stderr: output((chunk) => {
			stderr += chunk;
		}),
		stdin: options?.terminal
			? ({ isTTY: true } as NodeJS.ReadStream)
			: process.stdin,
	});
	return { code, stdout, stderr };
}

describe("phala port-policy wire contract", () => {
	const uuid = "550e8400e29b41d4a716446655440000";
	const secondUuid = "550e8400e29b41d4a716446655440001";
	const base = "4e".repeat(32);
	const appId = "fd".repeat(20);
	const command = (action: string, ...args: string[]) =>
		runCli(["port-policy", action, "--cvm-id", CVM_ID, "--json", ...args]);
	const storedPolicy = {
		restrict_mode: true,
		ports: [{ port: 8090 }, { port: 22 }, { port: 8443, pp: true }],
	};
	const instance = (vmUuid: string, policy: object = storedPolicy) =>
		cvmInfo({
			vm_uuid: vmUuid,
			app_id: appId,
			compose_hash: base,
			status: "stopped",
			compose_file: { name: "my-app", port_policy: policy },
		});
	const accept = () =>
		Response.json(
			{ ...UPDATE_ACCEPTANCE, port_policy_unlisted_ports: [8081] },
			{ status: 202 },
		);
	const read = (method: string) =>
		method === "GET" ? Response.json(instance(uuid)) : undefined;

	test("show app reads the compose once per instance and reports drift", async () => {
		respond = (_method, pathname) => {
			if (pathname === `/api/v1/apps/${appId}/cvms`)
				return Response.json([instance(uuid), instance(secondUuid)]);
			if (pathname.endsWith(uuid)) return Response.json(instance(uuid));
			return Response.json(
				instance(secondUuid, { restrict_mode: false, ports: [] }),
			);
		};
		const result = await runCli([
			"port-policy",
			"show",
			"--app-id",
			appId,
			"--json",
		]);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('"policy_consistent": false');
		expect(result.stdout).toContain(base);
		expect(
			requests.map(({ method, path, search }) => [method, path, search]),
		).toEqual([
			["GET", `/api/v1/apps/${appId}/cvms`, ""],
			["GET", `/api/v1/cvms/${uuid}`, "?include_compose=true"],
			["GET", `/api/v1/cvms/${secondUuid}`, "?include_compose=true"],
		]);
	});

	test("interactive policy selection reads the chosen VM, while the default picker passes an app ID", async () => {
		const cvms = "/api/v1/cvms";
		const list = `${cvms}/paginated`;
		respond = (_method, pathname) => {
			if (pathname === list)
				return Response.json({
					items: [instance(uuid), instance(secondUuid)],
					total: 2,
					page: 1,
					page_size: 20,
					pages: 1,
				});
			if (pathname.endsWith(secondUuid))
				return Response.json(instance(secondUuid));
			return Response.json({ message: "Not found" }, { status: 404 });
		};
		const chooseSecondCvm = (async ([question]: [
			{ choices: { value: string }[] },
		]) => ({
			selectedCvm: question.choices[1]?.value,
		})) as unknown as typeof inquirer.prompt;
		const prompt = spyOn(inquirer, "prompt").mockImplementation(
			chooseSecondCvm,
		);
		try {
			const selected = await runCli(
				["port-policy", "show", "--interactive"],
				undefined,
				{ terminal: true },
			);

			expect(selected.code).toBe(0);
			expect(selected.stdout).toContain(`VM UUID: ${secondUuid}`);
			expect(requests.map(({ path }) => path)).toEqual([
				list,
				`${cvms}/${secondUuid}`,
			]);
			requests = [];

			const legacy: CommandDefinition = {
				path: ["legacy-picker"],
				meta: {
					name: "legacy-picker",
					description:
						"Read the identifier received from the default CVM picker",
					stability: "stable",
					options: [cvmIdOption, interactiveOption],
				},
				schema: z.object({}),
				run: (_input, context) => {
					context.stdout.write(JSON.stringify(context.cvmId));
					return 0;
				},
			};
			const existing = await runCli(
				["legacy-picker", "--interactive"],
				undefined,
				{ terminal: true, command: legacy },
			);
			expect(existing.code).toBe(0);
			expect(JSON.parse(existing.stdout)).toEqual({ app_id: appId });
			expect(requests.map(({ path }) => path)).toEqual([list]);
		} finally {
			prompt.mockRestore();
		}
	});

	test("allow targets the resolved UUID and sends the stored hash with the full policy", async () => {
		respond = (method) => read(method) ?? accept();

		const result = await command("allow", "8080", "8443", "--yes");

		expect(result.code).toBe(0);
		expect(result.stdout).toContain(UPDATE_CORRELATION_ID);
		expect(result.stderr).toContain("phala port-policy allow 8081");
		expect(requests.map(({ method }) => method)).toEqual(["GET", "PATCH"]);
		expect(updateRequest()).toMatchObject({
			path: `/api/v1/cvms/${uuid}`,
			body: {
				expected_compose_hash: base,
				compose: {
					port_policy: {
						restrict_mode: true,
						ports: [
							{ port: 8090, pp: false },
							{ port: 22, pp: false },
							{ port: 8443, pp: true },
							{ port: 8080, pp: false },
						],
					},
				},
			},
		});
		expect(updateRequest().body).not.toHaveProperty(
			"guest_agent_gateway_access",
		);
	});

	test("an equivalent change sends no PATCH", async () => {
		respond = read;

		const result = await command("allow", "8443");

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('"status": "no_change"');
		expect(requests.map(({ method }) => method)).toEqual(["GET"]);
	});

	test.each([
		{ action: "deny", args: ["8090"], confirmation: "8090" },
		{ action: "deny", args: ["22"], confirmation: "22" },
		{
			action: "replace",
			args: ["--deny-all", "--confirm-close", "8090", "--confirm-close", "22"],
			confirmation: "all",
		},
	])(
		"refuses to send a PATCH without confirmation for $confirmation",
		async ({ action, args, confirmation }) => {
			respond = (method) => read(method) ?? accept();
			const outcome = await command(action, ...args, "--yes");

			expect(outcome.code).toBe(1);
			expect(outcome.stdout).toContain(`--confirm-close ${confirmation}`);
			expect(requests.map(({ method }) => method)).toEqual(["GET"]);
		},
	);

	test("one all-ports confirmation covers closing every port and explains the loss of access", async () => {
		respond = (method) => read(method) ?? accept();

		const accepted = await command(
			"replace",
			"--deny-all",
			"--yes",
			"--confirm-close",
			"all",
		);

		expect(accepted.code).toBe(0);
		expect(accepted.stderr).toContain("logs, status, or attestation data");
		expect(updateRequest().body).toMatchObject({
			guest_agent_gateway_access: "closed",
			compose: { port_policy: { restrict_mode: true, ports: [] } },
		});
	});

	test("all-ports confirmation also covers individually closed ports", async () => {
		respond = (method) => read(method) ?? accept();

		const accepted = await command(
			"replace",
			"--restrict",
			"--port",
			"8443",
			"--yes",
			"--confirm-close",
			"all",
		);

		expect(accepted.code).toBe(0);
		expect(updateRequest().body?.guest_agent_gateway_access).toBe("closed");
	});

	test("prints readable issue paths for invalid replacement files without sending a PATCH", async () => {
		const file = path.join(tmpDir, "invalid-policy.json");
		await fs.writeFile(
			file,
			JSON.stringify({
				restrict_mode: true,
				ports: [{ port: 70000, extra: true }],
			}),
		);
		respond = (method) => read(method) ?? accept();

		const result = await command("replace", "--file", file, "--yes");

		expect(result.code).toBe(1);
		const { error } = JSON.parse(result.stdout);
		expect(error).toContain('ports.0: Unrecognized key: "extra"');
		expect(error).toContain("ports.0.port:");
		expect(error).not.toContain('"unrecognized_keys"');
		expect(requests.map(({ method }) => method)).toEqual(["GET"]);
	});

	test("an ambiguous App ID only reads; a stale change tells the user to read again", async () => {
		respond = () =>
			Response.json(
				{ error_code: "ERR-03-010", message: "Multiple instances" },
				{ status: 409 },
			);
		const ambiguous = await runCli([
			"port-policy",
			"allow",
			"8080",
			"--cvm-id",
			appId,
			"--yes",
		]);
		expect(ambiguous.code).toBe(1);
		expect(ambiguous.stderr).toContain(`phala instances ls --app-id ${appId}`);
		expect(requests.length).toBeGreaterThan(0);
		expect(requests.every(({ method }) => method === "GET")).toBe(true);
		requests = [];

		respond = (method) =>
			read(method) ??
			Response.json(
				{ error_code: "ERR-03-072", message: "Compose hash changed" },
				{ status: 409 },
			);
		const stale = await runCli([
			"port-policy",
			"allow",
			"8080",
			"--cvm-id",
			CVM_ID,
			"--yes",
		]);
		expect(stale.code).toBe(1);
		expect(stale.stderr).toContain(`phala port-policy show --cvm-id ${uuid}`);
		expect(requests.map(({ method }) => method)).toEqual(["GET", "PATCH"]);
	});

	test("warns if a linked deploy would restore the TOML policy, without writing to it", async () => {
		const tomlPath = path.join(tmpDir, "phala.toml");
		const contents = `uuid = "${uuid}"\n[port_policy]\nrestrict_mode = true\nports = [{ port = 8090 }, { port = 22 }]\n`;
		await fs.writeFile(tomlPath, contents);
		respond = (method) => read(method) ?? accept();

		const result = await runCli([
			"port-policy",
			"allow",
			"8080",
			"--yes",
			"--json",
		]);

		expect(result.code).toBe(0);
		expect(requests[0]?.path).toBe(`/api/v1/cvms/${uuid}`);
		expect(result.stderr).toContain("will restore the policy in phala.toml");
		expect(result.stderr).toContain("{ port = 8080 }");
		expect(await fs.readFile(tomlPath, "utf8")).toBe(contents);
	});

	test("round-trips a show JSON policy through replace --file", async () => {
		const policyFile = path.join(tmpDir, "policy.json");
		respond = (method, pathname) => {
			if (method === "PATCH") return accept();
			return Response.json(
				pathname.endsWith(secondUuid)
					? instance(secondUuid, { restrict_mode: false, ports: [] })
					: instance(uuid),
			);
		};
		const shown = await command("show");
		expect(shown.code).toBe(0);
		const policy = JSON.parse(shown.stdout).port_policy;
		await fs.writeFile(policyFile, JSON.stringify(policy));

		const args = [
			"port-policy",
			"replace",
			"--cvm-id",
			secondUuid,
			"--file",
			policyFile,
			"--json",
		];
		const declined = await runCli(args);
		expect(declined.code).toBe(1);
		expect(declined.stdout).toContain("--yes");
		expect(requests.some(({ method }) => method === "PATCH")).toBe(false);

		const accepted = await runCli([...args, "--yes"]);
		expect(accepted.code).toBe(0);
		expect(updateRequest()).toMatchObject({
			path: `/api/v1/cvms/${secondUuid}`,
			body: {
				compose: {
					port_policy: {
						restrict_mode: true,
						ports: [
							{ port: 22, pp: false },
							{ port: 8090, pp: false },
							{ port: 8443, pp: true },
						],
					},
				},
			},
		});
	});

	test("prepares and then confirms the saved update without sending a new policy", async () => {
		respond = (method) =>
			read(method) ?? Response.json(HASH_REQUIRED, { status: 465 });
		const prepared = await command(
			"replace",
			"--restrict",
			"--port",
			"8090",
			"--port",
			"22",
			"--port",
			"8080",
			"--yes",
			"--prepare-only",
		);

		expect(prepared.code).toBe(0);
		expect(prepared.stdout).toContain('"prepare_only": true');
		expect(updateRequest().body?.expected_compose_hash).toBe(base);
		requests = [];

		respond = (method) => read(method) ?? accept();
		const confirmed = await command(
			"replace",
			"--yes",
			"--compose-hash",
			"abc123",
			"--transaction-hash",
			UPDATE_TX,
		);

		expect(confirmed.code).toBe(0);
		expect(confirmed.stderr).toContain("phala port-policy allow 8081");
		expect(updateRequest()).toMatchObject({
			path: `/api/v1/cvms/${uuid}`,
			composeHash: "abc123",
			transactionHash: UPDATE_TX,
			body: {},
		});
	});
});

test("phala link rewrites the project target without changing the existing port policy table", async () => {
	const configPath = path.join(tmpDir, "phala.toml");
	await fs.writeFile(
		configPath,
		`name = "old-app"\n[port_policy]\nrestrict_mode = true\nports = [{ port = 8090, pp = false }, { port = 443 }, { port = 80, pp = true }]\n`,
	);
	const original = toml.parse(await fs.readFile(configPath, "utf8"));
	respond = (_method, pathname) =>
		pathname.endsWith("/auth/me")
			? Response.json({
					user: {
						username: "tester",
						email: "tester@example.com",
						role: "user",
						avatar: "",
						email_verified: true,
						totp_enabled: false,
						has_backup_codes: false,
						flag_has_password: false,
					},
					workspace: {
						id: "test",
						name: "Test",
						slug: "test",
						tier: "PRO",
						role: "owner",
					},
					credits: {
						balance: "0",
						granted_balance: "0",
						is_post_paid: false,
						outstanding_amount: null,
					},
				})
			: Response.json(cvmInfo());
	const confirmOverwrite = (async () => ({
		overwrite: true,
	})) as unknown as typeof inquirer.prompt;
	const prompt = spyOn(inquirer, "prompt").mockImplementation(confirmOverwrite);
	const previousDir = process.cwd();
	try {
		process.chdir(tmpDir);
		const result = await runCli(["link", CVM_ID]);
		expect(result.code).toBe(0);
		const written = toml.parse(await fs.readFile(configPath, "utf8"));
		expect(written.name).toBe("my-app");
		expect(written.app_id).toBe("abc");
		expect(written.port_policy).toEqual(original.port_policy);
	} finally {
		process.chdir(previousDir);
		prompt.mockRestore();
	}
});

describe("phala deploy with a project port policy", () => {
	const uuid = "550e8400e29b41d4a716446655440000";
	const base = "8a".repeat(32);
	const current = {
		restrict_mode: true,
		ports: [{ port: 8090 }, { port: 22 }],
	};
	const tomlPath = () => path.join(tmpDir, "phala.toml");
	const input = () => ["deploy", "--compose", composePath, "--json"];
	const configuredPolicy = (ports: string) =>
		`id = "${CVM_ID}"\n[port_policy]\nrestrict_mode = true\nports = ${ports}\n`;
	const setup = () => {
		respond = (method, pathname) => {
			if (method === "GET" && pathname === `/api/v1/cvms/${CVM_ID}`)
				return Response.json(
					cvmInfo({
						vm_uuid: uuid,
						compose_hash: base,
						compose_file: { port_policy: current },
					}),
				);
			if (method === "PATCH")
				return Response.json(
					{
						status: "in_progress",
						correlation_id: "corr-1",
						port_policy_unlisted_ports: [8443],
					},
					{ status: 202 },
				);
			return undefined;
		};
	};

	test("replaces both fields on the resolved UUID without an optimistic hash", async () => {
		await fs.writeFile(
			tomlPath(),
			configuredPolicy("[{ port = 8080 }, { port = 22 }]"),
		);
		setup();
		const missing = await runCli(input());
		expect(missing.code).toBe(1);
		expect(missing.stdout).toContain("--confirm-close 8090");
		expect(requests.some(({ method }) => method === "PATCH")).toBe(false);

		const sent = await runCli([...input(), "--confirm-close", "8090"]);
		expect(sent.code).toBe(0);
		expect(sent.stderr).toContain("phala port-policy allow 8443");
		expect(updateRequest()).toMatchObject({
			path: `/api/v1/cvms/${uuid}`,
			body: {
				guest_agent_gateway_access: "closed",
				compose: {
					port_policy: {
						restrict_mode: true,
						ports: [
							{ port: 22, pp: false },
							{ port: 8080, pp: false },
						],
					},
				},
			},
		});
		expect(updateRequest().body).not.toHaveProperty("expected_compose_hash");
	});

	test("omits a behaviorally unchanged policy from the patch", async () => {
		await fs.writeFile(
			tomlPath(),
			configuredPolicy("[{ port = 22 }, { port = 8090 }]"),
		);
		setup();
		expect((await runCli(input())).code).toBe(0);
		expect(updateRequest().body?.compose ?? {}).not.toHaveProperty(
			"port_policy",
		);
	});

	test("invalid policy and --app-compose conflict both fail before any HTTP request", async () => {
		await fs.writeFile(tomlPath(), configuredPolicy("[{ port = 65536 }]"));
		const invalid = await runCli(input());
		expect(invalid.code).toBe(1);
		expect(JSON.stringify(invalid)).toContain("port_policy.ports.0.port");

		await fs.writeFile(tomlPath(), configuredPolicy("[]"));
		const conflict = await runCli([
			"deploy",
			"--app-compose",
			"app-compose.json",
			"--json",
		]);
		expect(conflict.code).toBe(1);
		expect(conflict.stdout).toContain("Do not combine [port_policy]");
		expect(requests).toEqual([]);
	});
});

describe("phala deploy update finality", () => {
	const args = () => ["deploy", "--cvm-id", CVM_ID, "--compose", composePath];
	const commitArgs = [
		"deploy",
		"--cvm-id",
		CVM_ID,
		"--commit",
		"--token",
		"commit-token",
	];
	const accepted = () => Response.json(UPDATE_ACCEPTANCE, { status: 202 });
	const scopedQuery = `?correlation_id=${UPDATE_CORRELATION_ID}`;

	test("without --wait reports acceptance, ETA, exact identifiers and follow-up without polling", async () => {
		respond = (method) => (method === "PATCH" ? accepted() : undefined);
		const result = await runCli([...args(), "--json"]);
		expect(result.code).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			status: "in_progress",
			eta_seconds: 93,
			transaction_hash: UPDATE_TX,
			correlation_id: UPDATE_CORRELATION_ID,
			vm_uuid: VM_UUID,
			status_command: `phala api '/cvms/${VM_UUID}/operations${scopedQuery}'`,
		});
		expect(
			requests.some((request) => request.path.endsWith("/operations")),
		).toBe(false);
	});

	test("keeps an unavailable server ETA even for a measured chain and block tag", async () => {
		respond = (method) =>
			method === "PATCH"
				? Response.json(
						{
							...UPDATE_ACCEPTANCE,
							finality_wait: {
								...UPDATE_FINALITY,
								finality: { ...UPDATE_FINALITY.finality, eta_seconds: null },
							},
						},
						{ status: 202 },
					)
				: undefined;
		const result = await runCli([...args(), "--json"]);
		expect(result.code).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			status: "in_progress",
			eta_seconds: null,
		});
	});

	test("reports stages on stderr for JSON and waits for the running CVM after finality", async () => {
		const stages = [
			{ stage: "submitted", phase: "awaiting_finality" },
			{ stage: "safe", phase: "awaiting_finality" },
			{ stage: "finalized", phase: "awaiting_finality" },
			{ stage: "finalized", phase: "applying" },
		];
		respond = (method, pathname) => {
			if (method === "PATCH") return accepted();
			if (!pathname.endsWith("/operations")) return undefined;
			const stage = stages.shift();
			return Response.json({
				items: [
					{
						operation_type: "update",
						correlation_id: "not-our-operation",
						status: "completed",
					},
					{
						operation_type: "update",
						correlation_id: UPDATE_CORRELATION_ID,
						status: stage ? "in_progress" : "completed",
						finality_wait: stage ? { ...UPDATE_FINALITY, ...stage } : null,
					},
				],
			});
		};
		const nativeTimeout = globalThis.setTimeout;
		const fastPoll = spyOn(globalThis, "setTimeout").mockImplementation(((
			fn,
			delay,
			...args
		) =>
			nativeTimeout(
				fn,
				delay === 15_000 ? 1 : delay,
				...args,
			)) as typeof setTimeout);
		try {
			const result = await runCli([...args(), "--wait", "--json"]);
			expect(result.code).toBe(0);
			expect(JSON.parse(result.stdout)).toMatchObject({ status: "completed" });
			expect(result.stdout).not.toContain("On-chain stage:");
			expect(result.stderr.match(/On-chain stage: submitted/g)).toHaveLength(1);
			expect(result.stderr).toContain("On-chain stage: safe");
			expect(result.stderr).toContain("On-chain stage: finalized. Waiting");
			expect(result.stderr).toContain(
				"On-chain stage: finalized. Phala Cloud is applying the change.",
			);
			const reads = requests.filter((request) =>
				request.path.endsWith("/operations"),
			);
			expect(reads.map((request) => request.search)).toEqual(
				Array.from({ length: 5 }, () => scopedQuery),
			);
			expect(requests.at(-1)).toMatchObject({
				method: "GET",
				path: `/api/v1/cvms/${VM_UUID}`,
				search: "",
			});
		} finally {
			fastPoll.mockRestore();
		}
	});

	test("an OIDC deploy waits for the scoped operation then for the stopped CVM without unscoped history reads", async () => {
		let updated = false;
		let readinessReads = 0;
		respond = (method, pathname, query) => {
			if (method === "PATCH") {
				updated = true;
				return accepted();
			}
			if (pathname.endsWith("/operations")) {
				expect(query.get("correlation_id")).toBe(UPDATE_CORRELATION_ID);
				return Response.json({
					items: [
						{
							correlation_id: UPDATE_CORRELATION_ID,
							status: "completed",
							operation_type: "update",
						},
					],
				});
			}
			if (pathname.startsWith("/api/v1/cvms/")) {
				return Response.json(
					cvmInfo({
						status: "stopped",
						in_progress: updated && ++readinessReads === 1,
					}),
				);
			}
		};
		const nativeTimeout = globalThis.setTimeout;
		const fastPoll = spyOn(globalThis, "setTimeout").mockImplementation(((
			fn,
			delay,
			...args
		) =>
			nativeTimeout(
				fn,
				delay === 2_000 ? 1 : delay,
				...args,
			)) as typeof setTimeout);
		try {
			const result = await runCli([...args(), "--wait"], {
				PHALA_CLOUD_API_KEY: undefined,
				PHALA_OIDC_TOKEN: "oidc-deploy-token",
			});
			expect(result.code).toBe(0);
			expect(readinessReads).toBe(2);
			const cvmRequests = requests.filter((request) =>
				request.path.startsWith("/api/v1/cvms/"),
			);
			expect(
				cvmRequests.map(({ method, path, search }) => [method, path, search]),
			).toEqual([
				["GET", `/api/v1/cvms/${CVM_ID}`, "?include_compose=true"],
				["PATCH", `/api/v1/cvms/${CVM_ID}`, ""],
				["GET", `/api/v1/cvms/${VM_UUID}/operations`, scopedQuery],
				["GET", `/api/v1/cvms/${VM_UUID}`, ""],
				["GET", `/api/v1/cvms/${VM_UUID}`, ""],
			]);
			expect(
				cvmRequests.every(
					({ authorization }) => authorization === "Bearer oidc-deploy-token",
				),
			).toBe(true);
		} finally {
			fastPoll.mockRestore();
		}
	});

	test.each([
		[1, 2_017_000],
		[8453, 2_135_000],
		[999, 2_700_000],
	])(
		"uses the operation's chain %s for its local wait budget when server ETA is null",
		async (chainId, budget) => {
			respond = (method, pathname) => {
				if (method === "PATCH")
					return Response.json(
						{
							...UPDATE_ACCEPTANCE,
							finality_wait: {
								...UPDATE_FINALITY,
								transaction: {
									...UPDATE_FINALITY.transaction,
									chain_id: chainId,
								},
								finality: { ...UPDATE_FINALITY.finality, eta_seconds: null },
							},
						},
						{ status: 202 },
					);
				if (pathname.endsWith("/operations"))
					return Response.json({ items: [] });
			};
			const nativeTimeout = globalThis.setTimeout;
			const deadline = spyOn(globalThis, "setTimeout").mockImplementation(((
				fn,
				delay,
				...args
			) =>
				nativeTimeout(
					fn,
					delay === budget ? 100 : delay,
					...args,
				)) as typeof setTimeout);
			try {
				const result = await runCli([...args(), "--wait"]);
				expect(result.code).toBe(1);
				expect(result.stderr).toContain(`after ${budget} ms`);
				expect(result.stderr).toContain(
					`phala api '/cvms/${VM_UUID}/operations${scopedQuery}'`,
				);
				expect(result.stderr).not.toContain("not submitted");
				expect(requests.at(-1)?.search).toBe(scopedQuery);
			} finally {
				deadline.mockRestore();
			}
		},
	);

	test("reports an operation failure before waiting for the CVM to be ready", async () => {
		respond = (method, pathname) => {
			if (method === "PATCH") return accepted();
			if (pathname.endsWith("/operations"))
				return Response.json({
					items: [
						{
							operation_type: "update",
							correlation_id: UPDATE_CORRELATION_ID,
							status: "failed",
							failure_reason: "apply_failed",
							error_message: "The update could not be applied.",
						},
					],
				});
		};
		const result = await runCli([...args(), "--wait"]);
		expect(result.code).toBe(1);
		expect(result.stderr).toContain("The update could not be applied.");
		expect(result.stderr).toContain(
			`phala api '/cvms/${VM_UUID}/operations${scopedQuery}'`,
		);
		expect(requests.at(-1)?.search).toBe(scopedQuery);
	});

	test("rejects --commit --wait before any request without workspace read credentials", async () => {
		const result = await runCli([...commitArgs, "--wait"], {
			PHALA_CLOUD_API_KEY: undefined,
			PHALA_OIDC_TOKEN: "deploy-only",
		});
		expect(result.code).toBe(1);
		expect(result.stderr).toContain("The update was not submitted.");
		expect(requests).toEqual([]);
	});

	test("rejects --commit --wait before POST if the workspace cannot read the CVM operations", async () => {
		respond = (_method, pathname) =>
			pathname.endsWith("/operations")
				? Response.json(
						{ detail: "CVM not found in this workspace." },
						{ status: 404 },
					)
				: undefined;
		const result = await runCli([...commitArgs, "--wait"]);
		expect(result.code).toBe(1);
		expect(result.stderr).toContain("The update was not submitted.");
		expect(requests.map(({ method, search }) => [method, search])).toEqual([
			["GET", "?limit=1"],
		]);
	});

	test("commit token alone still submits without waiting and reports that finality is pending", async () => {
		respond = (method) => (method === "POST" ? accepted() : undefined);
		const result = await runCli([...commitArgs, "--json"], {
			PHALA_CLOUD_API_KEY: undefined,
			PHALA_OIDC_TOKEN: undefined,
		});
		expect(result.code).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			status: "in_progress",
			correlation_id: UPDATE_CORRELATION_ID,
			transaction_hash: UPDATE_TX,
		});
		expect(requests.map((request) => request.method)).toEqual(["POST"]);
	});

	test.each(["PATCH", "POST"])(
		"%s --wait reports a successful update with no operation ID without polling or resubmitting",
		async (mutation) => {
			respond = (method) =>
				method === mutation
					? Response.json(
							{ ...UPDATE_ACCEPTANCE, correlation_id: null },
							{ status: 202 },
						)
					: undefined;
			const result = await runCli([
				...(mutation === "PATCH" ? args() : commitArgs),
				"--wait",
				"--json",
			]);
			expect(result.code).toBe(0);
			const output = JSON.parse(result.stdout);
			expect(output).toMatchObject({
				success: true,
				status: "in_progress",
				tracking: "untracked",
				correlation_id: null,
			});
			expect(output).not.toHaveProperty("status_command");
			expect(
				requests.filter((request) => request.method === mutation),
			).toHaveLength(1);
			expect(
				requests.some((request) => request.search.includes("correlation_id")),
			).toBe(false);
		},
	);

	test("commit --wait verifies read access, follows the exact correlation and checks the stopped CVM", async () => {
		respond = (method, pathname, query) => {
			if (method === "POST")
				return Response.json(
					{
						status: "awaiting_finality",
						correlation_id: UPDATE_CORRELATION_ID,
					},
					{ status: 202 },
				);
			if (pathname === `/api/v1/cvms/${CVM_ID}`)
				return Response.json(cvmInfo({ status: "stopped" }));
			if (pathname.endsWith("/operations"))
				return Response.json({
					items: query.has("correlation_id")
						? [
								{
									correlation_id: UPDATE_CORRELATION_ID,
									status: "completed",
									operation_type: "update",
								},
							]
						: [],
				});
		};
		const result = await runCli([...commitArgs, "--wait", "--json"]);
		expect(result.code).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			status: "completed",
			correlation_id: UPDATE_CORRELATION_ID,
		});
		expect(
			requests.map(({ method, path, search }) => [method, path, search]),
		).toEqual([
			["GET", `/api/v1/cvms/${CVM_ID}/operations`, "?limit=1"],
			["GET", `/api/v1/cvms/${CVM_ID}`, ""],
			["POST", `/api/v1/cvms/${CVM_ID}/commit-update`, ""],
			["GET", `/api/v1/cvms/${CVM_ID}/operations`, scopedQuery],
			["GET", `/api/v1/cvms/${CVM_ID}`, ""],
		]);
	});
});

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

	test("describes --init-script as a Phala Cloud provided script by name", async () => {
		const { code, stdout } = await runCli(["deploy", "--help"]);

		expect(code).toBe(0);
		const option = stdout
			.split("\n")
			.find(
				(line) =>
					line.includes("--init-script") && line.includes("provided by Phala"),
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

	test("sends no image and no OS image preference when the update names none", async () => {
		const { exitCode, failure } = await deploy({});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		const body = updateRequest().body as Record<string, unknown>;
		expect("image" in body).toBe(false);
		expect("prefer_dev" in body).toBe(false);
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
		// Like the server, return compose_file only when the request asks for it.
		respond = (method, urlPath, query) =>
			method === "GET" && /^\/api\/v1\/cvms\/[^/]+$/.test(urlPath)
				? Response.json(
						cvmInfo(
							query.get("include_compose") === "true"
								? { compose_file: { docker_compose_file: DEPLOYED_DEV_BOX } }
								: {},
						),
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

	test("sends an init script name it does not know without rejecting it", async () => {
		const { exitCode, failure } = await deploy({
			initScript: ["future_script"],
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(updateRequest().body?.init_scripts).toEqual(["future_script"]);
	});

	test("points to --confirm-data-wipe when the server asks for it", async () => {
		respond = (method, path) =>
			method === "PATCH" && /^\/api\/v1\/cvms\/[^/]+$/.test(path)
				? Response.json(
						{
							error_code: "ERR-03-048",
							message: "Turning this on erases data on every boot",
						},
						{ status: 400 },
					)
				: undefined;
		const { exitCode, guidance } = await deploy({
			initScript: ["docker_cleanup"],
		});

		expect(exitCode).toBe(1);
		expect(guidance).toContain("--confirm-data-wipe");
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
						resource: { memory_in_mb: 4096 },
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
						resource: { memory_in_mb: 4096 },
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
				resource: { memory_in_mb: 4096 },
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
				resource: { memory_in_mb: 4096 },
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
				resource: { memory_in_mb: 4096 },
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
						resource: { memory_in_mb: 4096 },
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
