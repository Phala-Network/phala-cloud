import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	test,
} from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandContext } from "@/src/core/types";
import { normalizeCliError } from "@/src/utils/logger";
import { RequestError } from "@phala/cloud";

const realClient = await import(
	`${require.resolve("@/src/lib/client")}?domains-real`
);
const realInquirer = await import(
	`${require.resolve("inquirer")}?domains-real`
);

const realCloud = await import(
	`${require.resolve("@phala/cloud")}?domains-real`
);

const getCvm =
	mock<
		(
			client: unknown,
			request: unknown,
		) => Promise<{ success: boolean; data?: unknown; error?: unknown }>
	>();
const get = mock<(path: string, options?: unknown) => Promise<unknown>>();
const post = mock<(path: string, body?: unknown) => Promise<unknown>>();
const del = mock<(path: string) => Promise<unknown>>();
const prompt = mock(() => Promise.resolve({ confirm: true }));

mock.module("@/src/lib/client", () => ({
	...realClient,
	getClient: mock(() => Promise.resolve({ get, post, delete: del })),
}));
mock.module("inquirer", () => ({
	...realInquirer,
	default: { prompt },
}));
mock.module("@phala/cloud", () => ({
	...realCloud,
	safeGetCvmInfo: getCvm,
}));

afterAll(() => {
	mock.module("@phala/cloud", () => ({ ...realCloud }));
	mock.module("@/src/lib/client", () => ({ ...realClient }));
	mock.module("inquirer", () => ({ ...realInquirer }));
});

const { domainsLsCommand } = await import("./ls");
const { domainsInspectCommand } = await import("./inspect");
const { domainsCheckCommand } = await import("./check");
const { domainsAddCommand } = await import("./add");
const { domainsVerifyCommand } = await import("./verify");
const { domainsRmCommand } = await import("./rm");
const { domainsSetupCommand } = await import("./setup");
const { domainsLsCommandSchema } = await import("./ls/command");
const { domainsInspectCommandSchema } = await import("./inspect/command");
const { domainsCheckCommandSchema } = await import("./check/command");
const { domainsAddCommandSchema } = await import("./add/command");
const { domainsVerifyCommandSchema } = await import("./verify/command");
const { domainsRmCommandSchema } = await import("./rm/command");
const { domainsSetupCommandSchema } = await import("./setup/command");

const APP_A = "a".repeat(40);
const APP_B = "b".repeat(40);

const record = {
	record_type: "CNAME",
	query_name: "app.example.com",
	expected_value: "gateway.dstack.example.net",
};

function binding(overrides: Record<string, unknown> = {}) {
	return {
		id: "dom_1",
		domain: "app.example.com",
		port: 443,
		dns_verified_at: null,
		dns_error: null,
		routing_status: null,
		routing_checked_at: null,
		dns_zone: null,
		dns_provider: null,
		created_at: "2026-11-01T00:00:00Z",
		expected_records: [record],
		app_id: APP_A,
		app_name: "demo",
		...overrides,
	};
}

function page(items: unknown[], extra: Record<string, unknown> = {}) {
	return {
		items,
		page: 1,
		page_size: 20,
		total: items.length,
		total_pages: 1,
		...extra,
	};
}

const check = {
	record_type: "CNAME",
	query_name: "app.example.com",
	expected_value: "gateway.dstack.example.net",
	actual_value: null,
	is_valid: false,
	warning_message: null,
};

interface Captured {
	stdout: string;
	stderr: string;
	success: unknown[];
	failed: Array<{ message: string; details?: unknown }>;
	errors: string[];
}

function makeContext(
	overrides: Partial<CommandContext> & { isTTY?: boolean } = {},
): { context: CommandContext; out: Captured } {
	const out: Captured = {
		stdout: "",
		stderr: "",
		success: [],
		failed: [],
		errors: [],
	};
	const { isTTY, ...rest } = overrides;
	const context = {
		argv: [],
		rawFlags: {},
		rawPositionals: [],
		cwd: process.cwd(),
		env: process.env,
		stdout: {
			write: (text: string) => {
				out.stdout += text;
				return true;
			},
		},
		stderr: { write: () => true },
		stdin: { isTTY: isTTY === true },
		projectConfig: {},
		success: (data: unknown) => out.success.push(data),
		fail: (message: string, details?: unknown) =>
			out.failed.push({ message, details }),
		failWithError: (error: unknown) =>
			out.errors.push(normalizeCliError(error).message),
		...rest,
	} as unknown as CommandContext;
	return { context, out };
}

