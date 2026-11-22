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
			command.push(flag, String(value));
		} else if (typeof value === "string") {
			const secret = {
				"api-token": "PHALA_CLOUD_API_KEY",
				"launch-token": "PHALA_DEPLOY_LAUNCH_TOKEN",
				token: "PHALA_DEPLOY_COMMIT_TOKEN",
			};
			const variable = secret[option.name as keyof typeof secret];
			command.push(flag, variable ? secretArg(variable) : shellQuote(value));
		} else if (option.name === "env" && Array.isArray(value)) {
			for (const [index, item] of value.entries()) {
				if (typeof item !== "string") continue;
				command.push(
					flag,
					isKeyValueFormat(item)
						? secretArg(`PHALA_DEPLOY_ENV_${index + 1}`)
						: shellQuote(item),
				);
			}
		} else if (Array.isArray(value)) {
			for (const item of value) {
				if (typeof item === "string") command.push(flag, shellQuote(item));
			}
		}
	}
	if (composeFilePath && !flags["--compose"]) {
		command.push("--compose", shellQuote(composeFilePath));
	}
	if (!flags["--kms-contract"] && !flags["--kms-contract-id"]) {
		command.push("--kms-contract", shellQuote(kmsContract));
	}
	command.push("--custom-app-id", shellQuote(appId));
	return [
		...(secretVariables.length
			? [
					`Set ${secretVariables.join(", ")} to the original values before resuming. For inline environment variables, use the full NAME=VALUE argument.`,
				]
			: []),
		`When the KMS can serve the key, resume from the same directory with the existing app contract. No new signature is needed:\n${command.join(" ")}`,
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

function readPubkeyApiMessage(data: unknown): string | undefined {
	if (!data || typeof data !== "object") return;
	if ("message" in data && typeof data.message === "string")
		return data.message;
	if ("detail" in data) {
		if (typeof data.detail === "string") return data.detail;
		if (
			data.detail &&
			typeof data.detail === "object" &&
			"message" in data.detail &&
			typeof data.detail.message === "string"
		) {
			return data.detail.message;
		}
	}
}

/** A fresh registration is the only case in which a key read waits for finality. */
export async function getNewContractEnvPubkey(
	client: CliApiClient,
	registration: DeployAppAuth,
	kms: { reference: string; chainId: number; address: string },
	resume: { flags: CommandContext["rawFlags"]; composeFilePath?: string },
	onProgress: (message: string) => void,
) {
	const { appId, appAuthAddress, transactionHash } = registration;
	const eta = getChainFinalityEtaSeconds(kms.chainId);
	const timeoutMs = getFinalityTimeoutMs(eta);
	const startedAt = Date.now();
	const deadline = startedAt + timeoutMs;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	let originalApiMessage: string | undefined;
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
				// Keep the first HTTP API error verbatim. Do not include raw
				// transport/URL/response metadata in recovery output.
				originalApiMessage ??= readPubkeyApiMessage(error.data);
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
				originalApiMessage ??
					"The KMS environment encryption public key could not be read.",
				"Stopped waiting for the KMS environment encryption public key. The CVM was not submitted.",
				`App ID: ${appId}`,
				`App contract: ${appAuthAddress}`,
				`Registration transaction hash: ${transactionHash}`,
				existingContractCommand(
					resume.flags,
					appId,
					kms.address,
					resume.composeFilePath,
				),
			].join("\n"),
		);
	} finally {
		clearTimeout(timer);
		controller.abort();
	}
}
