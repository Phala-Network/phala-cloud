/**
 * Auth options (--profile, --api-token, PHALA_CLOUD_API_KEY) must reach every
 * API request a command makes, including the ones issued by the shared helpers
 * in src/api/cvms.ts.
 *
 * Two profiles point at two local fake API servers. The CVM exists only on
 * server B, so a request sent with the wrong credentials shows up either as a
 * hit on server A or as a "CVM not found" failure.
 */

import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	mock,
	test,
} from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import type { CommandContext } from "@/src/core/types";

// Other test files replace these modules with mock.module; load fresh real
// instances (see annotations/index.test.ts).
const realCloud = await import(`${require.resolve("@phala/cloud")}?real`);
mock.module("@phala/cloud", () => ({ ...realCloud }));
const previousClient = { ...(await import("@/src/lib/client")) };
const realClient = await import(`${require.resolve("@/src/lib/client")}?real`);
mock.module("@/src/lib/client", () => ({ ...realClient }));
const previousApi = { ...(await import("@/src/api/cvms")) };
const realApi = await import(`${require.resolve("@/src/api/cvms")}?real`);
mock.module("@/src/api/cvms", () => ({ ...realApi }));
const realJsonMode: typeof import("@/src/core/json-mode") = await import(
	`${require.resolve("@/src/core/json-mode")}?real`
);
mock.module("@/src/core/json-mode", () => ({ ...realJsonMode }));
const realLogger: typeof import("@/src/utils/logger") = await import(
	`${require.resolve("@/src/utils/logger")}?real`
);
mock.module("@/src/utils/logger", () => ({ ...realLogger }));
afterAll(() => {
	mock.module("@/src/lib/client", () => previousClient);
	mock.module("@/src/api/cvms", () => previousApi);
});

const { dispatchCommand } = await import("@/src/core/dispatcher");
const { CommandRegistry } = await import("@/src/core/registry");
const { logsCommand } = await import("./logs/index");
const { cvmsLogsCommand } = await import("./cvms/logs/index");
const { cvmsSerialLogsCommand } = await import("./cvms/serial-logs/index");
const { cvmsAttestationCommand } = await import("./cvms/attestation/index");
const { cvmsResizeCommand } = await import("./cvms/resize/index");
const api = realApi as typeof import("@/src/api/cvms");

const CVM_ID = "0123456789abcdef0123456789abcdef";
const APP_ID = "fedcba9876543210fedcba9876543210fedcba98";
const TOKEN = { A: "key-of-profile-a", B: "key-of-profile-b" } as const;

interface Recorded {
	readonly method: string;
	readonly path: string;
	/** X-API-Key header; null for the unauthenticated presigned log URLs. */
	readonly apiKey: string | null;
}

interface FakeApi {
	readonly label: string;
	readonly server: ReturnType<typeof Bun.serve>;
	readonly prefix: string;
	hasCvm: boolean;
	requests: Recorded[];
}