function httpError(
	status: number,
	data: unknown,
	headers: Record<string, string> = {},
): RequestError {
	const detail = (data as { detail?: string }).detail ?? "failed";
	return new RequestError(detail, {
		status,
		statusText: "Error",
		data,
		detail,
		response: { headers: new Headers(headers) } as never,
	});
}

beforeEach(() => {
	for (const fn of [get, post, del, prompt, getCvm]) fn.mockReset();
	prompt.mockImplementation(() => Promise.resolve({ confirm: true }));
});

describe("domains ls", () => {
	test("lists the workspace and prints every value in full", async () => {
		const long = `${"deep.".repeat(10)}example.com`;
		get.mockResolvedValue(
			page(
				[binding({ domain: long, dns_verified_at: "x", routing_status: "ok" })],
				{
					total: 45,
					total_pages: 3,
				},
			),
		);
		const { context, out } = makeContext();
		const code = await domainsLsCommand.run(
			domainsLsCommandSchema.parse({
				appId: `0x${APP_A.toUpperCase()}`,
				page: 2,
				pageSize: 20,
			}),
			context,
		);
		expect(code).toBe(0);
		// The prefix is stripped but the case is kept: the server matches app
		// IDs exactly, and mixed-case IDs exist.
		expect(get).toHaveBeenCalledWith("/domains", {
			params: { page: 2, page_size: 20, app_id: APP_A.toUpperCase() },
		});
		expect(out.stdout).toContain(long);
		expect(out.stdout).toContain(`demo (${APP_A})`);
		expect(out.stdout).toContain("verified");
		expect(out.stdout).toContain("Page 1 of 3 (45 domains)");
		expect(out.stdout).not.toContain("...");
	});

	test("--json returns the page", async () => {
		get.mockResolvedValue(page([binding()]));
		const { context, out } = makeContext();
		await domainsLsCommand.run(
			domainsLsCommandSchema.parse({ json: true }),
			context,
		);
		expect((out.success[0] as { total: number }).total).toBe(1);
	});
});

describe("domains inspect", () => {
	test("shows records and the app guide, and survives a missing guide", async () => {
		get.mockImplementation((path) =>
			path === "/domains"
				? Promise.resolve(page([binding({ dns_error: "CNAME not found" })]))
				: Promise.resolve({
						gateway_domain_suffix: "dstack.example.net",
						app_id: APP_A,
						txt_required: true,
						ingress_configured: false,
					}),
		);
		const { context, out } = makeContext();
		const code = await domainsInspectCommand.run(
			domainsInspectCommandSchema.parse({ domain: "App.Example.com." }),
			context,
		);
		expect(code).toBe(0);
		expect(get).toHaveBeenCalledWith("/domains", {
			params: { domain: "app.example.com", page_size: 100 },
		});
		expect(out.stdout).toContain("error (CNAME not found)");
		expect(out.stdout).toContain("gateway.dstack.example.net");
		expect(out.stdout).toContain("TXT required:    yes");

		get.mockImplementation((path) =>
			path === "/domains"
				? Promise.resolve(page([binding()]))
				: Promise.reject(httpError(422, { detail: "route not ready" })),
		);
		const second = makeContext();
		const secondCode = await domainsInspectCommand.run(
			domainsInspectCommandSchema.parse({ domain: "app.example.com" }),
			second.context,
		);
		expect(secondCode).toBe(0);
		expect(second.out.stdout).toContain("App DNS guide unavailable");
	});

	test("an unknown domain is reported", async () => {
		get.mockResolvedValue(page([]));
		const { context, out } = makeContext();
		const code = await domainsInspectCommand.run(
			domainsInspectCommandSchema.parse({ domain: "nope.example.com" }),
			context,
		);
		expect(code).toBe(1);
		expect(out.errors[0]).toContain("was not found in this workspace");
	});
});

