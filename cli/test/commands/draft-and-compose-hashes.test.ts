import { afterAll, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type Hex,
	encodeAbiParameters,
	numberToHex,
	parseTransaction,
	toFunctionSelector,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil, base } from "viem/chains";

const CVM = "example-cvm";
const APP_ID = "a".repeat(40);
const BASE_HASH = "b".repeat(64);
const PREVIEW_HASH = "c".repeat(64);
const DRAFT_PATH = `/api/v1/cvms/${CVM}/draft`;
const APP_PATH = `/api/v1/apps/${APP_ID}`;
const APP_CONTRACT = `0x${"1".repeat(40)}`;
const PRIVATE_KEY = `0x${"0".repeat(63)}1` as const;
const OWNER = privateKeyToAccount(PRIVATE_KEY).address;
const TX = `0x${"2".repeat(64)}`;
const CORRELATION = "draft-operation-42";
const dir = mkdtempSync(join(tmpdir(), "phala-draft-"));

const entries = [
	{
		id: "entry-first",
		user_id: "user-1",
		username: "alice",
		staged_at: "2026-11-22T12:00:00Z",
		patch: { docker_compose_file: "services: {}\n" },
		diff: "--- before\n+++ after\n-old: true\n+services: {}\n",
	},
	{
		id: "entry-second",
		user_id: "user-2",
		username: "bob",
		staged_at: "2026-11-22T12:01:00Z",
		patch: { memory: 8192 },
		diff: "--- before\n+++ after\n-memory: 4096\n+memory: 8192\n",
	},
];
const draft = {
	base_compose_hash: BASE_HASH,
	current_compose_hash: BASE_HASH,
	preview_compose_hash: PREVIEW_HASH,
	patch: { docker_compose_file: "services: {}\n", memory: 8192 },
	entries,
};
let route: (request: Request, url: URL) => Response | Promise<Response>;
let requests: Array<{ method: string; path: string }>;
const server = Bun.serve({
	port: 0,
	fetch(request) {
		const url = new URL(request.url);
		requests.push({ method: request.method, path: url.pathname });
		return route(request, url);
	},
});

beforeEach(() => {
	requests = [];
	route = () => new Response("Unexpected request", { status: 500 });
});

afterAll(() => {
	server.stop(true);
	rmSync(dir, { recursive: true, force: true });
});

const spawnOptions = {
	cwd: join(import.meta.dir, "../../.."),
	env: {
		...process.env,
		PHALA_CLOUD_API_KEY: "test-key",
		PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}/api/v1`,
		PHALA_CLOUD_REQUESTS_PER_MINUTE: "60000",
		PHALA_DISABLE_UPDATE_CHECK: "1",
		PHALA_CLOUD_DIR: dir,
		PRIVATE_KEY,
		ETH_RPC_URL: `http://127.0.0.1:${server.port}/rpc`,
	},
};

