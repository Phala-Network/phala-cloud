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
import {
	concatHex,
	encodeEventTopics,
	getAddress,
	keccak256,
	parseAbi,
	parseSignature,
	stringToHex,
	toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { deployCommandMeta } from "./command";
import { parseCommandArguments } from "@/src/core/parser";
import {
	getChainFinalityEtaSeconds,
	getFinalityTimeoutMs,
} from "@/src/utils/finality";
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
	search: string;
	body: Record<string, unknown> | undefined;
};

const COMPOSE = "services:\n  app:\n    image: nginx\n";
const APP_COMPOSE = JSON.stringify({
	name: "raw",
	docker_compose_file: COMPOSE,
	secure_time: true,
});
const LAUNCH_TOKEN = "t".repeat(32);
const PRIVATE_KEY = `0x${"0".repeat(63)}1` as const;
const APP_ID = getAddress(`0x${"aa".repeat(20)}`);
const KMS_CONTRACT = `0x${"bb".repeat(20)}` as const;
const TX_HASH = `0x${"cc".repeat(32)}` as const;
const COMPOSE_HASH = "dd".repeat(32);
const DEVICE_ID = "ee".repeat(16);
const REGISTERED_BLOCK = 39000000;
const DEPLOYER = privateKeyToAccount(PRIVATE_KEY).address;
const KMS_INFO = {
	id: "kms_test",
	slug: "base-test",
	url: "https://kms.example.com",
	version: "0.6.5",
	chain_id: 8453,
	kms_contract_address: KMS_CONTRACT,
	gateway_app_id: null,
	// Compressed secp256k1 public key for the fixture signing key.
	k256_pubkey:
		"0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
};
const CREATE_FINALITY = {
	operation: "create",
	correlation_id: "create-correlation-exact",
	phase: "awaiting_finality",
	stage: "submitted",
	transaction: {
		hash: TX_HASH,
		block_number: REGISTERED_BLOCK,
		chain_id: 8453,
	},
	finality: {
		block_tag: "finalized",
		policy_block_number: null,
		blocks_remaining: null,
		eta_seconds: 1235,
	},
};
const REGISTERED_EVENT_TOPICS = encodeEventTopics({
	abi: parseAbi([
		"event AppDeployedViaFactory(address indexed appId, address indexed deployer)",
	]),
	args: { appId: APP_ID, deployer: DEPLOYER },
});

const RPC_RESULTS: Record<string, unknown> = {
	eth_chainId: toHex(8453),
	eth_getBalance: toHex(10n ** 18n),
	eth_getCode: "0x1234",
	eth_getTransactionCount: "0x0",
	eth_getBlockByNumber: { baseFeePerGas: "0x1" },
	eth_maxPriorityFeePerGas: "0x1",
	eth_gasPrice: "0x1",
	eth_estimateGas: "0x100000",
	eth_sendRawTransaction: TX_HASH,
	eth_getTransactionReceipt: {
		transactionHash: TX_HASH,
		blockHash: `0x${"11".repeat(32)}`,
		blockNumber: toHex(REGISTERED_BLOCK),
		from: DEPLOYER,
		to: KMS_CONTRACT,
		status: "0x1",
		gasUsed: "0x1",
		logs: [
			{ address: KMS_CONTRACT, topics: REGISTERED_EVENT_TOPICS, data: "0x" },
		],
	},
};

