import path from "node:path";
import fs from "fs-extra";
import chalk from "chalk";
import inquirer from "inquirer";
import {
	safeGetCvmList,
	safeGetCvmInfo,
	safeGetCurrentUser,
} from "@phala/cloud";

import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient, resolveAuthForContext } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import {
	getProjectConfig,
	projectConfigExists,
	saveProjectConfig,
} from "@/src/utils/project-config";
import { runLoginCommand } from "@/src/commands/login";

import { linkCommandMeta, linkCommandSchema } from "./command";
import type { LinkCommandInput } from "./command";

interface CvmItem {
	hosted?: {
		app_id?: string;
		id?: string;
		name?: string;
		status?: string;
	};
	name?: string;
	status?: string;
}

interface CvmListResponse {
	items?: CvmItem[];
}

/**
 * Check if error is an ExitPromptError (user pressed Ctrl+C)
 */
function isExitPromptError(error: unknown): boolean {
	return (
		error !== null &&
		typeof error === "object" &&
		"name" in error &&
		(error as { name: string }).name === "ExitPromptError"
	);
}

/**
 * Detect docker-compose file in current directory
 */
function detectComposeFile(): string | undefined {
	const possibleFiles = ["docker-compose.yml", "docker-compose.yaml"];
	for (const file of possibleFiles) {
		if (fs.existsSync(path.join(process.cwd(), file))) {
			return file;
		}
	}
	return undefined;
}

/**
 * Detect .env.production file in current directory
 */
function detectEnvFile(): string | undefined {
	const envFile = ".env.production";
	if (fs.existsSync(path.join(process.cwd(), envFile))) {
		return envFile;
	}
	return undefined;
}

/**
 * Ensure user is authenticated, run login if needed
 */
async function ensureAuthenticated(
	context: CommandContext,
): Promise<{ apiKey: string; workspaceName: string } | null> {
	let apiKey = resolveAuthForContext(context).apiKey;

	if (!apiKey) {
		logger.info("Not authenticated. Starting login flow...\n");
		const loginResult = await runLoginCommand(
			{ manual: false, noOpen: false },
			context,
		);
		if (loginResult !== 0) {
			return null;
		}
		apiKey = resolveAuthForContext(context).apiKey;
		if (!apiKey) {
			return null;
		}
		console.log();
	}

	// Verify the API key is valid and discover current workspace
	const apiClient = await getClient(context);
	const userResult = await safeGetCurrentUser(apiClient);

	if (!userResult.success) {
		logger.info("API key expired or invalid. Starting login flow...\n");
		const loginResult = await runLoginCommand(
			{ manual: false, noOpen: false },
			context,
		);
		if (loginResult !== 0) {
			return null;
		}
		apiKey = resolveAuthForContext(context).apiKey;
		if (!apiKey) {
			return null;
		}

		const refreshedClient = await getClient(context);
		const refreshedUser = await safeGetCurrentUser(refreshedClient);
		if (!refreshedUser.success) {
			return null;
		}
		logger.success(`Authenticated as ${refreshedUser.data.user.username}`);
		console.log();
		return {
			apiKey,
			workspaceName: refreshedUser.data.workspace.name || "default",
		};
	}

	logger.success(`Authenticated as ${userResult.data.user.username}`);
	console.log();

	return { apiKey, workspaceName: userResult.data.workspace.name || "default" };
}

/**
 * Save project configuration and show summary
 */