describe("domains check", () => {
	test("posts a preflight with the default port and prints actual vs expected", async () => {
		post.mockResolvedValue({
			domain: "app.example.com",
			port: 443,
			is_valid: false,
			records: [{ ...check, actual_value: "old.example.org" }],
		});
		const { context, out } = makeContext({ projectConfig: { app_id: APP_A } });
		const code = await domainsCheckCommand.run(
			domainsCheckCommandSchema.parse({ domain: "app.example.com" }),
			context,
		);
		expect(code).toBe(0);
		expect(post).toHaveBeenCalledWith(`/apps/${APP_A}/domains/preflight`, {
			domain: "app.example.com",
			port: 443,
		});
		expect(out.stdout).toContain("expected: gateway.dstack.example.net");
		expect(out.stdout).toContain("actual:   old.example.org");
		expect(out.stdout).toContain("[fail]");
		// DNS alone does not block binding.
		expect(out.stdout).toContain("can be bound; DNS is not ready yet");
		expect(out.stdout).toContain("Next: phala domains add app.example.com");
	});

	test("a failed platform row says the domain cannot be bound, with no next step", async () => {
		post.mockResolvedValue({
			domain: "app.example.com",
			port: 443,
			is_valid: false,
			records: [
				{ ...check, is_valid: true },
				{
					record_type: "platform",
					query_name: "app.example.com",
					expected_value: "The domain can be bound to this app",
					actual_value: "Registered in your account",
					is_valid: false,
					warning_message: "This domain is already bound in your account",
				},
			],
		});
		const { context, out } = makeContext({ projectConfig: { app_id: APP_A } });
		const code = await domainsCheckCommand.run(
			domainsCheckCommandSchema.parse({ domain: "app.example.com" }),
			context,
		);
		expect(code).toBe(0);
		expect(out.stdout).toContain(
			"app.example.com (port 443): cannot be bound to this app",
		);
		expect(out.stdout).not.toContain("DNS is not ready");
		expect(out.stdout).not.toContain("Next:");
	});

	test("needs an app id from the flag or phala.toml", async () => {
		const { context, out } = makeContext();
		const code = await domainsCheckCommand.run(
			domainsCheckCommandSchema.parse({ domain: "app.example.com" }),
			context,
		);
		expect(code).toBe(1);
		expect(out.errors[0]).toContain("No app ID provided");
		expect(post).not.toHaveBeenCalled();
	});
});

describe("domains add", () => {
	test("creates the binding and prints the records to publish", async () => {
		post.mockResolvedValue({
			...binding(),
			sync: { nodes: [], warnings: ["node usw5 is slow"] },
		});
		const { context, out } = makeContext();
		const code = await domainsAddCommand.run(
			domainsAddCommandSchema.parse({
				domain: "app.example.com",
				appId: APP_A,
				port: 8443,
			}),
			context,
		);
		expect(code).toBe(0);
		expect(post).toHaveBeenCalledWith(`/apps/${APP_A}/domains`, {
			domain: "app.example.com",
			port: 8443,
		});
		expect(out.stdout).toContain("gateway.dstack.example.net");
		expect(out.stdout).toContain("node usw5 is slow");
		expect(out.stdout).toContain("phala domains verify app.example.com");
	});

	test("a 409 shows the server's message", async () => {
		post.mockRejectedValue(
			httpError(409, { detail: "Domain is registered by another workspace" }),
		);
		const { context, out } = makeContext();
		const code = await domainsAddCommand.run(
			domainsAddCommandSchema.parse({
				domain: "app.example.com",
				appId: APP_A,
			}),
			context,
		);
		expect(code).toBe(1);
		expect(out.errors[0]).toBe("Domain is registered by another workspace");
	});

	test("a 404 says the app or domain was not found", async () => {
		post.mockRejectedValue(httpError(404, { detail: "no such app" }));
		const { context, out } = makeContext();
		await domainsAddCommand.run(
			domainsAddCommandSchema.parse({
				domain: "app.example.com",
				appId: APP_A,
			}),
			context,
		);
		expect(out.errors[0]).toBe("App or domain not found");
	});

	test("a 429 with a browser challenge explains the limit and the wait", async () => {
		post.mockRejectedValue(
			httpError(
				429,
				{ detail: "slow down", turnstile_required: true },
				{ "Retry-After": "42" },
			),
		);
		const { context, out } = makeContext();
		await domainsAddCommand.run(
			domainsAddCommandSchema.parse({
				domain: "app.example.com",
				appId: APP_A,
			}),
			context,
		);
		expect(out.errors[0]).toContain("domain lookup limit");
		expect(out.errors[0]).toContain("42 second(s)");
		expect(out.errors[0]).toContain("dashboard");
	});

	test("a plain 429 asks to wait for Retry-After", async () => {
		post.mockRejectedValue(
			httpError(429, { detail: "slow down", retry_after: 7 }),
		);
		const { context, out } = makeContext();
		await domainsAddCommand.run(
			domainsAddCommandSchema.parse({
				domain: "app.example.com",
				appId: APP_A,
			}),
			context,
		);
		expect(out.errors[0]).toBe(
			"Too many domain requests. Wait 7 second(s) and try again.",
		);
	});
});