async function signedPubkey(key = `0x${"11".repeat(32)}` as const) {
	const hash = keccak256(
		concatHex([stringToHex("dstack-env-encrypt-pubkey:"), APP_ID, key]),
	);
	const signed = parseSignature(
		await privateKeyToAccount(PRIVATE_KEY).sign({ hash }),
	);
	return {
		public_key: key.slice(2),
		signature: concatHex([
			signed.r,
			signed.s,
			toHex(signed.yParity, { size: 1 }),
		]).slice(2),
	};
}

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
			// Same release as the next entry; --dev must prefer the one without GPU.
			name: "dstack-nvidia-0.6.3",
			slug: "dstack-nvidia-0.6.3",
			version: "0.6.3",
			os_image_hash: "ee".repeat(32),
			is_dev: false,
			requires_gpu: true,
		},
		{
			name: "dstack-0.6.3",
			slug: "dstack-0.6.3",
			version: "0.6.3",
			os_image_hash: "ff".repeat(32),
			is_dev: false,
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
let stderr = "";
// Per-test response for GET requests (CVM info, operations); defaults to 404.
let osImagesResponse: unknown = OS_IMAGES;
let respondGet: ((path: string) => Response) | undefined;
let provisionOverride: Record<string, unknown> | undefined;
let prepareError: Response | undefined;
let commitOverride: Record<string, unknown> | undefined;
let respondCommit: (() => Response | Promise<Response>) | undefined;
let rpcCalls: string[] = [];

beforeAll(async () => {
	server = Bun.serve({
		port: 0,
		async fetch(req) {
			const url = new URL(req.url);
			const text = await req.text();
			const body = text ? JSON.parse(text) : undefined;
			if (url.pathname === "/mock-rpc") {
				const { method, id } = body;
				rpcCalls.push(method);
				return Response.json({
					jsonrpc: "2.0",
					id,
					...(Object.prototype.hasOwnProperty.call(RPC_RESULTS, method)
						? { result: RPC_RESULTS[method] }
						: { error: { code: -32601, message: "Method not found" } }),
				});
			}
			requests.push({
				method: req.method,
				path: url.pathname,
				search: url.search,
				body,
			});
			if (req.method === "POST" && url.pathname === "/api/v1/cvms") {
				// Commit carries the prepare token; prepare does not.
				return body?.token
					? (respondCommit?.() ??
							Response.json(
								{
									...CREATED_CVM,
									launch_token: LAUNCH_TOKEN,
									...commitOverride,
								},
								{
									status:
										commitOverride?.status === "awaiting_finality" ? 202 : 200,
								},
							))
					: (prepareError ??
							Response.json({
								app_id: "abc",
								app_env_encrypt_pubkey: "11".repeat(32),
								compose_hash: "hash-1",
								token: "prepare-token",
								...provisionOverride,
							}));
			}
			if (req.method === "GET" && url.pathname === "/api/v1/os-images") {
				return Response.json(osImagesResponse);
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

// `--dev-os` writes the dev box into the compose file it deploys; every test
// starts from the original.
beforeEach(async () => {
	await fs.writeFile(composePath, COMPOSE);
});

afterEach(() => {
	requests = [];
	stdout = "";
	stderr = "";
	respondGet = undefined;
	osImagesResponse = OS_IMAGES;
	provisionOverride = undefined;
	prepareError = undefined;
	commitOverride = undefined;
	respondCommit = undefined;
	rpcCalls = [];
});

async function deploy(input: Record<string, unknown>, argv: string[] = []) {
	let failure: unknown;
	const context = {
		env: {
			PHALA_CLOUD_API_KEY: "test-key",
			PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}/api/v1`,
			PHALA_CLOUD_DIR: tmpDir,
			PHALA_CLOUD_REQUESTS_PER_MINUTE: "60000",
		},
		rawFlags: parseCommandArguments(argv, deployCommandMeta.options).flags,
		projectConfig: {},
		globalOptions: { timeout: 1 },
		cvmId: undefined,
		stdout: {
			write: (chunk: string) => {
				stdout += chunk;
				return true;
			},
		},
		stderr: {
			write: (chunk: string) => {
				stderr += chunk;
				return true;
			},
		},
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

describe("phala deploy on-chain create finality", () => {
	const rpcUrl = () => `http://127.0.0.1:${server.port}/mock-rpc`;
	const input = () => ({
		compose: composePath,
		kms: "base",
		privateKey: PRIVATE_KEY,
		rpcUrl: rpcUrl(),
	});
	const pubkeyPath = `/api/v1/kms/base-test/pubkey/${APP_ID}`;
	const configureProvision = (existing = false) => {
		provisionOverride = {
			app_id: existing ? APP_ID : null,
			app_env_encrypt_pubkey: existing ? "11".repeat(32) : null,
			compose_hash: COMPOSE_HASH,
			device_id: DEVICE_ID,
			kms_info: KMS_INFO,
		};
	};
	const accept = (stateOnly = false) => {
		commitOverride = {
			app_id: APP_ID,
			status: "awaiting_finality",
			correlation_id: CREATE_FINALITY.correlation_id,
			finality_wait: stateOnly
				? {
						...CREATE_FINALITY,
						transaction: null,
						finality: { ...CREATE_FINALITY.finality, eta_seconds: null },
					}
				: CREATE_FINALITY,
		};
	};
	const commit = () => requests.find((request) => request.body?.token);
	const statusCommand = `phala api '/cvms/${CREATED_CVM.vm_uuid}/operations?correlation_id=${CREATE_FINALITY.correlation_id}'`;
	const completedOperation = () =>
		Response.json({
			items: [
				{
					correlation_id: CREATE_FINALITY.correlation_id,
					status: "completed",
					operation_type: "create",
				},
			],
		});
	const expectRecovery = (failure: unknown) => {
		const message = String(failure);
		expect(message).toContain(`App ID: ${APP_ID}`);
		expect(message).toContain(`App contract: ${APP_ID}`);
		expect(message).toContain(`Registration transaction hash: ${TX_HASH}`);
		expect(message).toContain(`--custom-app-id ${APP_ID}`);
		return message;
	};

	test("uses measured mainnet ETAs and a 45-minute fallback for unknown tags or chains", () => {
		expect(getChainFinalityEtaSeconds(8453, "safe")).toBe(73);
		expect(getChainFinalityEtaSeconds(8453, "finalized")).toBe(1235);
		expect(getChainFinalityEtaSeconds(1, "safe")).toBe(733);
		expect(getChainFinalityEtaSeconds(1, "finalized")).toBe(1117);
		expect(getChainFinalityEtaSeconds(84532, "finalized")).toBeNull();
		expect(getChainFinalityEtaSeconds(1, "unknown-policy")).toBeNull();
		expect(getFinalityTimeoutMs(1235)).toBe(2_135_000);
		expect(getFinalityTimeoutMs(1117)).toBe(2_017_000);
		expect(getFinalityTimeoutMs(null)).toBe(2_700_000);
	});

	test.each([
		[999, DEVICE_ID, "KMS chain ID 999 is not supported by this CLI build."],
		[
			8453,
			null,
			"The provision response did not include the device ID required to register the app on-chain.",
		],
	])(
		"distinguishes unsupported chain %s from missing device %s before signing",
		async (chainId, deviceId, message) => {
			configureProvision();
			provisionOverride = {
				...provisionOverride,
				device_id: deviceId,
				kms_info: { ...KMS_INFO, chain_id: chainId },
			};
			const { exitCode, failure } = await deploy(input());
			expect(exitCode).toBe(1);
			expect(failure).toMatchObject({ message });
			expect(rpcCalls).toEqual([]);
			expect(commit()).toBeUndefined();
		},
	);

	test("submits the actual registration transaction and skips the public key when there is no environment", async () => {
		configureProvision();
		accept();
		const result = await deploy(input());
		expect(result).toEqual({ exitCode: 0, failure: undefined });
		expect(
			rpcCalls.filter((method) => method === "eth_sendRawTransaction"),
		).toHaveLength(1);
		expect(requests.some((request) => request.path === pubkeyPath)).toBe(false);
		expect(commit()?.body).toMatchObject({
			app_id: APP_ID,
			contract_address: APP_ID,
			transaction_hash: TX_HASH,
			kms_id: "base-test",
		});
		expect(commit()?.body).not.toHaveProperty("encrypted_env");
		expect(JSON.parse(stdout)).toMatchObject({
			success: true,
			status: "awaiting_finality",
			correlation_id: CREATE_FINALITY.correlation_id,
			eta_seconds: 1235,
			transaction_hash: TX_HASH,
		});
		expect(JSON.parse(stdout).status_command).toContain(
			`?correlation_id=${CREATE_FINALITY.correlation_id}`,
		);
		expect(stderr).toContain("Registering the app on-chain.");
	});

	test("waits for the exact accepted operation, including apply failure after chain finality", async () => {
		configureProvision();
		accept();
		respondGet = () =>
			Response.json({
				items: [
					{
						correlation_id: "a-different-create",
						status: "completed",
						operation_type: "create",
					},
					{
						correlation_id: CREATE_FINALITY.correlation_id,
						status: "failed",
						operation_type: "create",
						failure_reason: "boot_failed",
						error_message: "The new CVM failed to boot.",
					},
				],
			});
		const { exitCode, failure } = await deploy({ ...input(), wait: true });
		expect(exitCode).toBe(1);
		expect(String(failure)).toContain("The new CVM failed to boot.");
		expect(String(failure)).toContain(statusCommand);
		expect(String(failure)).not.toContain("not submitted");
		expect(stdout).toBe("");
		expect(
			requests.find((request) => request.path.endsWith("/operations"))?.search,
		).toBe(`?correlation_id=${CREATE_FINALITY.correlation_id}`);
	});

	test.each([false, true])(
		"retries and verifies a fresh registration's key with wait=%s",
		async (wait) => {
			configureProvision();
			accept();
			const keyResponse = await signedPubkey();
			let keyReads = 0;
			respondGet = (urlPath) => {
				if (urlPath.endsWith("/operations")) return completedOperation();
				expect(urlPath).toBe(pubkeyPath);
				return ++keyReads === 1
					? Response.json(
							{
								error_code: "ERR-02-023",
								message: "KMS authorization backend unavailable",
							},
							{ status: 502 },
						)
					: Response.json(keyResponse);
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
				const { exitCode, failure } = await deploy({
					...input(),
					wait,
					env: ["SETTINGS=some-value"],
				});
				expect(failure).toBeUndefined();
				expect(exitCode).toBe(0);
				expect(keyReads).toBe(2);
				expect(stderr).toContain(
					"Waiting for the KMS environment encryption public key",
				);
				expect(
					rpcCalls.filter((method) => method === "eth_sendRawTransaction"),
				).toHaveLength(1);
				expect(commit()?.body?.encrypted_env).toEqual(expect.any(String));
				expect(JSON.parse(stdout).status).toBe(
					wait ? "completed" : "awaiting_finality",
				);
				expect(stdout).not.toContain("Waiting for the KMS");
				expect(
					requests.some((request) => request.path.endsWith("/operations")),
				).toBe(wait);
			} finally {
				fastPoll.mockRestore();
			}
		},
	);

	test("preserves the latest API message on deadline and round-trips the secret-free resume flags", async () => {
		configureProvision();
		const firstError = "App registration is not visible yet.";
		const latestError = "KMS RPC failed: authorization backend unavailable.";
		let keyReads = 0;
		respondGet = () => {
			if (++keyReads === 1) {
				return Response.json({ detail: firstError }, { status: 502 });
			}
			if (keyReads === 2) {
				return Response.json(
					{ detail: { error_code: "ERR-02-023", message: latestError } },
					{ status: 503 },
				);
			}
			return new Response(new ReadableStream());
		};
		const nativeTimeout = globalThis.setTimeout;
		const expectedTimeout = getFinalityTimeoutMs(
			getChainFinalityEtaSeconds(8453, "finalized"),
		);
		const shortDeadline = spyOn(globalThis, "setTimeout").mockImplementation(((
			fn,
			delay,
			...args
		) =>
			nativeTimeout(
				fn,
				delay === expectedTimeout ? 250 : delay === 15_000 ? 1 : delay,
				...args,
			)) as typeof setTimeout);
		const env = "SETTINGS=never-print-this";
		const apiToken = "-never-print-the-api-token";
		const flags = [
			"--kms=base",
			"-c",
			composePath,
			"--private-key",
			PRIVATE_KEY,
			`--rpc-url=${rpcUrl()}`,
			"-e",
			env,
			"--env=--settings.env",
			"--env",
			"another env's file",
			"--launch-token",
			LAUNCH_TOKEN,
			`--api-key=${apiToken}`,
			"--no-public-logs",
			"--instance-type",
			"tdx.small",
			"--no-dev-os",
			"--no-json",
			"--wait",
			"--timeout",
			"9",
		];
		try {
			const { exitCode, failure } = await deploy(
				{
					...input(),
					json: false,
					env: [env],
					launchToken: LAUNCH_TOKEN,
					apiToken,
				},
				flags,
			);
			expect(exitCode).toBe(1);
			const message = expectRecovery(failure);
			expect(message).toContain(latestError);
			expect(message).not.toContain(firstError);
			expect(buildJsonCliError(normalizeCliError(failure))).toMatchObject({
				error_code: "ERR-02-023",
				error: expect.stringContaining(
					"Stopped waiting for the KMS environment encryption public key.",
				),
			});
			expect(message).toContain("The CVM was not submitted.");
			expect(message).toContain(
				"No new signature is needed for the original compose hash",
			);
			expect(message).toContain(
				"If the key is still unavailable, wait about 21 min and rerun.",
			);
			const resume = message
				.split("\n")
				.find((line) => line.startsWith("phala deploy "));
			expect(resume).toBeDefined();
			const shell = Bun.spawnSync(
				["sh", "-c", `phala() { printf '%s\\0' "$@"; }; ${resume}`],
				{
					env: {
						PHALA_CLOUD_API_KEY: apiToken,
						PHALA_DEPLOY_LAUNCH_TOKEN: LAUNCH_TOKEN,
						PHALA_DEPLOY_ENV_1: env,
					},
				},
			);
			expect(shell.exitCode).toBe(0);
			const [command, ...argv] = shell.stdout.toString().split("\0");
			expect(command).toBe("deploy");
			const parsed = parseCommandArguments(
				argv.slice(0, -1),
				deployCommandMeta.options,
			);
			const {
				"--private-key": _signingKey,
				"--rpc-url": _rpcUrl,
				...originalFlags
			} = parseCommandArguments(flags, deployCommandMeta.options).flags;
			expect(parsed.positionals).toEqual([]);
			expect(parsed.flags).toEqual({
				...originalFlags,
				"--custom-app-id": APP_ID,
				"--kms-contract": KMS_CONTRACT,
			});
			for (const secret of [
				env,
				apiToken,
				LAUNCH_TOKEN,
				PRIVATE_KEY,
				rpcUrl(),
			]) {
				expect(message).not.toContain(secret);
			}
			expect(
				rpcCalls.filter((method) => method === "eth_sendRawTransaction"),
			).toHaveLength(1);
			expect(commit()).toBeUndefined();
		} finally {
			shortDeadline.mockRestore();
		}
	});

	test("uses the last KMS error's message if its response has no safe API message", async () => {
		configureProvision();
		respondGet = () => Response.json({}, { status: 502 });
		const nativeTimeout = globalThis.setTimeout;
		const deadline = spyOn(globalThis, "setTimeout").mockImplementation(((
			fn,
			delay,
			...args
		) =>
			nativeTimeout(
				fn,
				delay === 2_135_000 || delay === 15_000 ? 250 : delay,
				...args,
			)) as typeof setTimeout);
		try {
			const { exitCode, failure } = await deploy({
				...input(),
				env: ["SETTINGS=some-value"],
			});
			expect(exitCode).toBe(1);
			expect(String(failure)).toContain("502 Bad Gateway");
			expect(commit()).toBeUndefined();
		} finally {
			deadline.mockRestore();
		}
	});

	test("does not retry an explicit KMS mismatch or sign again", async () => {
		configureProvision();
		respondGet = () =>
			Response.json(
				{
					error_code: "ERR-12-005",
					message: "This app is bound to a different KMS.",
				},
				{ status: 409 },
			);
		const { exitCode, failure } = await deploy({
			...input(),
			env: ["SETTINGS=some-value"],
		});
		expect(exitCode).toBe(1);
		const message = expectRecovery(failure);
		expect(message).toContain("This app is bound to a different KMS.");
		expect(message).toContain("The CVM was not submitted.");
		expect(
			requests.filter((request) => request.path === pubkeyPath),
		).toHaveLength(1);
		expect(
			rpcCalls.filter((method) => method === "eth_sendRawTransaction"),
		).toHaveLength(1);
		expect(commit()).toBeUndefined();
	});

	test.each([[undefined], [["SETTINGS=some-value"]]])(
		"resumes a provisioned existing contract through finality with env=%j",
		async (env) => {
			configureProvision(true);
			if (!env)
				provisionOverride = {
					...provisionOverride,
					app_env_encrypt_pubkey: null,
				};
			accept(true);
			respondGet = (pathname) => {
				expect(pathname).toBe(`/api/v1/cvms/${CREATED_CVM.vm_uuid}/operations`);
				return completedOperation();
			};
			const { exitCode, failure } = await deploy({
				compose: composePath,
				kms: "base",
				customAppId: APP_ID,
				wait: true,
				env,
			});
			expect(failure).toBeUndefined();
			expect(exitCode).toBe(0);
			expect(prepareRequest().body?.app_id).toBe(APP_ID);
			expect(rpcCalls).toEqual([]);
			expect(commit()?.body).not.toHaveProperty("transaction_hash");
			if (env)
				expect(commit()?.body?.encrypted_env).toEqual(expect.any(String));
			else expect(commit()?.body).not.toHaveProperty("encrypted_env");
			expect(JSON.parse(stdout)).toMatchObject({
				status: "completed",
				app_id: APP_ID,
			});
		},
	);

	test.each(["verification", "encryption"])(
		"reports the recovery block when key %s fails",
		async (failureStage) => {
			configureProvision();
			const key = await signedPubkey(
				failureStage === "encryption" ? `0x${"0".repeat(64)}` : undefined,
			);
			respondGet = () =>
				Response.json({
					...key,
					...(failureStage === "verification"
						? { signature: "invalid-signature" }
						: {}),
				});
			const { exitCode, failure } = await deploy({
				...input(),
				env: ["SETTINGS=some-value"],
			});
			expect(exitCode).toBe(1);
			const message = expectRecovery(failure);
			expect(message).toContain("The CVM was not submitted.");
			expect(message).toMatch(
				failureStage === "verification"
					? /Invalid encryption public key signature/
					: /invalid private or public key received/,
			);
			expect(commit()).toBeUndefined();
		},
	);

	test("JSON recovery preserves the API code and explains how to recover a generated launch token after rejection", async () => {
		configureProvision();
		respondCommit = () =>
			Response.json(
				{
					error_code: "ERR-01-006",
					message: "The compose hash does not match.",
					request_id: "create-rejection-request-id",
					details: [{ field: "launch_token", value: LAUNCH_TOKEN }],
				},
				{ status: 422 },
			);
		const { exitCode, failure } = await deploy(
			{ ...input(), json: true, generateLaunchToken: true },
			["--json", "--kms", "base", "--generate-launch-token"],
		);
		expect(exitCode).toBe(1);
		const json = buildJsonCliError(normalizeCliError(failure), {
			operation: "CVM deployment",
		});
		expect(json).toMatchObject({
			success: false,
			error_code: "ERR-01-006",
			http_status: 422,
			request_id: "create-rejection-request-id",
		});
		expect(json.error).toContain("The compose hash does not match.");
		expect(json.error).toContain("The CVM was not submitted.");
		expect(json.error).toContain(`App ID: ${APP_ID}`);
		expect(json.error).toContain(`App contract: ${APP_ID}`);
		expect(json.error).toContain(`Registration transaction hash: ${TX_HASH}`);
		expect(json.error).toContain(
			"To reuse that hash, you need the original token.",
		);
		expect(json.error).toContain(
			"prepare a deployment with a replacement token and register the new compose hash on the existing app contract",
		);
		expect(json.error).not.toContain("--generate-launch-token");
		expect(json.error).not.toContain("No new signature is needed");
		expect(json.error).not.toMatch(/^phala deploy /m);
		expect(JSON.stringify(json)).not.toContain(LAUNCH_TOKEN);
		expect(requests.filter((request) => request.body?.token)).toHaveLength(1);
	});

	test.each([false, true])(
		"a 202 without correlation reports the accepted CVM without offering a retry, existing=%s",
		async (existing) => {
			configureProvision(existing);
			commitOverride = {
				app_id: APP_ID,
				status: "awaiting_finality",
				correlation_id: null,
			};
			const { exitCode, failure } = await deploy({
				...(existing
					? { compose: composePath, kms: "base", customAppId: APP_ID }
					: input()),
				wait: true,
			});
			expect(exitCode).toBe(1);
			const message = String(failure);
			expect(message).toContain(
				"Phala Cloud accepted the CVM create request but did not return a correlation ID.",
			);
			expect(message).toContain(`CVM ID: ${CREATED_CVM.vm_uuid}`);
			expect(message).toContain(`App ID: ${APP_ID}`);
			expect(message).toContain(
				"Check the CVM list (`phala cvms list`) and the operations of the matching CVM.",
			);
			expect(message).toContain("Do not resubmit this deployment.");
			if (existing) expect(message).not.toContain(TX_HASH);
			else
				expect(message).toContain(`Registration transaction hash: ${TX_HASH}`);
			expect(message).not.toContain("not submitted");
			expect(message).not.toContain("--custom-app-id");
			expect(message).not.toContain(LAUNCH_TOKEN);
			expect(requests.filter((request) => request.body?.token)).toHaveLength(1);
			expect(requests.some((request) => request.method === "GET")).toBe(false);
		},
	);

	test("a lost create response reports the recovery block but does not claim rejection or safe retry", async () => {
		configureProvision();
		respondCommit = () => new Response(new ReadableStream());
		const { exitCode, failure } = await deploy(input());
		expect(exitCode).toBe(1);
		const message = expectRecovery(failure);
		expect(message).toContain(
			"Check the CVM list (`phala cvms list`) and the operations of any matching CVM before retrying.",
		);
		expect(message).toContain("Do not rerun if the request was accepted.");
		expect(message).not.toContain("not submitted");
		expect(requests.filter((request) => request.body?.token)).toHaveLength(1);
	});

	test("on a 202 wait timeout prints the exact operation without recommending a repeat", async () => {
		configureProvision();
		accept();
		respondGet = () => Response.json({ items: [] });
		const nativeTimeout = globalThis.setTimeout;
		const budget = 2_135_000;
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
			const { exitCode, failure } = await deploy({ ...input(), wait: true });
			expect(exitCode).toBe(1);
			const message = String(failure);
			expect(message).toContain(
				"deployment was accepted, but completion was not confirmed",
			);
			expect(message).toContain(`after ${budget} ms`);
			expect(message).toContain(statusCommand);
			expect(message).not.toContain("not submitted");
			expect(message).not.toContain("--custom-app-id");
			expect(stdout).toBe("");
			expect(stderr).toContain("On-chain stage: submitted.");
		} finally {
			deadline.mockRestore();
		}
	});

	test("an existing contract still fails immediately when the prepare route cannot serve its key", async () => {
		prepareError = Response.json(
			{
				error_code: "ERR-02-009",
				message: "The existing app's key is unavailable.",
			},
			{ status: 400 },
		);
		const { exitCode, failure } = await deploy({
			compose: composePath,
			kms: "base",
			customAppId: APP_ID,
			wait: true,
		});
		expect(exitCode).toBe(1);
		expect(String(failure)).toContain("The existing app's key is unavailable.");
		expect(requests).toEqual([
			expect.objectContaining({ method: "POST", path: "/api/v1/cvms" }),
		]);
		expect(rpcCalls).toEqual([]);
	});
});

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
		expect((failure as Error).message).toContain(
			"docker_cleanup, runtime_tmpfs, env_merge",
		);
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

	describe("OS image choice", () => {
		// `devOs` stays unset (the CLI default); --no-dev-os would send
		// prefer_dev=false by itself. --no-pre-launch-script keeps a local
		// ~/.ssh key out of the request.
		const defaults = () => ({
			compose: composePath,
			noPreLaunchScript: true,
		});

		test("asks for a production image when no image and no dev flag is given", async () => {
			const { exitCode, failure } = await deploy({
				...defaults(),
				devOs: undefined,
			});

			expect(failure).toBeUndefined();
			expect(exitCode).toBe(0);
			const body = prepareRequest().body as Record<string, unknown>;
			expect(body.prefer_dev).toBe(false);
			expect("image" in body).toBe(false);
		});

		test("sends a named image and no preference", async () => {
			const { exitCode } = await deploy({
				...defaults(),
				devOs: undefined,
				image: "dstack-dev-0.5.9",
			});

			expect(exitCode).toBe(0);
			const body = prepareRequest().body as Record<string, unknown>;
			expect(body.image).toBe("dstack-dev-0.5.9");
			expect("prefer_dev" in body).toBe(false);
		});

		test("--dev below dstack 0.6 asks for the dev image", async () => {
			// A dev OS image takes SSH keys only from a local public key, so the
			// test supplies one instead of relying on ~/.ssh.
			const pubkeyPath = path.join(tmpDir, "prefer_dev.pub");
			await fs.writeFile(pubkeyPath, "ssh-ed25519 AAAA prefer@example\n");

			const { exitCode, failure } = await deploy({
				...defaults(),
				devOs: true,
				image: "dstack-0.5.7",
				sshPubkey: pubkeyPath,
			});

			expect(failure).toBeUndefined();
			expect(exitCode).toBe(0);
			const body = prepareRequest().body as Record<string, unknown>;
			expect(body.image).toBe("dstack-dev-0.5.7");
			expect(body.prefer_dev).toBe(true);
		});

		test("on-chain KMS still sends prefer_dev=false", async () => {
			const { exitCode } = await deploy({
				...defaults(),
				devOs: undefined,
				kms: "base",
			});

			// The on-chain flow continues past provision against a chain; only the
			// provision request matters here.
			expect(exitCode === 0 || exitCode === 1).toBe(true);
			const body = prepareRequest().body as Record<string, unknown>;
			expect(body.kms).toBe("BASE");
			expect(body.prefer_dev).toBe(false);
		});

		test("prints the OS image the API chose", async () => {
			const text = await deploy({
				...defaults(),
				devOs: undefined,
				json: false,
			});

			expect(text.exitCode).toBe(0);
			expect(stdout).toContain("OS image:  dstack-0.6.3");
		});

		test("reports the OS image in the JSON result", async () => {
			await deploy({ ...defaults(), devOs: undefined });

			expect(JSON.parse(stdout).os_image).toBe("dstack-0.6.3");
		});
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
		// Keyed by the server's vm_uuid: the record is what an update without
		// the flag works from.
		expect(recallDevOsMode(CREATED_CVM.vm_uuid)).toBe("dev-box");
	});

	test("--dev without --image pins the newest dev-box release and writes the compose back", async () => {
		const { exitCode, failure } = await deploy({
			compose: composePath,
			devOs: true,
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		const body = prepareRequest().body as Record<string, unknown>;
		// 0.6.3 exists with and without a GPU requirement; the plain one wins.
		expect(body.image).toBe("dstack-0.6.3");
		expect(body.prefer_dev).toBe(false);
		const composeFile = body.compose_file as Record<string, unknown>;
		expect(composeFile.docker_compose_file as string).toContain("  dev-box:");
		expect(await fs.readFile(composePath, "utf8")).toContain("  dev-box:");
		// --json keeps stdout a single JSON document.
		expect(JSON.parse(stdout).success).toBe(true);
	});

	test("--dev without --image fails when no release has dev-box support", async () => {
		osImagesResponse = { ...OS_IMAGES, items: [] };
		const { exitCode, failure } = await deploy({
			compose: composePath,
			devOs: true,
		});

		expect(exitCode).toBe(1);
		expect((failure as Error).message).toContain("pass one with --image");
		expect(requests.some((request) => request.method === "POST")).toBe(false);
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
				resource: { memory_in_mb: 4096 },
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
				"os_image",
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

describe("phala deploy --dev-os writes the compose file", () => {
	function deployedCompose(): string {
		const body = prepareRequest().body as Record<string, unknown>;
		const composeFile = body.compose_file as Record<string, unknown>;
		return composeFile.docker_compose_file as string;
	}

	test("saves the injected compose, shows the diff and deploys the saved content", async () => {
		const { exitCode, failure } = await deploy({
			compose: composePath,
			devOs: true,
			image: "dstack-0.6.0",
			json: false,
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		const written = await fs.readFile(composePath, "utf8");
		expect(written).toStartWith(COMPOSE);
		expect(written).toContain("  dev-box:");
		// What the user can review is what runs.
		expect(deployedCompose()).toBe(written);
		expect(stderr).toContain(`--- ${composePath}`);
		expect(stderr).toContain("+  dev-box:");
		expect(stderr).not.toContain("-services:");
		// No leftover temporary file next to it.
		expect(await fs.readdir(tmpDir)).not.toContain(".docker-compose.yml.tmp");
	});

	test("reports the written file in the JSON result and keeps stdout pure", async () => {
		const { exitCode, failure } = await deploy({
			compose: composePath,
			devOs: true,
			image: "dstack-0.6.0",
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		const result = JSON.parse(stdout);
		expect(result.success).toBe(true);
		expect(result.compose_file_updated).toBe(composePath);
		// The diff is human output only.
		expect(stderr).toBe("");
		expect(deployedCompose()).toBe(await fs.readFile(composePath, "utf8"));
	});

	test("writes nothing when the compose already has the dev box", async () => {
		const first = await deploy({
			compose: composePath,
			devOs: true,
			image: "dstack-0.6.0",
		});
		expect(first.exitCode).toBe(0);
		const written = await fs.readFile(composePath, "utf8");
		const inode = (await fs.stat(composePath)).ino;
		requests = [];
		stdout = "";
		stderr = "";

		const second = await deploy({
			compose: composePath,
			devOs: true,
			image: "dstack-0.6.0",
			json: false,
		});

		expect(second.failure).toBeUndefined();
		expect(second.exitCode).toBe(0);
		expect(await fs.readFile(composePath, "utf8")).toBe(written);
		// Not even rewritten with the same bytes.
		expect((await fs.stat(composePath)).ino).toBe(inode);
		expect(stderr).toBe("");
		expect(stdout).not.toContain("compose_file_updated");
		expect(deployedCompose()).toBe(written);
	});

	test("keeps CRLF line endings, a missing final newline and a symlink", async () => {
		const realPath = path.join(tmpDir, "crlf-real.yml");
		const linkPath = path.join(tmpDir, "crlf-link.yml");
		const original = "services:\r\n  app:\r\n    image: nginx";
		await fs.writeFile(realPath, original);
		await fs.remove(linkPath);
		await fs.symlink(realPath, linkPath);

		const { exitCode, failure } = await deploy({
			compose: linkPath,
			devOs: true,
			image: "dstack-0.6.0",
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		expect((await fs.lstat(linkPath)).isSymbolicLink()).toBe(true);
		const written = await fs.readFile(realPath, "utf8");
		expect(written).toStartWith(`${original}\r\n  dev-box:`);
		expect(written).not.toMatch(/[^\r]\n/);
		expect(written.endsWith("\n")).toBe(false);
		expect(deployedCompose()).toBe(written);
	});

	test("does not write a source that is not a regular file", async () => {
		const fifoPath = path.join(tmpDir, "compose.fifo");
		await fs.remove(fifoPath);
		const mkfifo = Bun.spawnSync(["mkfifo", fifoPath]);
		expect(mkfifo.exitCode).toBe(0);
		// A writer end so the handler's read of the pipe completes.
		const feeder = Bun.spawn([
			"sh",
			"-c",
			`cat "$1" > "$2"`,
			"sh",
			composePath,
			fifoPath,
		]);

		const { exitCode, failure } = await deploy({
			compose: fifoPath,
			devOs: true,
			image: "dstack-0.6.0",
			json: false,
		});
		await feeder.exited;

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		// The payload still carries the dev box; the local file stays as it was.
		expect(deployedCompose()).toContain("  dev-box:");
		expect(await fs.readFile(composePath, "utf8")).toBe(COMPOSE);
		expect(stderr).not.toContain("+++");
	});

	test("does not touch an --app-compose document", async () => {
		const { exitCode, failure } = await deploy({
			appCompose: appComposePath,
			devOs: true,
			image: "dstack-0.6.0",
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(await fs.readFile(appComposePath, "utf8")).toBe(APP_COMPOSE);
		expect(stdout).not.toContain("compose_file_updated");
	});

	test("does not write for the pre-0.6 dev image", async () => {
		// The dev image needs a key; pass one so the test never reads ~/.ssh.
		const pubkeyPath = path.join(tmpDir, "id_ed25519.pub");
		await fs.writeFile(pubkeyPath, "ssh-ed25519 AAAA test@example\n");

		const { exitCode, failure } = await deploy({
			compose: composePath,
			devOs: true,
			image: "dstack-0.5.7",
			sshPubkey: pubkeyPath,
		});

		expect(failure).toBeUndefined();
		expect(exitCode).toBe(0);
		expect(await fs.readFile(composePath, "utf8")).toBe(COMPOSE);
		expect(stdout).not.toContain("compose_file_updated");
	});
});
