import prompts from "prompts";
import { execa } from "execa";
import semver from "semver";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { logger, setJsonMode } from "@/src/utils/logger";
import { getConfigValue } from "@/src/utils/config";
import {
	detectPackageManager,
	detectRuntimeFromProcess,
	formatGlobalInstallCommand,
	getGlobalInstallArgs,
	type PackageManagerName,
	type RuntimeName,
} from "@/src/core/package-manager";
import {
	selfUpdateCommandMeta,
	selfUpdateCommandSchema,
	type SelfUpdateCommandInput,
} from "./command";

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function getErrorCode(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}
	if (!("code" in error)) {
		return undefined;
	}
	const code = (error as Record<string, unknown>).code;
	return typeof code === "string" ? code : undefined;
}

function getCurrentChannel(currentVersion: string): string | undefined {
	const parsed = semver.parse(currentVersion);
	const pre = parsed?.prerelease?.[0];
	return typeof pre === "string" && pre.length > 0 ? pre : undefined;
}

function getSelfUpdateHints(
	env: NodeJS.ProcessEnv,
	packageManager: PackageManagerName,
	command: string,
	error: unknown,
): string[] {
	const hints: string[] = [];

	const message =
		error instanceof Error && typeof error.message === "string"
			? error.message
			: String(error);

	const errorCode = getErrorCode(error);
	if (
		/permission denied|eacces|not permitted/i.test(message) ||
		(error instanceof Error &&
			(errorCode === "EACCES" || errorCode === "EPERM"))
	) {
		hints.push(
			`Permission error while running "${command}". Ensure your global install prefix is writable (avoid sudo if possible).`,
		);
	}

	if (/command not found|not recognized as an internal|ENOENT/i.test(message)) {
		hints.push(
			`Package manager "${packageManager}" not found. Install it or rerun with --package-manager npm|pnpm|yarn|bun.`,
		);
	}

	const nvmDir = env.NVM_DIR;
	if (packageManager === "npm" && isNonEmptyString(nvmDir)) {
		hints.push(
			`Detected nvm (NVM_DIR=${nvmDir}). Make sure the intended Node version is active (e.g. "nvm use <version>") and your npm global bin is on PATH.`,
		);
	}

	const fnmDir = env.FNM_DIR;
	if (packageManager === "npm" && isNonEmptyString(fnmDir)) {
		hints.push(
			`Detected fnm (FNM_DIR=${fnmDir}). Ensure your shell has fnm env loaded (e.g. eval \"$(fnm env)\") so the correct node/npm are on PATH.`,
		);
	}

	return hints;
}

function resolveChannel(
	inputChannel: string | undefined,
	currentVersion: string,
	env: NodeJS.ProcessEnv,
): string {
	if (isNonEmptyString(inputChannel)) return inputChannel.trim();
	if (isNonEmptyString(env.PHALA_UPDATE_CHANNEL))
		return env.PHALA_UPDATE_CHANNEL;
	const configChannel = getConfigValue("updateCheckChannel");
	if (isNonEmptyString(configChannel)) return configChannel;
	return getCurrentChannel(currentVersion) ?? "latest";
}

async function runSelfUpdate(
	input: SelfUpdateCommandInput,
	context: CommandContext,
): Promise<number> {
	setJsonMode(input.json);

	const packageName = context.cli?.packageName ?? "phala";
	const runtime: RuntimeName =
		(context.cli?.runtime as RuntimeName | undefined) ??
		detectRuntimeFromProcess();
	const packageManager: PackageManagerName =
		input.packageManager ?? detectPackageManager(context.env, runtime);
	const currentVersion = context.cli?.packageVersion ?? "0.0.0";
	const channel = resolveChannel(input.channel, currentVersion, context.env);

	const spec =
		channel === "latest"
			? `${packageName}@latest`
			: `${packageName}@${channel}`;
	const commandString = formatGlobalInstallCommand(packageManager, spec);
	const { command, args } = getGlobalInstallArgs(packageManager, spec);

	if (input.json && input.dryRun) {
		context.success({ command: commandString, dryRun: true });
		return 0;
	}

	if (input.dryRun) {
		context.stdout.write(`${commandString}\n`);
		return 0;
	}

	const shouldRun =
		input.yes ||
		input.json ||
		context.stderr.isTTY !== true ||
		(await prompts({
			type: "confirm",
			name: "ok",
			message: `Run "${commandString}"?`,
			initial: true,
		}).then((r) => r.ok === true));

	if (!shouldRun) {
		if (input.json) {
			context.success({ command: commandString, ran: false });
		}
		return 0;
	}

	try {
		await execa(command, args, { stdio: "inherit" });
		if (input.json) {
			context.success({ command: commandString, ran: true });
			return 0;
		}
		logger.success("Update completed");
		return 0;
	} catch (error) {
		const hints = getSelfUpdateHints(
			context.env,
			packageManager,
			commandString,
			error,
		);
		logger.logDetailedError(error);
		context.fail("Self update failed", {
			command: commandString,
			hints: hints.length > 0 ? hints : undefined,
		});
		if (!input.json && hints.length > 0) {
			for (const hint of hints) {
				logger.info(hint);
			}
		}
		return 1;
	}
}

export const selfUpdateCommand = defineCommand({
	path: ["self", "update"],
	meta: selfUpdateCommandMeta,
	schema: selfUpdateCommandSchema,
	handler: runSelfUpdate,
});
