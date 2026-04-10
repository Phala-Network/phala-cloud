import inquirer from "inquirer";
import {
	safeGetCvmInfo,
	safeGetAppDeviceAllowlist,
	safeGetAvailableNodes,
	safeAddDevice,
	safeRemoveDevice,
	safeSetAllowAnyDevice,
	getAllowedDevices,
	SUPPORTED_CHAINS,
	type AddDevice,
	type RemoveDevice,
	type SetAllowAnyDevice,
} from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { printTable } from "@/src/lib/table";
import {
	allowDevicesGroup,
	allowDevicesListMeta,
	allowDevicesListSchema,
	type AllowDevicesListInput,
	allowDevicesAddMeta,
	allowDevicesAddSchema,
	type AllowDevicesAddInput,
	allowDevicesRemoveMeta,
	allowDevicesRemoveSchema,
	type AllowDevicesRemoveInput,
	allowDevicesAllowAnyMeta,
	allowDevicesAllowAnySchema,
	type AllowDevicesAllowAnyInput,
	allowDevicesDisallowAnyMeta,
	allowDevicesDisallowAnySchema,
	type AllowDevicesDisallowAnyInput,
	allowDevicesToggleAllowAnyMeta,
	allowDevicesToggleAllowAnySchema,
	type AllowDevicesToggleAllowAnyInput,
} from "./command";

// ── Helpers ─────────────────────────────────────────────────────────

const DEVICE_ID_REGEX = /^(0x)?[0-9a-fA-F]{64}$/;
const RAW_APP_ID_REGEX = /^[0-9a-fA-F]{40}$/;

export function normalizeDeviceId(deviceId: string): `0x${string}` {
	const normalized = deviceId.startsWith("0x") ? deviceId : `0x${deviceId}`;
	return normalized.toLowerCase() as `0x${string}`;
}

export function isValidDeviceId(deviceId: string): boolean {
	return DEVICE_ID_REGEX.test(deviceId);
}

export function isAppAllowlistIdentifier(identifier: string): boolean {
	return identifier.startsWith("app_") || RAW_APP_ID_REGEX.test(identifier);
}

export function normalizeAllowlistAppId(identifier: string): string {
	const rawAppId = identifier.startsWith("app_")
		? identifier.slice(4)
		: identifier;

	return RAW_APP_ID_REGEX.test(rawAppId) ? rawAppId.toLowerCase() : rawAppId;
}

export function txExplorerUrl(
	chain: (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS],
	txHash: string | undefined,
): string | null {
	if (!txHash) return null;
	const baseUrl = chain.blockExplorers?.default?.url;
	if (!baseUrl) return null;
	return `${baseUrl}/tx/${txHash}`;
}

// ── RPC timeout + error hint ────────────────────────────────────────

type SupportedChain = (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS];

// Cap how long the CLI will wait on any single SDK call before surfacing
// the hang to the user. The public RPC (viem's hard-coded chain default) is
// often rate-limited, so we fail fast and let the user retry with --rpc-url.
const CLI_RPC_TIMEOUT_MS = 30_000;
// Shorter budget per iteration of the allowlist polling loop so one stuck
// request cannot consume the whole outer timeout.
const CLI_RPC_POLL_TIMEOUT_MS = 15_000;

export class RpcTimeoutError extends Error {
	readonly rpcUrl: string;
	readonly timeoutMs: number;
	constructor(rpcUrl: string, timeoutMs: number) {
		super(
			`RPC request exceeded ${timeoutMs}ms waiting for a response from ${rpcUrl}`,
		);
		this.name = "RpcTimeoutError";
		this.rpcUrl = rpcUrl;
		this.timeoutMs = timeoutMs;
	}
}

const RPC_ERROR_PATTERNS: readonly RegExp[] = [
	/timeout/i,
	/HttpRequestError/i,
	/TimeoutError/i,
	/fetch failed/i,
	/ECONN(?:REFUSED|RESET|ABORTED)/i,
	/ENOTFOUND/,
	/EAI_AGAIN/,
	/socket hang up/i,
	/network error/i,
	/\b429\b/,
	/\b502\b/,
	/\b503\b/,
	/\b504\b/,
	/\b1015\b/,
	/rate[\s-]?limit/i,
	/too many requests/i,
];

export function isRpcConnectivityError(error: unknown): boolean {
	if (error instanceof RpcTimeoutError) return true;
	const messages: string[] = [];
	let current: unknown = error;
	let depth = 0;
	while (current && depth < 5) {
		if (current instanceof Error) {
			messages.push(`${current.name}: ${current.message}`);
			current = (current as { cause?: unknown }).cause;
		} else {
			messages.push(String(current));
			break;
		}
		depth += 1;
	}
	const combined = messages.join("\n");
	return RPC_ERROR_PATTERNS.some((re) => re.test(combined));
}