function saveAndShowSummary(options: {
	cvmName: string;
	appId: string | undefined;
	composeFile: string | undefined;
	envFile: string | undefined;
	profile: string;
}): void {
	const config: Record<string, string> = {
		name: options.cvmName,
		profile: options.profile,
	};

	if (options.appId) {
		config.app_id = options.appId;
	}
	if (options.composeFile) {
		config.compose_file = options.composeFile;
	}
	if (options.envFile) {
		config.env_file = options.envFile;
	}

	saveProjectConfig(config);

	// Show summary
	console.log();
	console.log(chalk.bold("Created phala.toml:"));
	console.log(chalk.dim(`  name = "${options.cvmName}"`));
	if (options.appId) {
		console.log(chalk.dim(`  app_id = "${options.appId}"`));
	}
	console.log(chalk.dim(`  profile = "${options.profile}"`)); // TODO: switch to workspace slug when available
	if (options.composeFile) {
		console.log(chalk.dim(`  compose_file = "${options.composeFile}"`));
	}
	if (options.envFile) {
		console.log(chalk.dim(`  env_file = "${options.envFile}"`));
	}
	console.log();

	logger.success("Project linked successfully!");
	logger.info('Run "phala deploy" to update your CVM.');
}

export async function runLinkCommand(
	input: LinkCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		// Direct CVM ID provided - non-interactive mode
		if (input.cvmId) {
			return await runDirectLink(input.cvmId, context);
		}

		// No CVM ID: if phala.toml exists with CVM info but no app_id, upgrade it
		if (projectConfigExists()) {
			const existingConfig = getProjectConfig();
			if (existingConfig.cvm_id && !existingConfig.app_id) {
				return await runUpgradeConfig(existingConfig, context);
			}
		}

		// Interactive mode
		return await runInteractiveLink(context);
	} catch (error) {
		// Handle Ctrl+C gracefully
		if (isExitPromptError(error)) {
			console.log();
			logger.info("Link cancelled.");
			return 0;
		}
		throw error;
	}
}

/**
 * Upgrade existing phala.toml by backfilling app_id from CVM info
 */
async function runUpgradeConfig(
	existingConfig: ReturnType<typeof getProjectConfig>,
	context: CommandContext,
): Promise<number> {
	const auth = await ensureAuthenticated(context);
	if (!auth) {
		context.fail("Authentication failed.");
		return 1;
	}

	const client = await getClient(context);
	const cvmResult = await safeGetCvmInfo(client, {
		id: existingConfig.cvm_id as string,
	});

	if (!cvmResult.success) {
		context.fail(
			`Failed to fetch CVM info for ${existingConfig.cvm_id}: ${cvmResult.error?.message || "Unknown error"}`,
		);
		return 1;
	}

	const cvm = cvmResult.data as { app_id?: string };
	if (!cvm.app_id) {
		logger.warn("CVM does not have an app_id. No upgrade needed.");
		return 0;
	}

	// Merge app_id into existing config, preserving all existing fields
	const { cvm_id: _, ...existingFields } = existingConfig;
	const updatedConfig: Record<string, unknown> = {
		...existingFields,
		app_id: cvm.app_id,
	};

	saveProjectConfig(updatedConfig);
	logger.success(`Updated phala.toml with app_id = "${cvm.app_id}"`);
	return 0;
}

/**
 * Direct link mode - CVM ID provided as argument
 */
async function runDirectLink(
	cvmId: string,
	context: CommandContext,
): Promise<number> {
	// Step 1: Ensure authenticated
	const auth = await ensureAuthenticated(context);
	if (!auth) {
		context.fail("Authentication failed.");
		return 1;
	}

	const { workspaceName } = auth;

	// Step 2: Verify CVM exists
	const client = await getClient(context);
	const cvmResult = await safeGetCvmInfo(client, { id: cvmId });

	if (!cvmResult.success) {
		context.fail(`CVM not found: ${cvmId}`);
		return 1;
	}

	const cvm = cvmResult.data as { name?: string; app_id?: string };
	const cvmName = cvm.name || cvmId;
	const appId = cvm.app_id || undefined;

	logger.success(`Found CVM: ${cvmName}`);

	// Step 3: Check for existing phala.toml
	if (projectConfigExists()) {
		const { overwrite } = await inquirer.prompt([
			{
				type: "confirm",
				name: "overwrite",
				message: "phala.toml already exists. Overwrite?",
				default: false,
			},
		]);
		if (!overwrite) {
			logger.info("Link cancelled.");
			return 0;
		}
	}

	// Step 4: Detect local files and save
	const composeFile = detectComposeFile();
	const envFile = detectEnvFile();

	if (composeFile || envFile) {
		console.log();
		logger.info("Detected local files:");
		if (composeFile) {
			console.log(chalk.green(`  ✓ ${composeFile}`));
		}
		if (envFile) {
			console.log(chalk.green(`  ✓ ${envFile}`));
		}
	}

	saveAndShowSummary({
		cvmName,
		appId,
		composeFile,
		envFile,
		profile: workspaceName,
	});
	return 0;
}

