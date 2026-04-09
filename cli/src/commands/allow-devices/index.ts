import chalk from "chalk";
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
import { logger } from "@/src/utils/logger";
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

export function normalizeDeviceId(deviceId: string): `0x${string}` {
	const normalized = deviceId.startsWith("0x") ? deviceId : `0x${deviceId}`;
	return normalized.toLowerCase() as `0x${string}`;
}

export function isValidDeviceId(deviceId: string): boolean {
	return DEVICE_ID_REGEX.test(deviceId);
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
	chain: (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS];
	rpcUrl?: string;
	appAddress: `0x${string}`;
	deviceIds: string[];
	condition: (result: Awaited<ReturnType<typeof getAllowedDevices>>) => boolean;
	description: string;
	timeoutMs?: number;
	intervalMs?: number;
}): Promise<boolean> {
	const { chain, rpcUrl, appAddress, deviceIds, condition, description } =
		params;
	const timeoutMs = params.timeoutMs ?? 60_000;
	const intervalMs = params.intervalMs ?? 2_000;
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const result = await getAllowedDevices({
			chain,
			rpcUrl,
			appAddress,
			deviceIds,
		});
		if (condition(result)) {
			return true;
		}
		await new Promise((resolve) => {
			setTimeout(resolve, intervalMs);
		});
	}

	logger.warn(`Timeout waiting for on-chain state: ${description}`);
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

	const appId = cvm.app_id;
	if (!appId) {
		context.fail("CVM has no app_id assigned yet.");
		return null;
	}

	const allowlistResult = await safeGetAppDeviceAllowlist(client, { appId });
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
	try {
		const resolved = await resolveAppContract(input.cvm, context);
		if (!resolved) return 1;

		const { chain, appContractAddress } = resolved;

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
			logger.warn(
				"Could not fetch platform nodes — node names will not be shown.",
			);
		}

		// Query chain directly with all known device IDs
		const allDeviceIds = Array.from(nodesByDeviceId.keys());
		const onChain = await getAllowedDevices({
			chain,
			appAddress: appContractAddress,
			deviceIds: allDeviceIds,
		});

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

		logger.info(`Contract: ${appContractAddress}`);
		logger.info(`Chain:    ${chain.name}`);
		logger.info(`Owner:    ${onChain.owner}`);
		logger.info(
			`Allow Any Device: ${onChain.allowAnyDevice ? chalk.green("yes") : chalk.red("no")}`,
		);

		if (onChain.devices.length === 0) {
			logger.info("No devices found");
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
		logger.logDetailedError(error);
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
	try {
		const resolved = await resolveAppContract(input.cvm, context);
		if (!resolved) return 1;

		const { chain, appContractAddress, allowlist } = resolved;
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
				logger.info("All available devices are already in the allowlist.");
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
				logger.info("No devices selected.");
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
			const result = await safeAddDevice({
				chain,
				rpcUrl: input.rpcUrl,
				appAddress: appContractAddress,
				deviceId,
				privateKey,
				skipPrerequisiteChecks: true,
			});

			if (!result.success) {
				const err = result as {
					success: false;
					error: { message: string };
				};
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
			logger.success(`Added ${r.deviceId}`);
			logger.info(`Transaction: ${r.txHash}`);
			if (r.explorer) {
				logger.info(`Explorer:    ${r.explorer}`);
			}
		}

		if (input.wait) {
			const ok = await waitForAllowlistState({
				chain,
				rpcUrl: input.rpcUrl,
				appAddress: appContractAddress,
				deviceIds,
				description: "devices to be allowed",
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
			logger.success("On-chain allowlist updated.");
		} else {
			logger.info(
				"Backend allowlist API may lag behind chain. Use --wait to verify via RPC.",
			);
		}

		return 0;
	} catch (error) {
		if (isExitPromptError(error)) {
			logger.info("Cancelled.");
			return 0;
		}
		logger.logDetailedError(error);
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
	try {
		const resolved = await resolveAppContract(input.cvm, context);
		if (!resolved) return 1;

		const { chain, appContractAddress, allowlist } = resolved;
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
				logger.info("No devices selected.");
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
			const result = await safeRemoveDevice({
				chain,
				rpcUrl: input.rpcUrl,
				appAddress: appContractAddress,
				deviceId,
				privateKey,
				skipPrerequisiteChecks: true,
			});

			if (!result.success) {
				const err = result as {
					success: false;
					error: { message: string };
				};
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
			logger.success(`Removed ${r.deviceId}`);
			logger.info(`Transaction: ${r.txHash}`);
			if (r.explorer) {
				logger.info(`Explorer:    ${r.explorer}`);
			}
		}

		if (input.wait) {
			// When allowAnyDevice is true, removed devices still appear as "allowed"
			// because getAllowedDevices short-circuits. Warn and skip the wait.
			const preCheck = await getAllowedDevices({
				chain,
				rpcUrl: input.rpcUrl,
				appAddress: appContractAddress,
				deviceIds: [],
			});
			if (preCheck.allowAnyDevice) {
				logger.warn(
					"allowAnyDevice is enabled — removed devices still appear as allowed. " +
						"Disable allow-any-device first if you want per-device enforcement.",
				);
			} else {
				const ok = await waitForAllowlistState({
					chain,
					rpcUrl: input.rpcUrl,
					appAddress: appContractAddress,
					deviceIds,
					description: "devices to be removed",
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
				logger.success("On-chain allowlist updated.");
			}
		} else {
			logger.info(
				"Backend allowlist API may lag behind chain. Use --wait to verify via RPC.",
			);
		}

		return 0;
	} catch (error) {
		if (isExitPromptError(error)) {
			logger.info("Cancelled.");
			return 0;
		}
		logger.logDetailedError(error);
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

	try {
		const resolved = await resolveAppContract(input.cvm, context);
		if (!resolved) return 1;

		return await executeSetAllowAny(input, context, {
			chain: resolved.chain,
			appContractAddress: resolved.appContractAddress,
			allow,
		});
	} catch (error) {
		logger.logDetailedError(error);
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
	try {
		const resolved = await resolveAppContract(input.cvm, context);
		if (!resolved) return 1;

		return await executeSetAllowAny(input, context, {
			chain: resolved.chain,
			appContractAddress: resolved.appContractAddress,
			allow: false,
		});
	} catch (error) {
		logger.logDetailedError(error);
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
	try {
		const resolved = await resolveAppContract(input.cvm, context);
		if (!resolved) return 1;

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
		logger.logDetailedError(error);
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
		chain: (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS];
		appContractAddress: `0x${string}`;
		allow: boolean;
	},
): Promise<number> {
	const { chain, appContractAddress, allow } = params;
	const privateKey = resolvePrivateKey(input);

	const result = await safeSetAllowAnyDevice({
		chain,
		rpcUrl: input.rpcUrl,
		appAddress: appContractAddress,
		allow,
		privateKey: privateKey as `0x${string}`,
	});

	if (!result.success) {
		const err = result as { success: false; error: { message: string } };
		context.fail(err.error.message);
		return 1;
	}

	const data = result.data as SetAllowAnyDevice;
	const explorerUrl = txExplorerUrl(chain, data.transactionHash);

	if (input.json) {
		context.success({
			...data,
			explorer: explorerUrl ?? undefined,
		});
		return 0;
	}

	logger.success(
		`Allow-any-device ${allow ? "enabled" : "disabled"} successfully!`,
	);
	logger.info(`Transaction: ${data.transactionHash}`);
	if (explorerUrl) {
		logger.info(`Explorer:    ${explorerUrl}`);
	}

	if (input.wait) {
		const ok = await waitForAllowlistState({
			chain,
			rpcUrl: input.rpcUrl,
			appAddress: appContractAddress,
			deviceIds: [],
			description: `allowAnyDevice=${allow}`,
			condition: (state) => state.allowAnyDevice === allow,
		});
		if (!ok) {
			context.fail(`allowAnyDevice did not become ${allow} within timeout.`);
			return 1;
		}
		logger.success("On-chain allow-any state updated.");
	} else {
		logger.info(
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
