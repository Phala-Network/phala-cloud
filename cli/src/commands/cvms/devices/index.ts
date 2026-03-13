import chalk from "chalk";
import {
	safeGetCvmInfo,
	safeGetAppDeviceAllowlist,
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
import { logger } from "@/src/utils/logger";
import {
	cvmsDevicesGroup,
	cvmsDevicesListMeta,
	cvmsDevicesListSchema,
	type CvmsDevicesListInput,
	cvmsDevicesAddMeta,
	cvmsDevicesAddSchema,
	type CvmsDevicesAddInput,
	cvmsDevicesRemoveMeta,
	cvmsDevicesRemoveSchema,
	type CvmsDevicesRemoveInput,
	cvmsDevicesAllowAnyMeta,
	cvmsDevicesAllowAnySchema,
	type CvmsDevicesAllowAnyInput,
	cvmsDevicesDisallowAnyMeta,
	cvmsDevicesDisallowAnySchema,
	type CvmsDevicesDisallowAnyInput,
	cvmsDevicesToggleAllowAnyMeta,
	cvmsDevicesToggleAllowAnySchema,
	type CvmsDevicesToggleAllowAnyInput,
} from "./command";

// ── Helpers ─────────────────────────────────────────────────────────

async function resolveAppContract(context: CommandContext) {
	if (!context.cvmId) {
		context.fail(
			"No CVM ID provided. Use --interactive to select interactively.",
		);
		return null;
	}

	const client = await getClient();

	const spinner = logger.startSpinner("Resolving CVM...");
	const infoResult = await safeGetCvmInfo(client, context.cvmId);
	spinner.stop(true);

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

	const spinner2 = logger.startSpinner("Fetching allowlist info...");
	const allowlistResult = await safeGetAppDeviceAllowlist(client, { appId });
	spinner2.stop(true);

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

function resolvePrivateKey(input: { privateKey?: string }): string {
	const key = input.privateKey || process.env.PRIVATE_KEY;
	if (!key) {
		throw new Error(
			"Private key required. Use --private-key or set PRIVATE_KEY env var.",
		);
	}
	return key.startsWith("0x") ? key : `0x${key}`;
}

// ── list ────────────────────────────────────────────────────────────

async function runList(
	input: CvmsDevicesListInput,
	context: CommandContext,
): Promise<number> {
	try {
		const resolved = await resolveAppContract(context);
		if (!resolved) return 1;

		const { chain, appContractAddress } = resolved;

		const spinner = logger.startSpinner("Querying on-chain devices...");
		const result = await getAllowedDevices({
			chain,
			appAddress: appContractAddress,
		});
		spinner.stop(true);

		if (input.json) {
			context.success(result);
			return 0;
		}

		logger.break();
		logger.keyValueTable({
			"App Contract": appContractAddress,
			Chain: chain.name,
			"Allow Any Device": result.allowAnyDevice
				? chalk.green("Yes")
				: chalk.red("No"),
			"Device Count": String(result.devices.length),
		});

		if (result.devices.length > 0) {
			logger.break();
			logger.info("Allowed devices:");
			for (const device of result.devices) {
				logger.info(`  ${device}`);
			}
		}

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
	input: CvmsDevicesAddInput,
	context: CommandContext,
): Promise<number> {
	if (!input.deviceId) {
		context.fail("Device ID is required.");
		return 1;
	}

	try {
		const resolved = await resolveAppContract(context);
		if (!resolved) return 1;

		const { chain, appContractAddress } = resolved;
		const privateKey = resolvePrivateKey(input);

		const spinner = logger.startSpinner("Submitting addDevice transaction...");
		const result = await safeAddDevice({
			chain,
			rpcUrl: input.rpcUrl,
			appAddress: appContractAddress,
			deviceId: input.deviceId,
			privateKey: privateKey as `0x${string}`,
		});
		spinner.stop(true);

		if (!result.success) {
			const err = result as { success: false; error: { message: string } };
			context.fail(err.error.message);
			return 1;
		}

		const data = result.data as AddDevice;

		if (input.json) {
			context.success(data);
			return 0;
		}

		logger.break();
		logger.success("Device added successfully!");
		logger.keyValueTable({
			"Device ID": input.deviceId,
			Transaction: data.transactionHash,
		});

		return 0;
	} catch (error) {
		logger.logDetailedError(error);
		context.fail(
			`Failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 1;
	}
}

// ── remove ──────────────────────────────────────────────────────────

async function runRemove(
	input: CvmsDevicesRemoveInput,
	context: CommandContext,
): Promise<number> {
	if (!input.deviceId) {
		context.fail("Device ID is required.");
		return 1;
	}

	try {
		const resolved = await resolveAppContract(context);
		if (!resolved) return 1;

		const { chain, appContractAddress } = resolved;
		const privateKey = resolvePrivateKey(input);

		const spinner = logger.startSpinner(
			"Submitting removeDevice transaction...",
		);
		const result = await safeRemoveDevice({
			chain,
			rpcUrl: input.rpcUrl,
			appAddress: appContractAddress,
			deviceId: input.deviceId,
			privateKey: privateKey as `0x${string}`,
		});
		spinner.stop(true);

		if (!result.success) {
			const err = result as { success: false; error: { message: string } };
			context.fail(err.error.message);
			return 1;
		}

		const data = result.data as RemoveDevice;

		if (input.json) {
			context.success(data);
			return 0;
		}

		logger.break();
		logger.success("Device removed successfully!");
		logger.keyValueTable({
			"Device ID": input.deviceId,
			Transaction: data.transactionHash,
		});

		return 0;
	} catch (error) {
		logger.logDetailedError(error);
		context.fail(
			`Failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 1;
	}
}

// ── allow-any ───────────────────────────────────────────────────────

async function runAllowAny(
	input: CvmsDevicesAllowAnyInput,
	context: CommandContext,
): Promise<number> {
	if (input.enable && input.disable) {
		context.fail("Cannot use both --enable and --disable.");
		return 1;
	}

	const allow = !input.disable;

	try {
		const resolved = await resolveAppContract(context);
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
	input: CvmsDevicesDisallowAnyInput,
	context: CommandContext,
): Promise<number> {
	try {
		const resolved = await resolveAppContract(context);
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
	input: CvmsDevicesToggleAllowAnyInput,
	context: CommandContext,
): Promise<number> {
	if (input.enable && input.disable) {
		context.fail("Cannot use both --enable and --disable.");
		return 1;
	}

	try {
		const resolved = await resolveAppContract(context);
		if (!resolved) return 1;

		const allow =
			input.enable === true
				? true
				: input.disable === true
					? false
					: !resolved.allowlist.allow_any_device;

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

	const spinner = logger.startSpinner(
		`Submitting setAllowAnyDevice(${allow}) transaction...`,
	);
	const result = await safeSetAllowAnyDevice({
		chain,
		rpcUrl: input.rpcUrl,
		appAddress: appContractAddress,
		allow,
		privateKey: privateKey as `0x${string}`,
	});
	spinner.stop(true);

	if (!result.success) {
		const err = result as { success: false; error: { message: string } };
		context.fail(err.error.message);
		return 1;
	}

	const data = result.data as SetAllowAnyDevice;
	if (input.json) {
		context.success(data);
		return 0;
	}

	logger.break();
	logger.success(
		`Allow-any-device ${allow ? "enabled" : "disabled"} successfully!`,
	);
	logger.keyValueTable({
		Transaction: data.transactionHash,
	});

	return 0;
}

// ── Command definitions ─────────────────────────────────────────────

export const cvmsDevicesListCommand = defineCommand({
	path: ["cvms", "devices", "list"],
	meta: cvmsDevicesListMeta,
	schema: cvmsDevicesListSchema,
	handler: runList,
});

export const cvmsDevicesAddCommand = defineCommand({
	path: ["cvms", "devices", "add"],
	meta: cvmsDevicesAddMeta,
	schema: cvmsDevicesAddSchema,
	handler: runAdd,
});

export const cvmsDevicesRemoveCommand = defineCommand({
	path: ["cvms", "devices", "remove"],
	meta: cvmsDevicesRemoveMeta,
	schema: cvmsDevicesRemoveSchema,
	handler: runRemove,
});

export const cvmsDevicesAllowAnyCommand = defineCommand({
	path: ["cvms", "devices", "allow-any"],
	meta: cvmsDevicesAllowAnyMeta,
	schema: cvmsDevicesAllowAnySchema,
	handler: runAllowAny,
});

export const cvmsDevicesDisallowAnyCommand = defineCommand({
	path: ["cvms", "devices", "disallow-any"],
	meta: cvmsDevicesDisallowAnyMeta,
	schema: cvmsDevicesDisallowAnySchema,
	handler: runDisallowAny,
});

export const cvmsDevicesToggleAllowAnyCommand = defineCommand({
	path: ["cvms", "devices", "toggle-allow-any"],
	meta: cvmsDevicesToggleAllowAnyMeta,
	schema: cvmsDevicesToggleAllowAnySchema,
	handler: runToggleAllowAny,
});

export const cvmsDevicesCommands = {
	group: cvmsDevicesGroup,
	commands: [
		cvmsDevicesListCommand,
		cvmsDevicesAddCommand,
		cvmsDevicesRemoveCommand,
		cvmsDevicesAllowAnyCommand,
		cvmsDevicesDisallowAnyCommand,
		cvmsDevicesToggleAllowAnyCommand,
	],
};

export default cvmsDevicesCommands;
