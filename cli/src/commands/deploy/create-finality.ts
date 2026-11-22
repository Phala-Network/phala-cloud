import {
	type DeployAppAuth,
	GetAppEnvEncryptPubKeySchema,
	PhalaCloudError,
} from "@phala/cloud";
import { globalCommandOptions } from "@/src/core/common-flags";
import type { CommandContext } from "@/src/core/types";
import type { CliApiClient } from "@/src/lib/client";
import { isKeyValueFormat } from "@/src/utils/env-parsing";
import {
	formatFinalityEta,
	getChainFinalityEtaSeconds,
	getFinalityTimeoutMs,
} from "@/src/utils/finality";
import {
	getRateLimitRetryDelayMs,
	sleepWithinDeadline,
} from "@/src/utils/rate-limit";
import { deployCommandMeta } from "./command";

function shellQuote(value: string): string {
	return /^[a-zA-Z0-9_./:@-]+$/.test(value)
		? value
		: `'${value.replace(/'/g, "'\\''")}'`;
}

function appendArgument(command: string[], flag: string, value: string) {
	// A separate token starting with '-' is parsed as another flag, even if
	// the shell had to unquote it first.
	if (value.startsWith("-")) command.push(`${flag}=${shellQuote(value)}`);
	else command.push(flag, shellQuote(value));
}

function existingContractCommand(
	flags: CommandContext["rawFlags"],
	appId: string,
	kmsContract: string,
	composeFilePath: string | undefined,
) {
	const command = ["phala", "deploy"];
	const secretVariables: string[] = [];
	const secretArg = (name: string) => {
		secretVariables.push(name);
		return `"\${${name}:?}"`;
	};
	const options = new Map(
		[...globalCommandOptions, ...(deployCommandMeta.options ?? [])].map(
			(option) => [option.name, option],
		),
	);
	for (const option of options.values()) {
		if (["private-key", "rpc-url", "custom-app-id"].includes(option.name))
			continue;
		const flag = `--${option.name}`;
		const value = flags[flag];
		const negated = option.negatedName ? `--${option.negatedName}` : undefined;
		if (negated && flags[negated]) {
			command.push(negated);
		} else if (value === true) {
			command.push(flag);
		} else if (typeof value === "number") {
			appendArgument(command, flag, String(value));
		} else if (typeof value === "string") {
			const secret = {
				"api-token": "PHALA_CLOUD_API_KEY",
				"launch-token": "PHALA_DEPLOY_LAUNCH_TOKEN",
				token: "PHALA_DEPLOY_COMMIT_TOKEN",
			};
			const variable = secret[option.name as keyof typeof secret];
			if (variable) {
				const substitution = secretArg(variable);
				if (value.startsWith("-")) command.push(`${flag}=${substitution}`);
				else command.push(flag, substitution);
			} else {
				appendArgument(command, flag, value);
			}
		} else if (option.name === "env" && Array.isArray(value)) {
			for (const [index, item] of value.entries()) {
				if (typeof item !== "string") continue;
				if (isKeyValueFormat(item)) {
					command.push(flag, secretArg(`PHALA_DEPLOY_ENV_${index + 1}`));
				} else {
					appendArgument(command, flag, item);
				}
			}
		} else if (Array.isArray(value)) {
			for (const item of value) {
				if (typeof item === "string") appendArgument(command, flag, item);
			}
		}
	}
	if (composeFilePath && !flags["--compose"]) {
		appendArgument(command, "--compose", composeFilePath);
	}
	if (!flags["--kms-contract"] && !flags["--kms-contract-id"]) {
		appendArgument(command, "--kms-contract", kmsContract);
	}
	appendArgument(command, "--custom-app-id", appId);
	return [
		...(secretVariables.length
			? [
					`Set ${secretVariables.join(", ")} to the original values before resuming. For inline environment variables, use the full NAME=VALUE argument.`,
				]
			: []),
		flags["--generate-launch-token"]
			? "If Phala Cloud generates a new launch token on resume, the compose hash will change and the app owner must register the new hash."
			: "No new signature is needed for the original compose hash.",
		`Resume from the same directory with the existing app contract:\n${command.join(" ")}`,
	].join("\n");
}

function isRetryablePubkeyError(error: unknown): error is PhalaCloudError {
	if (!(error instanceof PhalaCloudError)) return false;
	if ([0, 408, 429, 502, 503, 504].includes(error.status)) return true;
	// Some API versions can distinguish a not-yet-registered app from an outage.
	// Do not retry invalid IDs, KMS mismatches, or use-of-sealed-key errors.
	return (
		(error.status === 400 || error.status === 404) &&
		/\b(?:AppNotRegistered|app(?:lication)? (?:is )?not (?:yet )?registered)\b/i.test(
			error.message,
		)
	);
}

