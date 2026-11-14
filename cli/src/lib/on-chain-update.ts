import type { PatchCvmResult } from "@phala/cloud";
import {
	SUPPORTED_CHAINS,
	safeAddComposeHash,
	safeAddDevice,
	safeCheckOnChainPrerequisites,
} from "@phala/cloud";
import {
	type EpochsWritten,
	formatEpochsWritten,
	readEpochsWritten,
} from "@/src/lib/app-epoch";
import { logger } from "@/src/utils/logger";

export type OnChainPhase2 = (
	composeHash: string,
	transactionHash: string,
) => Promise<{ correlationId: string }>;

export type OnChainUpdateOptions = {
	prepareOnly: boolean;
	privateKey?: string;
	rpcUrl?: string;
	composeHash?: string;
	transactionHash?: string;
	json?: boolean;
	debug?: boolean;
};

export type OnChainUpdateOutcome =
	| { prepared: true }
	| { prepared: false; correlationId: string };

/**
 * Run a compose-hash-affecting CVM update through on-chain KMS two-phase flow.
 *
 * `phase1` is skipped when both composeHash and transactionHash are already set.
 * `--prepare-only` prints the hash and follow-up command, then stops.
 */
export async function runTwoPhaseComposeUpdate(args: {
	phase1: () => Promise<PatchCvmResult>;
	phase2: OnChainPhase2;
	options: OnChainUpdateOptions;
	appId?: string;
	followUpLines: (composeHashHex: string, commitToken?: string) => string[];
	stdout: NodeJS.WriteStream;
}): Promise<OnChainUpdateOutcome> {
	const { options, followUpLines, stdout } = args;

	if (options.composeHash && options.transactionHash) {
		const confirmed = await args.phase2(
			options.composeHash,
			options.transactionHash,
		);
		return { prepared: false, correlationId: confirmed.correlationId };
	}

	const result = await args.phase1();
	const correlationId = "correlationId" in result ? result.correlationId : "";
	if (!result.requiresOnChainHash) {
		return { prepared: false, correlationId };
	}

	const appId = args.appId || result.appId;

	if (options.prepareOnly) {
		printPreparedUpdate({
			result,
			appId,
			json: options.json !== false,
			followUpLines,
			stdout,
		});
		return { prepared: true };
	}

	if (!options.privateKey) {
		throw new Error("Private key is required for contract DstackApp");
	}

	if (options.debug) {
		console.log("[DEBUG] patchCvm.composeHash:", result.composeHash);
		console.log("[DEBUG] cvm.app_id:", appId);
		console.log("[DEBUG] patchCvm.deviceId:", result.deviceId);
	}

	const cvmChainId = result.kmsInfo?.chain_id;
	const cvmChain =
		cvmChainId != null ? SUPPORTED_CHAINS[cvmChainId] : undefined;
	if (!cvmChain) {
		throw new Error(
			cvmChainId != null
				? `CVM chain id ${cvmChainId} is not supported by this CLI build`
				: "CVM kms_info is missing chain_id",
		);
	}

	const prereqs = await safeCheckOnChainPrerequisites({
		chain: cvmChain,
		rpcUrl: options.rpcUrl,
		appAddress: appId as `0x${string}`,
		deviceId: result.deviceId,
		composeHash: result.composeHash,
	});

	if (!prereqs.success) {
		throw new Error(
			`Failed to check on-chain prerequisites (contract: ${appId}): ${errorMessage(prereqs)}`,
		);
	}

	if (options.debug) {
		console.log("[DEBUG] prereqs:", prereqs.data);
	}

	if (!prereqs.data.deviceAllowed) {
		logger.info("Device not registered on-chain, adding...");
		const deviceResult = await safeAddDevice({
			chain: cvmChain,
			rpcUrl: options.rpcUrl,
			appAddress: appId as `0x${string}`,
			deviceId: result.deviceId,
			privateKey: options.privateKey as `0x${string}`,
		});
		if (!deviceResult.success) {
			throw new Error(
				`Failed to register device on-chain (device: ${result.deviceId.slice(0, 10)}...): ${errorMessage(deviceResult)}`,
			);
		}
		logEpochRange(
			"device allowlist",
			readEpochsWritten(
				(deviceResult.data as { epochsWritten?: unknown }).epochsWritten,
			),
			options.debug,
		);
	}

	const receipt_result = await safeAddComposeHash({
		chain: cvmChain,
		rpcUrl: options.rpcUrl,
		appId: appId as `0x${string}`,
		composeHash: result.composeHash,
		privateKey: options.privateKey as `0x${string}`,
	});
	if (!receipt_result.success) {
		throw new Error(
			`Failed to register compose hash on-chain (hash: ${result.composeHash.slice(0, 10)}...): ${errorMessage(receipt_result)}`,
		);
	}

	const transactionHash: string = (
		receipt_result.data as { transactionHash: string }
	).transactionHash;
	if (options.debug) {
		console.log("[DEBUG] transactionHash:", transactionHash);
	}
	logEpochRange(
		"compose hash allowlist",
		readEpochsWritten(
			(receipt_result.data as { epochsWritten?: unknown }).epochsWritten,
		),
		options.debug,
	);

	const confirmed = await args.phase2(result.composeHash, transactionHash);
	return { prepared: false, correlationId: confirmed.correlationId };
}