export async function withRpcTimeout<T>(
	operation: Promise<T>,
	rpcUrl: string,
	timeoutMs: number = CLI_RPC_TIMEOUT_MS,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			operation,
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => {
					reject(new RpcTimeoutError(rpcUrl, timeoutMs));
				}, timeoutMs);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

export function resolveEffectiveRpcUrl(
	chain: SupportedChain,
	overrideRpcUrl?: string,
): string {
	return overrideRpcUrl || chain.rpcUrls.default.http[0] || "the default RPC";
}

// Recommended public RPC per chain. One-shot hint, not an endorsement —
// sourced by manually picking a well-known entry from chainlist.org
// (e.g. https://chainlist.org/chain/1). Keep the list tiny on purpose:
// CLI error hints should not try to curate a fresh provider registry.
function recommendedRpcForChain(chainId: number): string | null {
	switch (chainId) {
		case 1: // Ethereum mainnet
			return "https://ethereum-rpc.publicnode.com";
		case 8453: // Base mainnet
			return "https://base-rpc.publicnode.com";
		default:
			return null;
	}
}

function chainlistUrl(chainId: number): string {
	return `https://chainlist.org/chain/${chainId}`;
}

// Flags whose value must be redacted when echoed back in an error message.
const SENSITIVE_FLAG_NAMES: ReadonlySet<string> = new Set([
	"--private-key",
	"--privateKey",
]);

function maskSensitiveArgs(args: readonly string[]): string[] {
	const result: string[] = [];
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (SENSITIVE_FLAG_NAMES.has(arg) && i + 1 < args.length) {
			result.push(arg, "$PRIVATE_KEY");
			i += 1;
			continue;
		}
		const eqIdx = arg.indexOf("=");
		if (eqIdx > 0 && SENSITIVE_FLAG_NAMES.has(arg.slice(0, eqIdx))) {
			result.push(`${arg.slice(0, eqIdx)}=$PRIVATE_KEY`);
			continue;
		}
		result.push(arg);
	}
	return result;
}

function replaceOrAppendRpcUrl(
	args: readonly string[],
	rpcUrl: string,
): string[] {
	const result: string[] = [];
	let replaced = false;
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--rpc-url" && i + 1 < args.length) {
			result.push("--rpc-url", rpcUrl);
			i += 1;
			replaced = true;
			continue;
		}
		if (arg.startsWith("--rpc-url=")) {
			result.push(`--rpc-url=${rpcUrl}`);
			replaced = true;
			continue;
		}
		result.push(arg);
	}
	if (!replaced) {
		result.push("--rpc-url", rpcUrl);
	}
	return result;
}

// POSIX single-quote quoting for args that contain shell-special characters.
function shellQuote(arg: string): string {
	if (/^[a-zA-Z0-9_\-./:=@,+%]+$/.test(arg)) return arg;
	return `'${arg.replace(/'/g, "'\\''")}'`;
}

function reconstructRetryCommand(rpcUrl: string): string {
	// Skip the runtime binary (argv[0]) and the script path (argv[1]); keep
	// only user-supplied arguments. Command name is always rendered as
	// "phala" — the canonical distributed binary — even when the user is
	// running via `bun run src ...` in dev.
	const userArgs = process.argv.slice(2);
	const masked = maskSensitiveArgs(userArgs);
	const withRpc = replaceOrAppendRpcUrl(masked, rpcUrl);
	return ["phala", ...withRpc].map(shellQuote).join(" ");
}

function writeStderr(line = ""): void {
	process.stderr.write(`${line}\n`);
}

function logRpcHint(chain: SupportedChain, rpcUrl: string): void {
	writeStderr(
		`The ${chain.name} RPC endpoint (${rpcUrl}) appears unreachable or rate-limited.`,
	);

	const recommended = recommendedRpcForChain(chain.id);
	if (recommended) {
		writeStderr("Retry with:");
		writeStderr(`  ${reconstructRetryCommand(recommended)}`);
	} else {
		writeStderr(
			"Retry by appending --rpc-url <URL> to your command with a different endpoint.",
		);
	}

	writeStderr();
	writeStderr(
		`More public ${chain.name} RPC endpoints: ${chainlistUrl(chain.id)}`,
	);
	writeStderr(
		"For production workloads, register a paid provider for reliability:",
	);
	writeStderr("  Alchemy:   https://www.alchemy.com");
	writeStderr("  Infura:    https://www.infura.io");
	writeStderr("  QuickNode: https://www.quicknode.com");
}