function readApiMessage(data: unknown): string | undefined {
	if (!data || typeof data !== "object") return;
	if (
		"message" in data &&
		typeof data.message === "string" &&
		data.message.trim()
	)
		return data.message;
	if ("detail" in data) {
		if (typeof data.detail === "string" && data.detail.trim())
			return data.detail;
		if (
			data.detail &&
			typeof data.detail === "object" &&
			"message" in data.detail &&
			typeof data.detail.message === "string" &&
			data.detail.message.trim()
		) {
			return data.detail.message;
		}
	}
}

function errorMessage(error: unknown): string {
	if (error instanceof PhalaCloudError) {
		return readApiMessage(error.data) ?? error.message;
	}
	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return error.message;
	}
	return String(error);
}

export function isDefinitiveCreateRejection(error: unknown): boolean {
	// A lost response, server error, or unreadable success response cannot
	// tell us whether the POST took effect. A conflict may mean the commit
	// is already being processed.
	return (
		error instanceof PhalaCloudError &&
		error.status >= 400 &&
		error.status < 500 &&
		![408, 409, 425].includes(error.status)
	);
}

export function createRecoveryError(
	error: unknown,
	registration: DeployAppAuth,
	kms: { chainId: number; address: string },
	resume: { flags: CommandContext["rawFlags"]; composeFilePath?: string },
	submission: "not_submitted" | "unknown",
): Error {
	const { appId, appAuthAddress, transactionHash } = registration;
	const eta = getChainFinalityEtaSeconds(kms.chainId);
	return new Error(
		[
			errorMessage(error),
			submission === "not_submitted"
				? "The CVM was not submitted."
				: "Phala Cloud may have accepted the CVM create request. Check the CVM list (`phala cvms list`) and the operations of any matching CVM before retrying. Do not rerun if the request was accepted.",
			`App ID: ${appId}`,
			`App contract: ${appAuthAddress}`,
			`Registration transaction hash: ${transactionHash}`,
			existingContractCommand(
				resume.flags,
				appId,
				kms.address,
				resume.composeFilePath,
			),
			...(eta == null
				? []
				: [
						`If the key is still unavailable, wait about ${Math.ceil(eta / 60)} min and rerun.`,
					]),
		].join("\n"),
	);
}

/** A fresh registration is the only case in which a key read waits for finality. */
export async function getNewContractEnvPubkey(
	client: CliApiClient,
	registration: DeployAppAuth,
	kms: { reference: string; chainId: number },
	onProgress: (message: string) => void,
) {
	const { appId, transactionHash } = registration;
	const eta = getChainFinalityEtaSeconds(kms.chainId);
	const timeoutMs = getFinalityTimeoutMs(eta);
	const startedAt = Date.now();
	const deadline = startedAt + timeoutMs;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	let lastError: PhalaCloudError | undefined;
	let nextProgressAt = startedAt;
	let rateLimitAttempt = 0;

	const endpoint = `/kms/${encodeURIComponent(kms.reference)}/pubkey/${encodeURIComponent(appId)}`;
	const poll = async () => {
		while (!controller.signal.aborted && Date.now() < deadline) {
			try {
				const response = await client.get(endpoint, {
					signal: controller.signal,
					retry: 0,
					ignoreResponseError: false,
				});
				if (Date.now() >= deadline) return;
				return GetAppEnvEncryptPubKeySchema.parse(response);
			} catch (error) {
				if (controller.signal.aborted) return;
				if (!isRetryablePubkeyError(error)) throw error;
				lastError = error;
				const now = Date.now();
				if (now >= nextProgressAt && now < deadline) {
					onProgress(
						`Transaction ${transactionHash} was included. Waiting for the KMS environment encryption public key for app ${appId}. ${formatFinalityEta(eta)} The CVM has not been submitted.`,
					);
					nextProgressAt = now + 60_000;
				}
				const rateLimitDelay = getRateLimitRetryDelayMs(
					error,
					rateLimitAttempt,
				);
				rateLimitAttempt =
					rateLimitDelay === undefined ? 0 : rateLimitAttempt + 1;
				await sleepWithinDeadline(
					Math.max(15_000, rateLimitDelay ?? 0),
					deadline,
				);
			}
		}
	};

	try {
		const expired = new Promise<undefined>((resolve) => {
			controller.signal.addEventListener("abort", () => resolve(undefined), {
				once: true,
			});
		});
		const key = await Promise.race([poll(), expired]);
		if (key) return key;
		throw new Error(
			[
				...(lastError ? [errorMessage(lastError)] : []),
				"Stopped waiting for the KMS environment encryption public key.",
			].join("\n"),
		);
	} finally {
		clearTimeout(timer);
		controller.abort();
	}
}