/**
 * Epoch-aware app contracts store allowlist rows per epoch. The SDK reports the
 * range it wrote; surface it on the debug channel so a `--debug` deploy shows
 * which epochs the compose hash covers.
 */
function logEpochRange(
	label: string,
	epochs: EpochsWritten | undefined,
	debug: boolean | undefined,
): void {
	if (!epochs) return;
	logger.debug(`${label} written for ${formatEpochsWritten(epochs)}`);
	if (debug) {
		console.log(`[DEBUG] ${label} epochs: ${epochs[0]}..${epochs[1]}`);
	}
}

function errorMessage(result: unknown): string {
	if (
		result &&
		typeof result === "object" &&
		"error" in result &&
		result.error &&
		typeof result.error === "object" &&
		"message" in result.error &&
		typeof result.error.message === "string"
	) {
		return result.error.message;
	}
	return "unknown error";
}

function printPreparedUpdate(args: {
	result: Extract<PatchCvmResult, { requiresOnChainHash: true }>;
	appId: string;
	json: boolean;
	followUpLines: (composeHashHex: string, commitToken?: string) => string[];
	stdout: NodeJS.WriteStream;
}): void {
	const { result, appId, json, followUpLines, stdout } = args;
	const chainId = result.kmsInfo?.chain_id;
	const chain = result.kmsInfo?.chain as
		| { name?: string; blockExplorers?: { default?: { url?: string } } }
		| undefined;
	const explorerUrl = chain?.blockExplorers?.default?.url;
	const contractExplorerUrl =
		explorerUrl && appId
			? `${explorerUrl}/address/${appId.startsWith("0x") ? appId : `0x${appId}`}`
			: undefined;
	const composeHashHex = result.composeHash.startsWith("0x")
		? result.composeHash
		: `0x${result.composeHash}`;
	const onchain = result.onchainStatus;
	const output = {
		success: true,
		prepare_only: true,
		compose_hash: composeHashHex,
		app_id: appId,
		device_id: result.deviceId,
		kms_info: result.kmsInfo,
		chain_id: chainId,
		contract_explorer_url: contractExplorerUrl,
		onchain_status: onchain,
		commit_token: result.commitToken,
		commit_url: result.commitUrl,
		api_commit_url: result.apiCommitUrl,
	};

	if (json) {
		stdout.write(`${JSON.stringify(output, null, 2)}\n`);
		return;
	}

	const lines = [
		"CVM update prepared successfully (pending on-chain approval).",
		"",
		`Compose Hash:    ${composeHashHex}`,
		`App ID:          ${appId}`,
		`Device ID:       ${result.deviceId}`,
	];
	if (chainId) {
		lines.push(`Chain:           ${chain?.name || "Unknown"} (ID: ${chainId})`);
	}
	if (contractExplorerUrl) {
		lines.push(`Contract:        ${contractExplorerUrl}`);
	}
	lines.push(
		`Commit Token:    ${result.commitToken || "N/A"}`,
		`Commit URL:      ${result.commitUrl || "N/A"}`,
		`API Commit URL:  ${result.apiCommitUrl || "N/A"} (POST)`,
	);
	if (onchain) {
		const hashStatus = onchain.compose_hash_allowed
			? "registered"
			: "NOT registered";
		const deviceStatus = onchain.device_id_allowed
			? "registered"
			: "NOT registered";
		lines.push(
			"",
			"On-chain Status:",
			`  Compose Hash:  ${hashStatus}`,
			`  Device ID:     ${deviceStatus}`,
		);
		if (onchain.is_allowed) {
			lines.push(
				"  All prerequisites met. You can commit with --transaction-hash already-registered.",
			);
		}
	}
	lines.push("", "To complete the update after on-chain approval:");
	lines.push(...followUpLines(composeHashHex, result.commitToken));
	stdout.write(`${lines.join("\n")}\n`);
}