function maybeLogRpcHint(
	error: unknown,
	chain: SupportedChain | undefined,
	rpcUrl: string | undefined,
	json = false,
): void {
	if (json) return;
	if (!chain || !rpcUrl) return;
	if (!isRpcConnectivityError(error)) return;
	logRpcHint(chain, rpcUrl);
}

function logPendingTransaction(params: {
	chain: (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS];
	description: string;
	txHash: string;
	json?: boolean;
}) {
	if (params.json) return;
	const { chain, description, txHash } = params;
	writeStderr(`${description} submitted: ${txHash}`);
	const explorerUrl = txExplorerUrl(chain, txHash);
	if (explorerUrl) {
		writeStderr(`Explorer:    ${explorerUrl}`);
	}
	writeStderr("Waiting for 1 confirmation...");
}

/**
 * Determine the allow-any flag value for the `allow-any` command.
 * Returns null if neither --enable nor --disable was specified (caller should fail).
 */
export function resolveAllowAnyFlag(input: {
	enable?: boolean;
	disable?: boolean;
}): boolean | null {
	if (input.enable && input.disable) return null; // conflict
	if (!input.enable && !input.disable) return null; // ambiguous
	return !!input.enable;
}

/**
 * Determine the toggled value for allow-any-device.
 * Handles null/undefined `currentValue` by defaulting to false.
 */
export function resolveToggleAllowAny(input: {
	enable?: boolean;
	disable?: boolean;
	currentValue: boolean | null | undefined;
}): boolean | null {
	if (input.enable && input.disable) return null; // conflict
	if (input.enable === true) return true;
	if (input.disable === true) return false;
	return !(input.currentValue ?? false);
}

/**
 * Build the set of already-allowed device IDs with consistent normalization.
 */
export function buildAlreadyAllowedSet(
	devices: { device_id: string }[],
): Set<string> {
	return new Set(devices.map((d) => normalizeDeviceId(d.device_id)));
}

async function waitForAllowlistState(params: {
	chain: SupportedChain;
	rpcUrl?: string;
	appAddress: `0x${string}`;
	deviceIds: string[];
	condition: (result: Awaited<ReturnType<typeof getAllowedDevices>>) => boolean;
	description: string;
	timeoutMs?: number;
	intervalMs?: number;
	json?: boolean;
}): Promise<boolean> {
	const { chain, rpcUrl, appAddress, deviceIds, condition, description } =
		params;
	const timeoutMs = params.timeoutMs ?? 60_000;
	const intervalMs = params.intervalMs ?? 2_000;
	const deadline = Date.now() + timeoutMs;
	const effectiveRpc = resolveEffectiveRpcUrl(chain, rpcUrl);
	const json = params.json ?? false;

	let lastError: unknown;
	while (Date.now() < deadline) {
		try {
			const result = await withRpcTimeout(
				getAllowedDevices({
					chain,
					rpcUrl,
					appAddress,
					deviceIds,
				}),
				effectiveRpc,
				CLI_RPC_POLL_TIMEOUT_MS,
			);
			if (condition(result)) {
				return true;
			}
			lastError = undefined;
		} catch (error) {
			if (!isRpcConnectivityError(error)) {
				throw error;
			}
			lastError = error;
		}
		await new Promise((resolve) => {
			setTimeout(resolve, intervalMs);
		});
	}

	if (!json) {
		writeStderr(`Warning: timeout waiting for on-chain state: ${description}`);
	}
	if (lastError) {
		maybeLogRpcHint(lastError, chain, effectiveRpc, json);
	}
	return false;
}

function isExitPromptError(error: unknown): boolean {
	return (
		error !== null &&
		typeof error === "object" &&
		"name" in error &&
		(error as { name: string }).name === "ExitPromptError"
	);
}