/** CVM lookups and presigned log URLs are served from the same fake. */
function startFakeApi(label: string, hasCvm: boolean): FakeApi {
	const fake: FakeApi = {
		label,
		hasCvm,
		requests: [],
		get prefix() {
			return `http://127.0.0.1:${fake.server.port}/api/v1`;
		},
		server: Bun.serve({
			port: 0,
			async fetch(req) {
				const url = new URL(req.url);
				const route = url.pathname;
				fake.requests.push({
					method: req.method,
					path: route,
					apiKey: req.headers.get("x-api-key"),
				});
				const origin = `http://127.0.0.1:${fake.server.port}`;

				if (route.startsWith("/logs/")) {
					if (route.endsWith("/container/app")) {
						return new Response(
							`${JSON.stringify({ channel: "stdout", message: `container-from-${label}\n` })}\n`,
						);
					}
					return new Response(`serial-from-${label}\n`);
				}

				if (route === "/api/v1/teepods/cvm-create-resources") {
					return Response.json({ nodes: [] });
				}
				if (route === "/api/v1/cvms/paginated") {
					return Response.json({
						items: [],
						total: 0,
						page: 1,
						page_size: 20,
						pages: 0,
					});
				}
				if (!fake.hasCvm) {
					return Response.json(
						{
							error_code: "ERR-01-004",
							message: "CVM not found",
							details: [],
							suggestions: [],
							links: [],
							request_id: `request-${label}`,
						},
						{ status: 404 },
					);
				}
				if (route.endsWith("/composition")) {
					return Response.json({
						containers: [
							{
								id: "container-id",
								names: ["/app"],
								log_endpoint: `${origin}/logs/${label}/container/app?sig=x`,
							},
						],
					});
				}
				if (route.endsWith("/network")) {
					return Response.json({
						is_online: true,
						is_public: true,
						error: null,
						internal_ip: "10.0.0.1",
						latest_handshake: "now",
						public_urls: [],
					});
				}
				if (route.endsWith("/attestation")) {
					return Response.json({
						is_online: true,
						is_public: true,
						error: null,
						app_certificates: [],
						tcb_info: null,
						compose_file: null,
					});
				}
				if (req.method === "PATCH") {
					return Response.json({ message: "ok", status: "in_progress" });
				}
				return Response.json({
					id: CVM_ID,
					vm_uuid: CVM_ID,
					name: `cvm-of-${label}`,
					app_id: APP_ID,
					status: "running",
					public_logs: true,
					resource: {
						vcpu: 2,
						memory_in_gb: 4,
						memory_in_mb: 4096,
						disk_in_gb: 20,
					},
					gateway: {},
					logs: {
						serial: `${origin}/logs/${label}/node/serial?sig=x`,
						stdout: `${origin}/logs/${label}/node/stdout?sig=x`,
						stderr: `${origin}/logs/${label}/node/stderr?sig=x`,
						container_log_base: `${origin}/logs/${label}/container`,
						auth_query: "sig=x",
					},
				});
			},
		}),
	};
	return fake;
}

let fakeA: FakeApi;
let fakeB: FakeApi;
let tmpDir: string;
let savedDir: string | undefined;
let savedRate: string | undefined;

function profile(token: string, fake: FakeApi) {
	return {
		token,
		api_prefix: fake.prefix,
		workspace: { name: `workspace-${fake.label}` },
		user: { username: "tester" },
		updated_at: "2026-01-01T00:00:00Z",
	};
}

async function writeCredentials(currentProfile: "A" | "B") {
	await fs.writeJson(path.join(tmpDir, "credentials.json"), {
		schema_version: 1,
		current_profile: currentProfile,
		profiles: { A: profile(TOKEN.A, fakeA), B: profile(TOKEN.B, fakeB) },
	});
}

beforeAll(async () => {
	fakeA = startFakeApi("A", false);
	fakeB = startFakeApi("B", true);
	tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "phala-profile-ctx-"));
	// credentials.ts reads the process-level directory override.
	savedDir = process.env.PHALA_CLOUD_DIR;
	process.env.PHALA_CLOUD_DIR = tmpDir;
	// Keep request pacing out of the way for helpers that read process.env.
	savedRate = process.env.PHALA_CLOUD_REQUESTS_PER_MINUTE;
	process.env.PHALA_CLOUD_REQUESTS_PER_MINUTE = "60000";
});

afterAll(async () => {
	if (savedRate === undefined)
		Reflect.deleteProperty(process.env, "PHALA_CLOUD_REQUESTS_PER_MINUTE");
	else process.env.PHALA_CLOUD_REQUESTS_PER_MINUTE = savedRate;
	if (savedDir === undefined)
		Reflect.deleteProperty(process.env, "PHALA_CLOUD_DIR");
	else process.env.PHALA_CLOUD_DIR = savedDir;
	fakeA.server.stop(true);
	fakeB.server.stop(true);
	await fs.remove(tmpDir);
});

beforeEach(async () => {
	fakeA.hasCvm = false;
	fakeA.requests = [];
	fakeB.requests = [];
	// The stored default profile is the wrong one for every test.
	await writeCredentials("A");
});

afterEach(() => {
	realJsonMode.setJsonMode(false);
});

function capture() {
	let text = "";
	const stream = {
		write: (chunk: string) => {
			text += chunk;
			return true;
		},
		isTTY: false,
	} as unknown as NodeJS.WriteStream;
	return { stream, read: () => text };
}

type Command = Parameters<
	InstanceType<typeof CommandRegistry>["registerCommand"]
>[0];