/**
 * Interactive link mode - select CVM from list
 */
async function runInteractiveLink(context: CommandContext): Promise<number> {
	// Step 1: Ensure authenticated
	const auth = await ensureAuthenticated(context);
	if (!auth) {
		context.fail("Authentication failed.");
		return 1;
	}

	const { workspaceName } = auth;

	// Step 2: Fetch CVM list
	const listSpinner = logger.startSpinner("Fetching your CVMs...");
	const client = await getClient(context);
	const cvmResult = await safeGetCvmList(client);
	listSpinner.stop(true);

	if (!cvmResult.success) {
		context.fail(`Failed to fetch CVMs: ${cvmResult.error.message}`);
		return 1;
	}

	const cvmList = cvmResult.data as CvmListResponse;
	const cvms = cvmList.items ?? [];

	// Step 3: Check if user has CVMs
	if (cvms.length === 0) {
		logger.warn("You don't have any CVMs yet.");
		logger.info('Deploy your first CVM with "phala deploy"');
		return 0;
	}

	// Step 4: Match current folder name to CVM name
	const currentFolderName = path.basename(process.cwd());

	// Prepare choices for selection
	const choices = cvms.map((cvm) => {
		const id = cvm.hosted?.app_id || cvm.hosted?.id || "";
		const name = cvm.name || cvm.hosted?.name || "Unnamed";
		const status = cvm.status || cvm.hosted?.status || "Unknown";
		const appId = cvm.hosted?.app_id || undefined;

		return {
			name: `${name} (${id}) - Status: ${status}`,
			value: name,
			cvmName: name,
			appId,
		};
	});

	// Find default selection based on folder name
	const defaultIndex = choices.findIndex(
		(choice) =>
			choice.cvmName.toLowerCase() === currentFolderName.toLowerCase(),
	);

	console.log(chalk.bold(`Found ${cvms.length} CVM(s):\n`));

	// Step 5: Let user select CVM
	const { selectedCvm } = await inquirer.prompt([
		{
			type: "list",
			name: "selectedCvm",
			message: "Select a CVM to link:",
			choices: choices.map((c) => ({ name: c.name, value: c.value })),
			default: defaultIndex >= 0 ? defaultIndex : 0,
		},
	]);

	// Step 6: Check for existing phala.toml
	if (projectConfigExists()) {
		const { overwrite } = await inquirer.prompt([
			{
				type: "confirm",
				name: "overwrite",
				message: "phala.toml already exists. Overwrite?",
				default: false,
			},
		]);
		if (!overwrite) {
			logger.info("Link cancelled.");
			return 0;
		}
	}

	// Step 7: Detect local files and save
	const composeFile = detectComposeFile();
	const envFile = detectEnvFile();

	console.log();
	if (composeFile || envFile) {
		logger.info("Detected local files:");
		if (composeFile) {
			console.log(chalk.green(`  ✓ ${composeFile}`));
		}
		if (envFile) {
			console.log(chalk.green(`  ✓ ${envFile}`));
		}
		console.log();
	}

	const selectedChoice = choices.find((c) => c.value === selectedCvm);
	saveAndShowSummary({
		cvmName: selectedCvm,
		appId: selectedChoice?.appId,
		composeFile,
		envFile,
		profile: workspaceName,
	});
	return 0;
}

export const linkCommand = defineCommand({
	path: ["link"],
	meta: linkCommandMeta,
	schema: linkCommandSchema,
	handler: runLinkCommand,
});

export default linkCommand;