describe("domains verify", () => {
	const verified = {
		...binding(),
		dns_verified_at: "2026-11-02T00:00:00Z",
		records: [
			{ ...check, is_valid: true, actual_value: "gateway.dstack.example.net" },
		],
	};

	test("resolves the single binding, then verifies it", async () => {
		get.mockResolvedValue(page([binding()]));
		post.mockResolvedValue(verified);
		const { context, out } = makeContext();
		const code = await domainsVerifyCommand.run(
			domainsVerifyCommandSchema.parse({ domain: "app.example.com" }),
			context,
		);
		expect(code).toBe(0);
		expect(post).toHaveBeenCalledWith(
			`/apps/${APP_A}/domains/dom_1/verify`,
			{},
		);
		expect(out.stdout).toContain("app.example.com is verified.");
	});

	test("no binding: fails without calling verify", async () => {
		get.mockResolvedValue(page([]));
		const { context, out } = makeContext();
		const code = await domainsVerifyCommand.run(
			domainsVerifyCommandSchema.parse({ domain: "app.example.com" }),
			context,
		);
		expect(code).toBe(1);
		expect(out.errors[0]).toContain("was not found");
		expect(post).not.toHaveBeenCalled();
	});

	test("several bindings: asks for --app-id and lists the apps", async () => {
		get.mockResolvedValue(
			page([
				binding(),
				binding({ id: "dom_2", app_id: APP_B, app_name: "other" }),
			]),
		);
		const { context, out } = makeContext();
		const code = await domainsVerifyCommand.run(
			domainsVerifyCommandSchema.parse({ domain: "app.example.com" }),
			context,
		);
		expect(code).toBe(1);
		expect(out.errors[0]).toContain("Pass --app-id");
		expect(out.errors[0]).toContain(APP_B);
		expect(post).not.toHaveBeenCalled();
	});

	test("--app-id narrows the lookup", async () => {
		get.mockResolvedValue(page([binding({ id: "dom_2", app_id: APP_B })]));
		post.mockResolvedValue(verified);
		const { context } = makeContext();
		await domainsVerifyCommand.run(
			domainsVerifyCommandSchema.parse({
				domain: "app.example.com",
				appId: APP_B,
			}),
			context,
		);
		expect(get).toHaveBeenCalledWith("/domains", {
			params: { domain: "app.example.com", page_size: 100, app_id: APP_B },
		});
		expect(post).toHaveBeenCalledWith(
			`/apps/${APP_B}/domains/dom_2/verify`,
			{},
		);
	});
});