async function runCli(
	command: Command,
	argv: string[],
	env: Record<string, string> = {},
	onStdout?: (text: string) => void,
) {
	const registry = new CommandRegistry();
	registry.registerCommand(command);
	const stdout = capture();
	const stderr = capture();
	const out = onStdout
		? ({
				write: (chunk: string) => {
					stdout.stream.write(chunk);
					onStdout(stdout.read());
					return true;
				},
				isTTY: false,
			} as unknown as NodeJS.WriteStream)
		: stdout.stream;
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
			PATH: process.env.PATH ?? "",
			PHALA_DISABLE_UPDATE_CHECK: "1",
			PHALA_CLOUD_REQUESTS_PER_MINUTE: "60000",
			...env,
		},
		stdout: out,
		stderr: stderr.stream,
		stdin: process.stdin,
	});
	return { code, stdout: stdout.read(), stderr: stderr.read() };
}

/** Every request reached server B with B's key, and none reached server A. */
function expectOnlyProfileB() {
	expect(fakeA.requests).toEqual([]);
	const apiCalls = fakeB.requests.filter((r) => r.path.startsWith("/api/"));
	expect(apiCalls.length).toBeGreaterThan(0);
	for (const call of apiCalls) {
		expect(call.apiKey).toBe(TOKEN.B);
	}
}

describe("--profile reaches log commands", () => {
	test("phala logs <cvm> --profile B (container logs)", async () => {
		const { code, stdout, stderr } = await runCli(logsCommand, [
			"logs",
			"--cvm-id",
			CVM_ID,
			"--profile",
			"B",
		]);
		expect(stderr).toBe("");
		expect(stdout).toContain("container-from-B");
		expect(code).toBe(0);
		expectOnlyProfileB();
	});

	test("phala logs <cvm> --serial --profile B", async () => {
		const { code, stdout } = await runCli(logsCommand, [
			"logs",
			"--cvm-id",
			CVM_ID,
			"--serial",
			"--profile",
			"B",
		]);
		expect(stdout).toContain("serial-from-B");
		expect(code).toBe(0);
		expectOnlyProfileB();
	});

	test("phala logs <cvm> --cvm-stderr --profile B", async () => {
		const { code, stdout } = await runCli(logsCommand, [
			"logs",
			"--cvm-id",
			CVM_ID,
			"--cvm-stderr",
			"--profile",
			"B",
		]);
		expect(stdout).toContain("serial-from-B");
		expect(code).toBe(0);
		expectOnlyProfileB();
	});

	test("phala logs --follow keeps profile B across reconnects", async () => {
		let interrupted = false;
		const { stdout } = await runCli(
			logsCommand,
			["logs", "--cvm-id", CVM_ID, "--serial", "--follow", "--profile", "B"],
			{},
			(text) => {
				if (!interrupted && text.includes("serial-from-B")) {
					interrupted = true;
					process.emit("SIGINT");
				}
			},
		);
		expect(stdout).toContain("serial-from-B");
		expectOnlyProfileB();
	});

	test("phala cvms logs <cvm> --profile B", async () => {
		const { code, stdout } = await runCli(cvmsLogsCommand, [
			"cvms",
			"logs",
			"--cvm-id",
			CVM_ID,
			"--profile",
			"B",
		]);
		expect(stdout).toContain("container-from-B");
		expect(code).toBe(0);
		expectOnlyProfileB();
	});

	test("phala cvms serial-logs <cvm> --profile B", async () => {
		const { code, stdout } = await runCli(cvmsSerialLogsCommand, [
			"cvms",
			"serial-logs",
			CVM_ID,
			"--profile",
			"B",
		]);
		expect(stdout).toContain("serial-from-B");
		expect(code).toBe(0);
		expectOnlyProfileB();
	});

	test("phala cvms serial-logs --follow keeps profile B", async () => {
		let interrupted = false;
		const { stdout } = await runCli(
			cvmsSerialLogsCommand,
			["cvms", "serial-logs", CVM_ID, "--follow", "--profile", "B"],
			{},
			(text) => {
				if (!interrupted && text.includes("serial-from-B")) {
					interrupted = true;
					process.emit("SIGINT");
				}
			},
		);
		expect(stdout).toContain("serial-from-B");
		expectOnlyProfileB();
	});
});