function resolvePrivateKey(input: { privateKey?: string }): `0x${string}` {
	const key = input.privateKey || process.env.PRIVATE_KEY;
	if (!key) {
		throw new Error(
			"Private key required. Use --private-key or set PRIVATE_KEY env var.",
		);
	}
	return (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
}

async function resolveDeviceIdOrNodeName(
	deviceInput: string,
	context: CommandContext,
): Promise<`0x${string}`> {
	if (isValidDeviceId(deviceInput)) {
		return normalizeDeviceId(deviceInput);
	}

	if (deviceInput.startsWith("0x")) {
		throw new Error(
			`Invalid device ID format: ${deviceInput}. Expected 32-byte hex (0x + 64 hex chars).`,
		);
	}

	const client = await getClient(context);
	const nodesResult = await safeGetAvailableNodes(client);
	if (!nodesResult.success) {
		throw new Error(
			`Failed to resolve node name "${deviceInput}": ${nodesResult.error.message}`,
		);
	}

	const matches = nodesResult.data.nodes.filter(
		(node) => node.name.toLowerCase() === deviceInput.toLowerCase(),
	);
	if (matches.length === 0) {
		throw new Error(
			`Node "${deviceInput}" not found. Provide a valid node name or device ID.`,
		);
	}
	if (matches.length > 1) {
		throw new Error(
			`Node name "${deviceInput}" is ambiguous (${matches.length} matches). Use an explicit device ID.`,
		);
	}

	const resolvedDeviceId = matches[0].device_id;
	if (!resolvedDeviceId || !isValidDeviceId(resolvedDeviceId)) {
		throw new Error(
			`Node "${matches[0].name}" has no valid device_id. Use an explicit device ID.`,
		);
	}
	return normalizeDeviceId(resolvedDeviceId);
}

async function resolveAppContract(
	cvmIdentifier: string,
	context: CommandContext,
) {
	const client = await getClient(context);

	let appId: string;
	if (isAppAllowlistIdentifier(cvmIdentifier)) {
		appId = normalizeAllowlistAppId(cvmIdentifier);
	} else {
		const infoResult = await safeGetCvmInfo(client, { id: cvmIdentifier });
		if (!infoResult.success) {
			context.fail(infoResult.error.message);
			return null;
		}

		const cvm = infoResult.data;
		if (!cvm) {
			context.fail("CVM not found");
			return null;
		}

		appId = cvm.app_id;
		if (!appId) {
			context.fail("CVM has no app_id assigned yet.");
			return null;
		}
	}

	const allowlistResult = await safeGetAppDeviceAllowlist(client, {
		appId: normalizeAllowlistAppId(appId),
	});
	if (!allowlistResult.success) {
		context.fail(allowlistResult.error.message);
		return null;
	}

	const allowlist = allowlistResult.data;
	if (!allowlist.is_onchain_kms) {
		context.fail(
			"This app does not use on-chain KMS. Device management requires an on-chain KMS.",
		);
		return null;
	}

	if (!allowlist.chain_id || !allowlist.app_contract_address) {
		context.fail(
			"Missing chain_id or app_contract_address in allowlist response.",
		);
		return null;
	}

	const chain = SUPPORTED_CHAINS[allowlist.chain_id];
	if (!chain) {
		context.fail(`Unsupported chain_id: ${allowlist.chain_id}`);
		return null;
	}

	return {
		chain,
		chainId: allowlist.chain_id,
		appContractAddress: allowlist.app_contract_address as `0x${string}`,
		allowlist,
	};
}

// ── list ────────────────────────────────────────────────────────────

async function runList(
	input: AllowDevicesListInput,
	context: CommandContext,
): Promise<number> {
	const say = (line = ""): void => {
		if (!input.json) writeStderr(line);
	};

	let effectiveRpc: string | undefined;
	let activeChain: SupportedChain | undefined;
	try {
		const resolved = await resolveAppContract(input.cvm, context);
		if (!resolved) return 1;

		const { chain, appContractAddress } = resolved;
		activeChain = chain;
		effectiveRpc = resolveEffectiveRpcUrl(chain, input.rpcUrl);

		// Get all platform nodes to build device_id → node_name map
		const client = await getClient(context);
		const nodesResult = await safeGetAvailableNodes(client);
		const nodesByDeviceId = new Map<string, string>();
		if (nodesResult.success) {
			for (const node of nodesResult.data.nodes) {
				if (node.device_id && isValidDeviceId(node.device_id)) {
					nodesByDeviceId.set(normalizeDeviceId(node.device_id), node.name);
				}
			}
		} else {
			say(
				"Warning: could not fetch platform nodes — node names will not be shown.",
			);
		}

		// Query chain directly with all known device IDs
		const allDeviceIds = Array.from(nodesByDeviceId.keys());
		const onChain = await withRpcTimeout(
			getAllowedDevices({
				chain,
				rpcUrl: input.rpcUrl,
				appAddress: appContractAddress,
				deviceIds: allDeviceIds,
			}),
			effectiveRpc,
		);

		if (input.json) {
			context.success({
				appAddress: appContractAddress,
				chain: chain.name,
				owner: onChain.owner,
				allowAnyDevice: onChain.allowAnyDevice,
				devices: onChain.devices.map((did) => ({
					deviceId: did,
					nodeName: nodesByDeviceId.get(did.toLowerCase()) ?? null,
				})),
			});
			return 0;
		}

		say(`Contract: ${appContractAddress}`);
		say(`Chain:    ${chain.name}`);
		say(`Owner:    ${onChain.owner}`);
		say(`Allow Any Device: ${onChain.allowAnyDevice ? "yes" : "no"}`);

		if (onChain.devices.length === 0) {
			say("No devices found");
			return 0;
		}

		const columns = ["DEVICE_ID", "NODE"] as const;
		const rows = onChain.devices.map((did) => ({
			DEVICE_ID: did,
			NODE: nodesByDeviceId.get(did.toLowerCase()) ?? "-",
		}));

		printTable(columns, rows);

		return 0;
	} catch (error) {
		maybeLogRpcHint(error, activeChain, effectiveRpc, input.json);
		context.fail(
			`Failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 1;
	}
}

// ── add ─────────────────────────────────────────────────────────────

async function runAdd(
	input: AllowDevicesAddInput,
	context: CommandContext,
): Promise<number> {
	const say = (line = ""): void => {
		if (!input.json) writeStderr(line);
	};

	let effectiveRpc: string | undefined;
	let activeChain: SupportedChain | undefined;
	try {
		const resolved = await resolveAppContract(input.cvm, context);
		if (!resolved) return 1;

		const { chain, appContractAddress, allowlist } = resolved;
		activeChain = chain;
		effectiveRpc = resolveEffectiveRpcUrl(chain, input.rpcUrl);
		const privateKey = resolvePrivateKey(input);

		let deviceIds: `0x${string}`[];

		if (input.interactive && !input.deviceId) {
			const client = await getClient(context);
			const nodesResult = await safeGetAvailableNodes(client);
			if (!nodesResult.success) {
				context.fail(nodesResult.error.message);
				return 1;
			}

			// Exclude devices already in the allowlist (normalize to match chain format)
			const alreadyAllowed = buildAlreadyAllowedSet(allowlist.devices);

			const candidates = nodesResult.data.nodes.filter(
				(n) =>
					n.device_id &&
					isValidDeviceId(n.device_id) &&
					!alreadyAllowed.has(normalizeDeviceId(n.device_id)),
			);
			if (candidates.length === 0) {
				say("All available devices are already in the allowlist.");
				return 0;
			}

			const { selected } = await inquirer.prompt<{
				selected: string[];
			}>([
				{
					type: "checkbox",
					name: "selected",
					message: "Select devices to add:",
					choices: candidates.map((n) => ({
						name: `${n.name}  ${n.device_id}`,
						value: n.device_id as string,
					})),
				},
			]);

			if (selected.length === 0) {
				say("No devices selected.");
				return 0;
			}

			deviceIds = selected.map((id) => normalizeDeviceId(id));
		} else if (input.deviceId) {
			const deviceId = await resolveDeviceIdOrNodeName(input.deviceId, context);
			deviceIds = [deviceId];
		} else {
			context.fail("Device ID is required. Use -i to select interactively.");
			return 1;
		}

		const results: {
			deviceId: string;
			txHash: string;
			explorer: string | null;
		}[] = [];

		for (const deviceId of deviceIds) {
			say(`Submitting add-device transaction for ${deviceId}...`);
			say(`RPC URL: ${effectiveRpc}`);

			const result = await withRpcTimeout(
				safeAddDevice({
					chain,
					rpcUrl: input.rpcUrl,
					appAddress: appContractAddress,
					deviceId,
					privateKey,
					skipPrerequisiteChecks: true,
					timeout: CLI_RPC_TIMEOUT_MS,
					onTransactionSubmitted: (txHash) => {
						logPendingTransaction({
							chain,
							description: `Add-device transaction for ${deviceId}`,
							txHash,
							json: input.json,
						});
					},
				}),
				effectiveRpc,
			);

			if (!result.success) {
				const err = result as {
					success: false;
					error: { message: string };
				};
				maybeLogRpcHint(
					new Error(err.error.message),
					chain,
					effectiveRpc,
					input.json,
				);
				context.fail(`Failed to add ${deviceId}: ${err.error.message}`);
				return 1;
			}

			const data = result.data as AddDevice;
			results.push({
				deviceId,
				txHash: data.transactionHash,
				explorer: txExplorerUrl(chain, data.transactionHash),
			});
		}

		if (input.json) {
			context.success(results);
			return 0;
		}

		for (const r of results) {
			say(`Added ${r.deviceId}`);
			say(`Transaction: ${r.txHash}`);
			if (r.explorer) {
				say(`Explorer:    ${r.explorer}`);
			}
		}

		if (input.wait) {
			const ok = await waitForAllowlistState({
				chain,
				rpcUrl: input.rpcUrl,
				appAddress: appContractAddress,
				deviceIds,
				description: "devices to be allowed",
				json: input.json,
				condition: (state) => {
					// When allowAnyDevice is true, all devices pass the check
					// regardless of per-device state. Skip wait to avoid false positive.
					if (state.allowAnyDevice) return true;
					return deviceIds.every((id) =>
						state.devices.some((d) => d.toLowerCase() === id.toLowerCase()),
					);
				},
			});
			if (!ok) {
				context.fail("Devices not observed on-chain within timeout.");
				return 1;
			}
			say("On-chain allowlist updated.");
		} else {
			say(
				"Backend allowlist API may lag behind chain. Use --wait to verify via RPC.",
			);
		}

		return 0;
	} catch (error) {
		if (isExitPromptError(error)) {
			say("Cancelled.");
			return 0;
		}
		maybeLogRpcHint(error, activeChain, effectiveRpc, input.json);
		context.fail(
			`Failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 1;
	}
}

// ── remove ──────────────────────────────────────────────────────────

async function runRemove(
	input: AllowDevicesRemoveInput,
	context: CommandContext,
): Promise<number> {
	const say = (line = ""): void => {
		if (!input.json) writeStderr(line);
	};

	let effectiveRpc: string | undefined;
	let activeChain: SupportedChain | undefined;
	try {
		const resolved = await resolveAppContract(input.cvm, context);
		if (!resolved) return 1;

		const { chain, appContractAddress, allowlist } = resolved;
		activeChain = chain;
		effectiveRpc = resolveEffectiveRpcUrl(chain, input.rpcUrl);
		const privateKey = resolvePrivateKey(input);

		let deviceIds: `0x${string}`[];

		if (input.interactive && !input.deviceId) {
			const allowedDevices = allowlist.devices.filter(
				(d) => d.status === "allowed",
			);
			if (allowedDevices.length === 0) {
				context.fail("No allowed devices found to remove.");
				return 1;
			}

			const { selected } = await inquirer.prompt<{
				selected: string[];
			}>([
				{
					type: "checkbox",
					name: "selected",
					message: "Select devices to remove:",
					choices: allowedDevices.map((d) => ({
						name: `${d.node_name ?? "-"}  ${d.device_id}`,
						value: d.device_id,
					})),
				},
			]);

			if (selected.length === 0) {
				say("No devices selected.");
				return 0;
			}

			deviceIds = selected.map((id) => normalizeDeviceId(id));
		} else if (input.deviceId) {
			const deviceId = await resolveDeviceIdOrNodeName(input.deviceId, context);
			deviceIds = [deviceId];
		} else {
			context.fail("Device ID is required. Use -i to select interactively.");
			return 1;
		}

		const results: {
			deviceId: string;
			txHash: string;
			explorer: string | null;
		}[] = [];

		for (const deviceId of deviceIds) {
			say(`Submitting remove-device transaction for ${deviceId}...`);
			say(`RPC URL: ${effectiveRpc}`);

			const result = await withRpcTimeout(
				safeRemoveDevice({
					chain,
					rpcUrl: input.rpcUrl,
					appAddress: appContractAddress,
					deviceId,
					privateKey,
					skipPrerequisiteChecks: true,
					timeout: CLI_RPC_TIMEOUT_MS,
					onTransactionSubmitted: (txHash) => {
						logPendingTransaction({
							chain,
							description: `Remove-device transaction for ${deviceId}`,
							txHash,
							json: input.json,
						});
					},
				}),
				effectiveRpc,
			);

			if (!result.success) {
				const err = result as {
					success: false;
					error: { message: string };
				};
				maybeLogRpcHint(
					new Error(err.error.message),
					chain,
					effectiveRpc,
					input.json,
				);
				context.fail(`Failed to remove ${deviceId}: ${err.error.message}`);
				return 1;
			}

			const data = result.data as RemoveDevice;
			results.push({
				deviceId,
				txHash: data.transactionHash,
				explorer: txExplorerUrl(chain, data.transactionHash),
			});
		}

		if (input.json) {
			context.success(results);
			return 0;
		}

		for (const r of results) {
			say(`Removed ${r.deviceId}`);
			say(`Transaction: ${r.txHash}`);
			if (r.explorer) {
				say(`Explorer:    ${r.explorer}`);
			}
		}

		if (input.wait) {
			// When allowAnyDevice is true, removed devices still appear as "allowed"
			// because getAllowedDevices short-circuits. Warn and skip the wait.
			const preCheck = await withRpcTimeout(
				getAllowedDevices({
					chain,
					rpcUrl: input.rpcUrl,
					appAddress: appContractAddress,
					deviceIds: [],
				}),
				effectiveRpc,
			);
			if (preCheck.allowAnyDevice) {
				say(
					"Warning: allowAnyDevice is enabled — removed devices still appear as allowed. " +
						"Disable allow-any-device first if you want per-device enforcement.",
				);
			} else {
				const ok = await waitForAllowlistState({
					chain,
					rpcUrl: input.rpcUrl,
					appAddress: appContractAddress,
					deviceIds,
					description: "devices to be removed",
					json: input.json,
					condition: (state) =>
						deviceIds.every(
							(id) =>
								!state.devices.some(
									(d) => d.toLowerCase() === id.toLowerCase(),
								),
						),
				});
				if (!ok) {
					context.fail("Devices still appear on-chain after timeout.");
					return 1;
				}
				say("On-chain allowlist updated.");
			}
		} else {
			say(
				"Backend allowlist API may lag behind chain. Use --wait to verify via RPC.",
			);
		}

		return 0;
	} catch (error) {
		if (isExitPromptError(error)) {
			say("Cancelled.");
			return 0;
		}
		maybeLogRpcHint(error, activeChain, effectiveRpc, input.json);
		context.fail(
			`Failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 1;
	}
}

// ── allow-any ───────────────────────────────────────────────────────

async function runAllowAny(
	input: AllowDevicesAllowAnyInput,
	context: CommandContext,
): Promise<number> {
	const allow = resolveAllowAnyFlag(input);
	if (allow === null) {
		context.fail(
			input.enable && input.disable
				? "Cannot use both --enable and --disable."
				: "Specify --enable or --disable to set the allow-any-device flag.",
		);
		return 1;
	}

	let effectiveRpc: string | undefined;
	let activeChain: SupportedChain | undefined;
	try {
		const resolved = await resolveAppContract(input.cvm, context);
		if (!resolved) return 1;
		activeChain = resolved.chain;
		effectiveRpc = resolveEffectiveRpcUrl(resolved.chain, input.rpcUrl);

		return await executeSetAllowAny(input, context, {
			chain: resolved.chain,
			appContractAddress: resolved.appContractAddress,
			allow,
		});
	} catch (error) {
		maybeLogRpcHint(error, activeChain, effectiveRpc, input.json);
		context.fail(
			`Failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 1;
	}
}

async function runDisallowAny(
	input: AllowDevicesDisallowAnyInput,
	context: CommandContext,
): Promise<number> {
	let effectiveRpc: string | undefined;
	let activeChain: SupportedChain | undefined;
	try {
		const resolved = await resolveAppContract(input.cvm, context);
		if (!resolved) return 1;
		activeChain = resolved.chain;
		effectiveRpc = resolveEffectiveRpcUrl(resolved.chain, input.rpcUrl);

		return await executeSetAllowAny(input, context, {
			chain: resolved.chain,
			appContractAddress: resolved.appContractAddress,
			allow: false,
		});
	} catch (error) {
		maybeLogRpcHint(error, activeChain, effectiveRpc, input.json);
		context.fail(
			`Failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 1;
	}
}

async function runToggleAllowAny(
	input: AllowDevicesToggleAllowAnyInput,
	context: CommandContext,
): Promise<number> {
	let effectiveRpc: string | undefined;
	let activeChain: SupportedChain | undefined;
	try {
		const resolved = await resolveAppContract(input.cvm, context);
		if (!resolved) return 1;
		activeChain = resolved.chain;
		effectiveRpc = resolveEffectiveRpcUrl(resolved.chain, input.rpcUrl);

		const allow = resolveToggleAllowAny({
			enable: input.enable,
			disable: input.disable,
			currentValue: resolved.allowlist.allow_any_device,
		});
		if (allow === null) {
			context.fail("Cannot use both --enable and --disable.");
			return 1;
		}

		return await executeSetAllowAny(input, context, {
			chain: resolved.chain,
			appContractAddress: resolved.appContractAddress,
			allow,
		});
	} catch (error) {
		maybeLogRpcHint(error, activeChain, effectiveRpc, input.json);
		context.fail(
			`Failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 1;
	}
}

async function executeSetAllowAny(
	input: {
		privateKey?: string;
		rpcUrl?: string;
		wait?: boolean;
		json?: boolean;
	},
	context: CommandContext,
	params: {
		chain: SupportedChain;
		appContractAddress: `0x${string}`;
		allow: boolean;
	},
): Promise<number> {
	const json = input.json ?? false;
	const say = (line = ""): void => {
		if (!json) writeStderr(line);
	};

	const { chain, appContractAddress, allow } = params;
	const privateKey = resolvePrivateKey(input);

	const effectiveRpc = resolveEffectiveRpcUrl(chain, input.rpcUrl);
	say(
		`Submitting allow-any-device transaction (${allow ? "enable" : "disable"})...`,
	);
	say(`RPC URL: ${effectiveRpc}`);

	const result = await withRpcTimeout(
		safeSetAllowAnyDevice({
			chain,
			rpcUrl: input.rpcUrl,
			appAddress: appContractAddress,
			allow,
			privateKey: privateKey as `0x${string}`,
			timeout: CLI_RPC_TIMEOUT_MS,
			onTransactionSubmitted: (txHash) => {
				logPendingTransaction({
					chain,
					description: "Allow-any-device transaction",
					txHash,
					json,
				});
			},
		}),
		effectiveRpc,
	);

	if (!result.success) {
		const err = result as { success: false; error: { message: string } };
		maybeLogRpcHint(new Error(err.error.message), chain, effectiveRpc, json);
		context.fail(err.error.message);
		return 1;
	}

	const data = result.data as SetAllowAnyDevice;
	const explorerUrl = txExplorerUrl(chain, data.transactionHash);

	if (json) {
		context.success({
			...data,
			explorer: explorerUrl ?? undefined,
		});
		return 0;
	}

	say(`Allow-any-device ${allow ? "enabled" : "disabled"} successfully!`);
	say(`Transaction: ${data.transactionHash}`);
	if (explorerUrl) {
		say(`Explorer:    ${explorerUrl}`);
	}

	if (input.wait) {
		const ok = await waitForAllowlistState({
			chain,
			rpcUrl: input.rpcUrl,
			appAddress: appContractAddress,
			deviceIds: [],
			description: `allowAnyDevice=${allow}`,
			json,
			condition: (state) => state.allowAnyDevice === allow,
		});
		if (!ok) {
			context.fail(`allowAnyDevice did not become ${allow} within timeout.`);
			return 1;
		}
		say("On-chain allow-any state updated.");
	} else {
		say(
			"Backend allowlist API may lag behind chain. Use --wait to verify via RPC.",
		);
	}

	return 0;
}

// ── Command definitions ─────────────────────────────────────────────

export const allowDevicesListCommand = defineCommand({
	path: ["allow-devices", "list"],
	meta: allowDevicesListMeta,
	schema: allowDevicesListSchema,
	handler: runList,
});

export const allowDevicesAddCommand = defineCommand({
	path: ["allow-devices", "add"],
	meta: allowDevicesAddMeta,
	schema: allowDevicesAddSchema,
	handler: runAdd,
});

export const allowDevicesRemoveCommand = defineCommand({
	path: ["allow-devices", "remove"],
	meta: allowDevicesRemoveMeta,
	schema: allowDevicesRemoveSchema,
	handler: runRemove,
});

export const allowDevicesAllowAnyCommand = defineCommand({
	path: ["allow-devices", "allow-any"],
	meta: allowDevicesAllowAnyMeta,
	schema: allowDevicesAllowAnySchema,
	handler: runAllowAny,
});

export const allowDevicesDisallowAnyCommand = defineCommand({
	path: ["allow-devices", "disallow-any"],
	meta: allowDevicesDisallowAnyMeta,
	schema: allowDevicesDisallowAnySchema,
	handler: runDisallowAny,
});

export const allowDevicesToggleAllowAnyCommand = defineCommand({
	path: ["allow-devices", "toggle-allow-any"],
	meta: allowDevicesToggleAllowAnyMeta,
	schema: allowDevicesToggleAllowAnySchema,
	handler: runToggleAllowAny,
});

export const allowDevicesCommands = {
	group: allowDevicesGroup,
	commands: [
		allowDevicesListCommand,
		allowDevicesAddCommand,
		allowDevicesRemoveCommand,
		allowDevicesAllowAnyCommand,
		allowDevicesDisallowAnyCommand,
		allowDevicesToggleAllowAnyCommand,
	],
};

export default allowDevicesCommands;