describe("domains rm", () => {
	const removed = { ...binding(), sync: { nodes: [], warnings: [] } };

	beforeEach(() => {
		get.mockResolvedValue(page([binding()]));
		del.mockResolvedValue(removed);
	});

	test("without --yes and without a terminal it refuses and deletes nothing", async () => {
		const { context, out } = makeContext({ isTTY: false });
		const code = await domainsRmCommand.run(
			domainsRmCommandSchema.parse({ domain: "app.example.com" }),
			context,
		);
		expect(code).toBe(1);
		expect(out.failed[0]?.message).toContain("without confirmation");
		expect(prompt).not.toHaveBeenCalled();
		expect(del).not.toHaveBeenCalled();
	});

	test("in a terminal it asks first; declining deletes nothing", async () => {
		prompt.mockImplementation(() => Promise.resolve({ confirm: false }));
		const { context, out } = makeContext({ isTTY: true });
		const code = await domainsRmCommand.run(
			domainsRmCommandSchema.parse({ domain: "app.example.com" }),
			context,
		);
		expect(code).toBe(0);
		expect(prompt).toHaveBeenCalledTimes(1);
		expect(del).not.toHaveBeenCalled();
		expect(out.stdout).toContain("Nothing was removed");
	});

	test("confirming deletes the binding", async () => {
		const { context } = makeContext({ isTTY: true });
		await domainsRmCommand.run(
			domainsRmCommandSchema.parse({ domain: "app.example.com" }),
			context,
		);
		expect(del).toHaveBeenCalledWith(`/apps/${APP_A}/domains/dom_1`);
	});

	test("--yes skips the prompt even without a terminal", async () => {
		const { context, out } = makeContext({ isTTY: false });
		const code = await domainsRmCommand.run(
			domainsRmCommandSchema.parse({ domain: "app.example.com", yes: true }),
			context,
		);
		expect(code).toBe(0);
		expect(prompt).not.toHaveBeenCalled();
		expect(del).toHaveBeenCalledTimes(1);
		expect(out.stdout).toContain("Removed app.example.com");
	});

	test("--json never prompts, even in a terminal", async () => {
		const { context } = makeContext({ isTTY: true });
		const code = await domainsRmCommand.run(
			domainsRmCommandSchema.parse({ domain: "app.example.com", json: true }),
			context,
		);
		expect(code).toBe(1);
		expect(prompt).not.toHaveBeenCalled();
		expect(del).not.toHaveBeenCalled();
	});
});

describe("domains setup", () => {
	const compose = "# stack\nservices:\n  app:\n    image: nginx # web\n";
	const merge = {
		docker_compose_file: "ignored",
		already_configured: false,
		required_env_keys: ["CLOUDFLARE_API_TOKEN"],
		warnings: ["check your CAA records"],
		ingress_service_name: "dstack-ingress",
		ingress_service: { image: "dstacktee/dstack-ingress:latest" },
		top_level_volumes: { "cert-data": {} },
	};
	let dir: string;
	let file: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "phala-domains-"));
		file = join(dir, "docker-compose.yml");
		writeFileSync(file, compose);
		post.mockResolvedValue(merge);
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	function run(extra: Record<string, unknown>, isTTY: boolean) {
		const { context, out } = makeContext({ cwd: dir, isTTY });
		const promise = domainsSetupCommand.run(
			domainsSetupCommandSchema.parse({
				domain: "app.example.com",
				appId: APP_A,
				...extra,
			}),
			context,
		);
		return { promise, out };
	}

	test("sends the local compose text to ingress-merge", async () => {
		const { promise } = run({ yes: true }, false);
		await promise;
		expect(post).toHaveBeenCalledWith(`/apps/${APP_A}/domains/ingress-merge`, {
			domain: "app.example.com",
			port: 443,
			dns_provider: "cloudflare",
			docker_compose_file: compose,
		});
	});

	test("--yes writes the sidecar, keeps comments, and prints the diff and env keys", async () => {
		const { promise, out } = run({ yes: true }, false);
		expect(await promise).toBe(0);
		const written = readFileSync(file, "utf8");
		expect(written).toContain("# stack");
		expect(written).toContain("image: nginx # web");
		expect(written).toContain("  dstack-ingress:");
		expect(written).toContain("volumes:\n  cert-data:");
		expect(out.stdout).toContain("+  dstack-ingress:");
		expect(out.stdout).toContain("CLOUDFLARE_API_TOKEN");
		expect(out.stdout).toContain("check your CAA records");
		expect(out.stdout).toContain("phala envs");
		expect(out.stdout).toContain("phala deploy");
	});

	test("names a compose file outside the working directory by its absolute path", async () => {
		const elsewhere = mkdtempSync(join(tmpdir(), "phala-domains-cwd-"));
		try {
			const { context, out } = makeContext({ cwd: elsewhere, isTTY: false });
			const code = await domainsSetupCommand.run(
				domainsSetupCommandSchema.parse({
					domain: "app.example.com",
					appId: APP_A,
					compose: file,
					yes: true,
				}),
				context,
			);
			expect(code).toBe(0);
			expect(out.stdout).toContain(`Updated ${file}.`);
			expect(out.stdout).not.toContain("../");
		} finally {
			rmSync(elsewhere, { recursive: true, force: true });
		}
	});

	test("already configured: nothing is written", async () => {
		post.mockResolvedValue({ ...merge, already_configured: true });
		const { promise, out } = run({ yes: true }, false);
		expect(await promise).toBe(0);
		expect(readFileSync(file, "utf8")).toBe(compose);
		expect(out.stdout).toContain("already has dstack-ingress configured");
	});

	test("without --yes and without a terminal: prints the diff, exits non-zero, writes nothing", async () => {
		const { promise, out } = run({}, false);
		expect(await promise).toBe(1);
		expect(readFileSync(file, "utf8")).toBe(compose);
		expect(out.stdout).toContain("+  dstack-ingress:");
		expect(out.failed[0]?.message).toContain("--yes");
		expect(prompt).not.toHaveBeenCalled();
	});

	test("in a terminal the file changes only after confirmation", async () => {
		prompt.mockImplementation(() => Promise.resolve({ confirm: false }));
		const declined = run({}, true);
		expect(await declined.promise).toBe(0);
		expect(readFileSync(file, "utf8")).toBe(compose);

		prompt.mockImplementation(() => Promise.resolve({ confirm: true }));
		const accepted = run({}, true);
		expect(await accepted.promise).toBe(0);
		expect(readFileSync(file, "utf8")).toContain("dstack-ingress:");
	});

	test("an existing volume is not declared twice", async () => {
		writeFileSync(file, `${compose}volumes:\n  cert-data:\n`);
		const { promise } = run({ yes: true }, false);
		await promise;
		expect(readFileSync(file, "utf8").match(/cert-data:/g)?.length).toBe(1);
	});

	test("uses compose_file from phala.toml when --compose is absent", async () => {
		const custom = join(dir, "stack.yml");
		writeFileSync(custom, compose);
		const { context } = makeContext({
			cwd: dir,
			projectConfig: { compose_file: "stack.yml" },
		});
		await domainsSetupCommand.run(
			domainsSetupCommandSchema.parse({
				domain: "app.example.com",
				appId: APP_A,
				yes: true,
			}),
			context,
		);
		expect(readFileSync(custom, "utf8")).toContain("dstack-ingress:");
		expect(readFileSync(file, "utf8")).toBe(compose);
	});
});