describe("--profile reaches other commands that used the shared helpers", () => {
	test("phala cvms attestation <cvm> --profile B", async () => {
		const { code } = await runCli(cvmsAttestationCommand, [
			"cvms",
			"attestation",
			CVM_ID,
			"--profile",
			"B",
			"--json",
		]);
		expect(code).toBe(0);
		expect(fakeB.requests.some((r) => r.path.endsWith("/attestation"))).toBe(
			true,
		);
		expectOnlyProfileB();
	});

	test("phala cvms resize <cvm> --profile B", async () => {
		const { code } = await runCli(cvmsResizeCommand, [
			"cvms",
			"resize",
			CVM_ID,
			"--vcpu",
			"4",
			"--profile",
			"B",
			"--json",
		]);
		expect(code).toBe(0);
		expect(fakeB.requests.some((r) => r.method === "PATCH")).toBe(true);
		expectOnlyProfileB();
	});

	const profileB = {
		env: { PHALA_CLOUD_REQUESTS_PER_MINUTE: "60000" },
		projectConfig: {},
		globalOptions: { json: false, interactive: false, profile: "B" },
	};

	test("getCvmNetwork uses the given context", async () => {
		const network = await api.getCvmNetwork(profileB, APP_ID);
		expect(network.internal_ip).toBe("10.0.0.1");
		expectOnlyProfileB();
	});

	test("getCvmStatus uses the given context", async () => {
		expect(await api.getCvmStatus(profileB, APP_ID)).toBe("running");
		expectOnlyProfileB();
	});

	test("getCvmByAppId uses the given context", async () => {
		expect((await api.getCvmByAppId(profileB, APP_ID)).name).toBe("cvm-of-B");
		expectOnlyProfileB();
	});

	test("getCvmCreateResources uses the given context", async () => {
		await api.getCvmCreateResources(profileB);
		expectOnlyProfileB();
	});

	test("selectCvm lists CVMs with the given context", async () => {
		expect(await api.selectCvm(profileB)).toBeUndefined();
		expectOnlyProfileB();
	});
});

describe("credential precedence", () => {
	beforeEach(() => {
		fakeA.hasCvm = true;
	});

	test("--api-token beats the stored profile token", async () => {
		const { code } = await runCli(logsCommand, [
			"logs",
			"--cvm-id",
			CVM_ID,
			"--serial",
			"--api-token",
			"token-from-flag",
		]);
		expect(code).toBe(0);
		const apiCalls = fakeA.requests.filter((r) => r.path.startsWith("/api/"));
		expect(apiCalls.length).toBeGreaterThan(0);
		for (const call of apiCalls) expect(call.apiKey).toBe("token-from-flag");
		expect(fakeB.requests).toEqual([]);
	});

	test("PHALA_CLOUD_API_KEY beats the stored profile token and loses to --api-token", async () => {
		await runCli(logsCommand, ["logs", "--cvm-id", CVM_ID, "--serial"], {
			PHALA_CLOUD_API_KEY: "token-from-env",
		});
		await runCli(
			logsCommand,
			[
				"logs",
				"--cvm-id",
				CVM_ID,
				"--serial",
				"--api-token",
				"token-from-flag",
			],
			{ PHALA_CLOUD_API_KEY: "token-from-env" },
		);
		const keys = fakeA.requests
			.filter((r) => r.path.startsWith("/api/"))
			.map((r) => r.apiKey);
		expect(keys).toContain("token-from-env");
		expect(keys).toContain("token-from-flag");
		expect(keys).not.toContain(TOKEN.A);
	});

	test("PHALA_CLOUD_PROFILE selects the profile for log commands", async () => {
		const { code } = await runCli(
			logsCommand,
			["logs", "--cvm-id", CVM_ID, "--serial"],
			{
				PHALA_CLOUD_PROFILE: "B",
			},
		);
		expect(code).toBe(0);
		expectOnlyProfileB();
	});
});

describe("CVM not found names the profile that was used", () => {
	test("phala logs against a profile without the CVM", async () => {
		const { code, stderr } = await runCli(logsCommand, [
			"logs",
			"--cvm-id",
			CVM_ID,
			"--profile",
			"A",
		]);
		expect(code).toBe(1);
		expect(stderr).toContain("HTTP: 404");
		expect(stderr).toContain("Profile: A");
		expect(stderr).toContain(`API: ${fakeA.prefix}`);
		expect(stderr).not.toContain(TOKEN.A);
	});

	test("phala cvms attestation reports the stored default profile", async () => {
		const { code, stderr } = await runCli(cvmsAttestationCommand, [
			"cvms",
			"attestation",
			CVM_ID,
		]);
		expect(code).toBe(1);
		expect(stderr).toContain("Profile: A");
	});
});