async function run(...args: string[]) {
	const child = Bun.spawn([process.execPath, "cli/src/index.ts", ...args], {
		...spawnOptions,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});
	const [code, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	return { code, stdout, stderr };
}

test("shows each entry's server diff and full hashes in order", async () => {
	route = () => Response.json(draft);
	const result = await run("cvms", "draft", "show", CVM);
	expect(result.code).toBe(0);
	expect(result.stdout).toContain(BASE_HASH);
	expect(result.stdout).toContain(PREVIEW_HASH);
	expect(result.stdout).toMatch(
		/entry-first[\s\S]*-old: true[\s\S]*\+services: \{\}[\s\S]*entry-second[\s\S]*-memory: 4096[\s\S]*\+memory: 8192/,
	);
	expect(requests).toEqual([{ method: "GET", path: DRAFT_PATH }]);
});

test("lists workspace drafts with state, entry count, and full hashes", async () => {
	const item = {
		cvm_id: CVM,
		vm_uuid: "cvm-uuid",
		name: "Test CVM",
		app_id: APP_ID,
		state: "awaiting_finality",
		corrupt: false,
		entry_count: 2,
		base_compose_hash: BASE_HASH,
		preview_compose_hash: PREVIEW_HASH,
	};
	route = () => Response.json({ items: [item] });
	const result = await run("cvms", "draft", "list", "--json");
	expect(result.code).toBe(0);
	expect(JSON.parse(result.stdout)).toEqual({ success: true, items: [item] });
	expect(requests).toEqual([{ method: "GET", path: "/api/v1/cvms/drafts" }]);
});

test("stages a compose file without applying and undoes only the newest entry", async () => {
	const compose = "services:\n  app:\n    image: example:v2\n";
	const file = join(dir, "compose.yml");
	writeFileSync(file, compose);
	let body: unknown;
	let discardBody: string | undefined;
	route = async (request, url) => {
		if (request.method === "PATCH") body = await request.json();
		if (request.method === "DELETE" && url.pathname === DRAFT_PATH) {
			discardBody = await request.text();
		}
		return request.method === "DELETE"
			? new Response(null, { status: 204 })
			: Response.json(draft);
	};
	const staged = await run(
		"cvms",
		"draft",
		"stage",
		CVM,
		"--compose",
		file,
		"--json",
	);
	expect(staged.code).toBe(0);
	expect(staged.stderr).toContain("replace an update waiting for finality");
	expect(JSON.parse(staged.stdout)).toEqual({ success: true, ...draft });
	expect(body).toEqual({ docker_compose_file: compose });
	const undo = await run("cvms", "draft", "undo", CVM, "--json");
	expect(undo.code).toBe(0);
	expect(JSON.parse(undo.stdout)).toEqual({
		success: true,
		discarded: true,
		entry_id: "entry-second",
	});
	const discard = await run("cvms", "draft", "discard", CVM);
	expect(discard.code).toBe(0);
	expect(discard.stdout).toContain("On-chain registrations were not changed.");
	expect(discardBody).toBe("");
	expect(requests).toEqual([
		{ method: "PATCH", path: DRAFT_PATH },
		{ method: "GET", path: DRAFT_PATH },
		{ method: "DELETE", path: `${DRAFT_PATH}/entries/entry-second` },
		{ method: "DELETE", path: DRAFT_PATH },
	]);
});

test.each([
	["discard", [], "DELETE", DRAFT_PATH],
	[
		"apply",
		["--compose-hash", PREVIEW_HASH, "--transaction-hash", TX],
		"POST",
		`${DRAFT_PATH}/apply`,
	],
] as const)(
	"%s sends the reviewed IDs in order and does not retry a changed draft",
	async (action, proof, method, path) => {
		let submitted: unknown;
		route = async (request) => {
			submitted = {
				body: await request.json(),
				compose: request.headers.get("X-Compose-Hash"),
				tx: request.headers.get("X-Transaction-Hash"),
			};
			return Response.json(
				{ error_code: "ERR-03-054", message: "The draft changed" },
				{ status: 409 },
			);
		};
		const result = await run(
			"cvms",
			"draft",
			action,
			CVM,
			"--expected-entry-id",
			"entry-z",
			"--expected-entry-id=entry-a",
			...proof,
			"--json",
		);
		expect(result.code).toBe(1);
		expect(JSON.parse(result.stdout)).toMatchObject({ success: false });
		expect(result.stdout).toContain("ERR-03-054");
		expect(submitted).toEqual({
			body: { expected_entry_ids: ["entry-z", "entry-a"] },
			compose: action === "apply" ? PREVIEW_HASH : null,
			tx: action === "apply" ? TX : null,
		});
		expect(requests).toEqual([{ method, path }]);
	},
);

test("rejects prepare-only and baseline overrides without requesting an apply", async () => {
	for (const args of [["--prepare-only"], ["--base-compose-hash", BASE_HASH]]) {
		const result = await run("cvms", "draft", "apply", CVM, ...args);
		expect(result.code).toBe(1);
		expect(result.stderr).toContain(args[0]);
	}
	expect(requests).toEqual([]);
});

test("does not retry a stale draft with a different basis", async () => {
	route = () =>
		Response.json(
			{
				error_code: "ERR-03-053",
				message: "The CVM compose changed since the draft was staged",
			},
			{ status: 409 },
		);
	const result = await run("cvms", "draft", "apply", CVM, "--json");
	expect(result.code).toBe(1);
	expect(result.stdout).toContain("ERR-03-053");
	expect(requests).toEqual([{ method: "POST", path: `${DRAFT_PATH}/apply` }]);
});

test("applies without a basis override or prepare-only header and waits for the accepted operation", async () => {
	let submitted: unknown;
	let queriedCorrelation: string | null;
	route = async (request, url) => {
		if (request.method === "POST") {
			submitted = {
				body: await request.text(),
				prepare: request.headers.get("X-Prepare-Only"),
				compose: request.headers.get("X-Compose-Hash"),
			};
			return Response.json(
				{ status: "awaiting_finality", correlation_id: CORRELATION },
				{ status: 202 },
			);
		}
		queriedCorrelation = url.searchParams.get("correlation_id");
		return Response.json({
			items: [
				{
					correlation_id: "other-operation",
					operation_type: "update",
					status: "failed",
				},
				{
					correlation_id: CORRELATION,
					operation_type: "update",
					status: "completed",
				},
			],
		});
	};
	const result = await run("cvms", "draft", "apply", CVM, "--wait", "--json");
	expect(result.code).toBe(0);
	expect(submitted).toEqual({ body: "", prepare: null, compose: null });
	expect(queriedCorrelation).toBe(CORRELATION);
	expect(JSON.parse(result.stdout)).toEqual({
		success: true,
		correlation_id: CORRELATION,
		status: "completed",
	});
	expect(requests).toEqual([
		{ method: "POST", path: `${DRAFT_PATH}/apply` },
		{ method: "GET", path: `/api/v1/cvms/${CVM}/operations` },
	]);
});

function appKmsInfo(chainId: number | null = base.id) {
	return Response.json({
		is_onchain_kms: true,
		chain_id: chainId,
		app_contract_address: APP_CONTRACT,
	});
}

function hashList(state?: "pending" | "unused") {
	return Response.json({
		items: [],
		registered_unused: state
			? [{ compose_hash: `0x${PREVIEW_HASH.toUpperCase()}`, state }]
			: [],
	});
}

test("lists both pending and unused hashes without a wallet request", async () => {
	const registered_unused = [
		{ compose_hash: BASE_HASH, state: "pending" },
		{ compose_hash: PREVIEW_HASH, state: "unused" },
	];
	route = () => Response.json({ items: [], registered_unused });
	const result = await run(
		"apps",
		"compose-hashes",
		"list",
		`app_${APP_ID}`,
		"--json",
	);
	expect(result.code).toBe(0);
	expect(JSON.parse(result.stdout)).toEqual({
		success: true,
		registered_unused,
	});
	expect(requests).toEqual([
		{ method: "GET", path: `${APP_PATH}/pending-updates` },
	]);
});

test("noninteractive revocation requires explicit confirmation before making requests", async () => {
	const result = await run(
		"apps",
		"compose-hashes",
		"revoke",
		APP_ID,
		PREVIEW_HASH,
		"--json",
	);
	expect(result.code).toBe(1);
	expect(result.stdout).toContain("Pass --yes");
	expect(requests).toEqual([]);
});

for (const [chainId, message] of [
	[
		999999,
		"The app's KMS uses unsupported chain ID 999999. No revocation transaction was sent.",
	],
	[null, "The app's KMS chain is unknown."],
] as const) {
	test(`rejects ${chainId === null ? "an unknown KMS chain" : `unsupported KMS chain ID ${chainId}`} before any wallet request`, async () => {
		route = () => appKmsInfo(chainId);
		const result = await run(
			"apps",
			"compose-hashes",
			"revoke",
			APP_ID,
			PREVIEW_HASH,
			"--yes",
			"--json",
		);
		expect(result.code).toBe(1);
		expect(JSON.parse(result.stdout)).toMatchObject({
			success: false,
			error: message,
		});
		expect(requests).toEqual([{ method: "GET", path: `${APP_PATH}/kms-info` }]);
	});
}

for (const [state, message] of [
	["pending", "This compose hash is pending"],
	[
		undefined,
		"could not confirm that this compose hash is registered and unused",
	],
] as const) {
	test(`revocation never signs when the hash is ${state ?? "absent"}`, async () => {
		route = (_, url) =>
			url.pathname.endsWith("/kms-info") ? appKmsInfo() : hashList(state);
		const result = await run(
			"apps",
			"compose-hashes",
			"revoke",
			APP_ID,
			PREVIEW_HASH,
			"--yes",
			"--json",
		);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(message);
		expect(result.stdout).not.toContain(PRIVATE_KEY);
		expect(requests).toEqual([
			{ method: "GET", path: `${APP_PATH}/kms-info` },
			{ method: "GET", path: `${APP_PATH}/pending-updates` },
		]);
	});
}

test.skipIf(process.platform === "win32")(
	"checks again after confirmation and does not sign if the hash became pending",
	async () => {
		let reads = 0;
		route = (_, url) =>
			url.pathname.endsWith("/kms-info")
				? appKmsInfo()
				: hashList(reads++ === 0 ? "unused" : "pending");
		let output = "";
		let answered = false;
		const decoder = new TextDecoder();
		const terminal = new Bun.Terminal({
			data(term, chunk) {
				output += decoder.decode(chunk, { stream: true });
				if (!answered && output.includes("Sign the revocation transaction?")) {
					answered = true;
					term.write("yes\n");
				}
			},
		});
		const child = Bun.spawn(
			[
				process.execPath,
				"cli/src/index.ts",
				"apps",
				"compose-hashes",
				"revoke",
				APP_ID,
				PREVIEW_HASH,
			],
			{
				...spawnOptions,
				terminal,
			},
		);
		const timeout = setTimeout(() => child.kill(), 3000);
		try {
			expect(await child.exited).toBe(1);
			expect(output).toMatch(
				/irreversible\.[\s\S]*Sign the revocation transaction\?[\s\S]*This compose hash is pending/,
			);
			expect(requests).toEqual([
				{ method: "GET", path: `${APP_PATH}/kms-info` },
				{ method: "GET", path: `${APP_PATH}/pending-updates` },
				{ method: "GET", path: `${APP_PATH}/pending-updates` },
			]);
		} finally {
			clearTimeout(timeout);
			terminal.close();
		}
	},
);

function walletRpc(
	onWrite: (to: Hex | undefined, calldata: Hex | undefined) => void,
	onRequest?: (method: string) => void,
	chainId: number = base.id,
) {
	const bool = (value: boolean) =>
		encodeAbiParameters([{ type: "bool" }], [value]);
	return async (request: Request): Promise<Response> => {
		const rpc = (await request.json()) as {
			id: number;
			method: string;
			params?: unknown[];
		};
		onRequest?.(rpc.method);
		const reply = (result: unknown) =>
			Response.json({ jsonrpc: "2.0", id: rpc.id, result });
		switch (rpc.method) {
			case "eth_chainId":
				return reply(numberToHex(chainId));
			case "eth_getBalance":
				return reply("0x1000000000000000");
			case "eth_getTransactionCount":
				return reply("0x0");
			case "eth_maxPriorityFeePerGas":
				return reply("0x1");
			case "eth_gasPrice":
				return reply("0x2");
			case "eth_estimateGas":
				return reply("0x10000");
			case "eth_blockNumber":
				return reply("0x2a");
			case "eth_getBlockByNumber":
				return reply({
					number: "0x2a",
					baseFeePerGas: "0x2",
					transactions: [],
				});
			case "eth_call": {
				const { data } = rpc.params?.[0] as { data: string };
				if (data === "0x01ffc9a78c0524c4".padEnd(74, "0"))
					return reply(bool(true));
				if (data.startsWith(toFunctionSelector("currentAppEpoch()"))) {
					return reply(encodeAbiParameters([{ type: "uint256" }], [3n]));
				}
				if (data.startsWith(toFunctionSelector("owner()"))) {
					return reply(encodeAbiParameters([{ type: "address" }], [OWNER]));
				}
				if (data.startsWith("0x82ad56cb")) {
					const results = [false, true, false].map((value) => ({
						success: true,
						returnData: bool(value),
					}));
					return reply(
						encodeAbiParameters(
							[
								{
									type: "tuple[]",
									components: [
										{ name: "success", type: "bool" },
										{ name: "returnData", type: "bytes" },
									],
								},
							],
							[results],
						),
					);
				}
				break;
			}
			case "eth_sendRawTransaction": {
				const transaction = parseTransaction(rpc.params?.[0] as Hex);
				onWrite(transaction.to ?? undefined, transaction.data);
				return reply(TX);
			}
			case "eth_getTransactionReceipt":
				return reply({
					transactionHash: TX,
					blockNumber: "0x2a",
					blockHash: `0x${"3".repeat(64)}`,
					gasUsed: "0x100",
					status: "0x1",
					logs: [],
					transactionIndex: "0x0",
				});
		}
		return Response.json({
			jsonrpc: "2.0",
			id: rpc.id,
			error: {
				code: -32601,
				message: `Unsupported mock RPC method ${rpc.method}`,
			},
		});
	};
}

test("revokes on the API-selected chain and contract, then reports receipt inclusion only", async () => {
	const writes: { to: Hex | undefined; calldata: Hex | undefined }[] = [];
	const rpcMethods: string[] = [];
	const rpc = walletRpc(
		(to, calldata) => writes.push({ to, calldata }),
		(method) => rpcMethods.push(method),
	);
	route = (request, url) => {
		if (url.pathname === "/rpc") return rpc(request);
		return url.pathname.endsWith("/kms-info")
			? appKmsInfo()
			: hashList("unused");
	};
	const result = await run(
		"apps",
		"compose-hashes",
		"revoke",
		`app_${APP_ID}`,
		PREVIEW_HASH,
		"--yes",
	);
	expect(result).toMatchObject({
		code: 0,
		stdout:
			"Revocation included in block 42. The KMS stops honoring this hash once that block is final (about 21 min on Base).\n",
	});
	expect(result.stderr).toContain(
		"irreversible. It cannot take back keys already released.",
	);
	expect(result.stderr).not.toContain(PRIVATE_KEY);
	expect(writes).toEqual([
		{
			to: APP_CONTRACT,
			calldata:
				toFunctionSelector(
					"removeComposeHashAtEpochs(uint256,uint256,bytes32)",
				) +
				encodeAbiParameters(
					[{ type: "uint256" }, { type: "uint256" }, { type: "bytes32" }],
					[0n, 4n, `0x${PREVIEW_HASH}`],
				).slice(2),
		},
	]);
	expect(rpcMethods).not.toContain("eth_getCode");
	expect(
		rpcMethods.slice(rpcMethods.indexOf("eth_sendRawTransaction") + 1),
	).toEqual(["eth_getTransactionReceipt"]);
	expect(requests.filter(({ path }) => path !== "/rpc")).toEqual([
		{ method: "GET", path: `${APP_PATH}/kms-info` },
		{ method: "GET", path: `${APP_PATH}/pending-updates` },
	]);
});

for (const json of [false, true]) {
	test(`reports revocation receipt inclusion without a finality estimate on Anvil (${json ? "JSON" : "text"})`, async () => {
		const rpcMethods: string[] = [];
		const rpc = walletRpc(
			() => {},
			(method) => rpcMethods.push(method),
			anvil.id,
		);
		route = (request, url) => {
			if (url.pathname === "/rpc") return rpc(request);
			return url.pathname.endsWith("/kms-info")
				? appKmsInfo(anvil.id)
				: hashList("unused");
		};
		const result = await run(
			"apps",
			"compose-hashes",
			"revoke",
			APP_ID,
			PREVIEW_HASH,
			"--yes",
			...(json ? ["--json"] : []),
		);
		expect(result.code).toBe(0);
		if (json) {
			expect(JSON.parse(result.stdout)).toEqual({
				success: true,
				app_id: APP_ID,
				app_contract_address: APP_CONTRACT,
				compose_hash: `0x${PREVIEW_HASH}`,
				chain_id: anvil.id,
				transaction_hash: TX,
				block_number: "42",
				eta_seconds: null,
			});
		} else {
			expect(result.stdout).toBe(
				"Revocation included in block 42. The KMS stops honoring this hash once that block is final.\n",
			);
		}
		expect(result.stderr).not.toMatch(/verif/i);
		expect(
			rpcMethods.slice(rpcMethods.indexOf("eth_sendRawTransaction") + 1),
		).toEqual(["eth_getTransactionReceipt"]);
	});
}

test("keeps the reviewed entry order through registration and emits only one JSON object", async () => {
	let signed = 0;
	const applyBodies: unknown[] = [];
	let proof: unknown;
	const rpc = walletRpc(() => {
		signed += 1;
	});
	route = async (request, url) => {
		if (url.pathname === "/rpc") return rpc(request);
		applyBodies.push(await request.json());
		if (applyBodies.length === 1) {
			return Response.json(
				{
					error_code: "ERR-01-005",
					message: "Compose hash registration required",
					details: [
						{ field: "compose_hash", value: PREVIEW_HASH },
						{ field: "app_id", value: APP_ID },
						{ field: "device_id", value: BASE_HASH },
						{
							field: "kms_info",
							value: {
								id: "kms-1",
								slug: "base",
								url: "https://kms.example",
								version: "0.6.5",
								chain_id: 8453,
								kms_contract_address: APP_CONTRACT,
								gateway_app_id: APP_ID,
							},
						},
					],
				},
				{ status: 465 },
			);
		}
		proof = {
			compose: request.headers.get("X-Compose-Hash"),
			tx: request.headers.get("X-Transaction-Hash"),
		};
		return Response.json(
			{ status: "awaiting_finality", correlation_id: CORRELATION },
			{ status: 202 },
		);
	};
	const result = await run(
		"cvms",
		"draft",
		"apply",
		CVM,
		"--expected-entry-id",
		"entry-z",
		"--expected-entry-id",
		"entry-a",
		"--json",
	);
	expect(result.code).toBe(0);
	expect(JSON.parse(result.stdout)).toMatchObject({
		success: true,
		correlation_id: CORRELATION,
		status: "awaiting_finality",
	});
	expect(result.stderr).toContain("is irreversible");
	expect(result.stderr).toContain(
		"keep the same --expected-entry-id flags in the same order",
	);
	expect(result.stdout).not.toContain(PRIVATE_KEY);
	expect(result.stderr).not.toContain(PRIVATE_KEY);
	expect(signed).toBe(1);
	expect(applyBodies).toEqual([
		{ expected_entry_ids: ["entry-z", "entry-a"] },
		{ expected_entry_ids: ["entry-z", "entry-a"] },
	]);
	expect(proof).toEqual({ compose: PREVIEW_HASH, tx: TX });
});