describe("--cvm-id", () => {
	const MIXED = `${"aB".repeat(10)}${"cD".repeat(10)}`;

	function cvmIs(appId: string | null) {
		getCvm.mockResolvedValue({ success: true, data: { app_id: appId } });
	}

	test("add resolves the CVM to its app ID and keeps the case", async () => {
		cvmIs(MIXED);
		post.mockResolvedValue({
			...binding({ app_id: MIXED }),
			sync: { nodes: [], warnings: [] },
		});
		const { context } = makeContext();
		const code = await domainsAddCommand.run(
			domainsAddCommandSchema.parse({
				domain: "app.example.com",
				cvmId: "my-cvm",
			}),
			context,
		);
		expect(code).toBe(0);
		expect(getCvm.mock.calls[0]?.[1]).toEqual({ id: "my-cvm" });
		expect(post).toHaveBeenCalledWith(`/apps/${MIXED}/domains`, {
			domain: "app.example.com",
			port: 443,
		});
	});

	test("check resolves the CVM to its app ID", async () => {
		cvmIs(`app_${MIXED}`);
		post.mockResolvedValue({
			domain: "app.example.com",
			port: 443,
			ready: true,
			records: [],
		});
		const { context } = makeContext();
		await domainsCheckCommand.run(
			domainsCheckCommandSchema.parse({
				domain: "app.example.com",
				cvmId: "my-cvm",
			}),
			context,
		);
		expect(post.mock.calls[0]?.[0]).toBe(`/apps/${MIXED}/domains/preflight`);
	});

	test("setup resolves the CVM to its app ID", async () => {
		const dir = mkdtempSync(join(tmpdir(), "phala-domains-cvm-"));
		try {
			writeFileSync(
				join(dir, "docker-compose.yml"),
				"services:\n  a:\n    image: x\n",
			);
			cvmIs(MIXED);
			post.mockResolvedValue({
				docker_compose_file: "ignored",
				already_configured: true,
				required_env_keys: [],
				warnings: [],
				ingress_service_name: "dstack-ingress",
				ingress_service: {},
				top_level_volumes: {},
			});
			const { context } = makeContext({ cwd: dir });
			await domainsSetupCommand.run(
				domainsSetupCommandSchema.parse({
					domain: "app.example.com",
					cvmId: "my-cvm",
					yes: true,
				}),
				context,
			);
			expect(post.mock.calls[0]?.[0]).toBe(
				`/apps/${MIXED}/domains/ingress-merge`,
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("ls, verify and rm narrow by the CVM's app", async () => {
		cvmIs(APP_B);
		get.mockResolvedValue(page([binding({ app_id: APP_B })]));
		post.mockResolvedValue({ ...binding(), records: [] });
		del.mockResolvedValue({ ...binding(), sync: { nodes: [], warnings: [] } });

		await domainsLsCommand.run(
			domainsLsCommandSchema.parse({ cvmId: "c" }),
			makeContext().context,
		);
		expect(get.mock.calls.at(-1)).toEqual([
			"/domains",
			{ params: { app_id: APP_B } },
		]);

		await domainsVerifyCommand.run(
			domainsVerifyCommandSchema.parse({
				domain: "app.example.com",
				cvmId: "c",
			}),
			makeContext().context,
		);
		expect(get.mock.calls.at(-1)?.[1]).toMatchObject({
			params: { app_id: APP_B },
		});
		expect(post.mock.calls.at(-1)?.[0]).toContain(`/apps/${APP_B}/`);

		await domainsRmCommand.run(
			domainsRmCommandSchema.parse({
				domain: "app.example.com",
				cvmId: "c",
				yes: true,
			}),
			makeContext().context,
		);
		expect(get.mock.calls.at(-1)?.[1]).toMatchObject({
			params: { app_id: APP_B },
		});
		expect(del).toHaveBeenCalled();
	});

	test("both flags are an error and nothing is sent", async () => {
		const { context, out } = makeContext();
		const code = await domainsAddCommand.run(
			domainsAddCommandSchema.parse({
				domain: "app.example.com",
				appId: APP_A,
				cvmId: "my-cvm",
			}),
			context,
		);
		expect(code).toBe(1);
		expect(out.errors[0]).toContain("Pass one of --app-id or --cvm-id");
		expect(getCvm).not.toHaveBeenCalled();
		expect(post).not.toHaveBeenCalled();
	});

	test("phala.toml with only a CVM identifier resolves through the CVM", async () => {
		cvmIs(APP_B);
		post.mockResolvedValue({
			...binding(),
			sync: { nodes: [], warnings: [] },
		});
		const { context } = makeContext({
			projectConfig: { cvm_id: "app_cfg" } as never,
		});
		await domainsAddCommand.run(
			domainsAddCommandSchema.parse({ domain: "app.example.com" }),
			context,
		);
		expect(getCvm.mock.calls[0]?.[1]).toEqual({ id: "app_cfg" });
		expect(post.mock.calls[0]?.[0]).toBe(`/apps/${APP_B}/domains`);
	});

	test("phala.toml app_id wins over its CVM identifier", async () => {
		post.mockResolvedValue({
			...binding(),
			sync: { nodes: [], warnings: [] },
		});
		const { context } = makeContext({
			projectConfig: { app_id: APP_A, cvm_id: "app_cfg" } as never,
		});
		await domainsAddCommand.run(
			domainsAddCommandSchema.parse({ domain: "app.example.com" }),
			context,
		);
		expect(getCvm).not.toHaveBeenCalled();
		expect(post.mock.calls[0]?.[0]).toBe(`/apps/${APP_A}/domains`);
	});

	test("an unknown CVM is an error", async () => {
		getCvm.mockResolvedValue({
			success: false,
			error: httpError(404, { detail: "nope" }),
		});
		const { context, out } = makeContext();
		const code = await domainsAddCommand.run(
			domainsAddCommandSchema.parse({
				domain: "app.example.com",
				cvmId: "ghost",
			}),
			context,
		);
		expect(code).toBe(1);
		expect(out.errors[0]).toBe("CVM ghost was not found.");
		expect(post).not.toHaveBeenCalled();
	});

	test("a CVM without an app ID is an error", async () => {
		cvmIs(null);
		const { context, out } = makeContext();
		const code = await domainsAddCommand.run(
			domainsAddCommandSchema.parse({
				domain: "app.example.com",
				cvmId: "bare",
			}),
			context,
		);
		expect(code).toBe(1);
		expect(out.errors[0]).toBe("CVM bare has no app ID.");
	});
});
