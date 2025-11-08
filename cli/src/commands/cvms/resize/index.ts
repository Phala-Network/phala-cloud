import chalk from "chalk";
import inquirer from "inquirer";
import { getCvmByAppId, resizeCvm } from "@/src/api/cvms";
import { CLOUD_URL } from "@/src/utils/constants";
import { resolveCvmAppId } from "@/src/utils/cvms";

import { logger, setJsonMode } from "@/src/utils/logger";
import { retryOnConflict } from "@/src/utils/retry";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { isInteractive } from "@/src/core/json-mode";
import {
	cvmsResizeCommandMeta,
	cvmsResizeCommandSchema,
	type CvmsResizeCommandInput,
} from "./command";

function parseIntegerOption(
	value: string | undefined,
	label: string,
): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed < 0) {
		throw new Error(`Please provide a valid non-negative number for ${label}`);
	}
	return parsed;
}

function parseBooleanOption(value: string | undefined): boolean | undefined {
	if (value === undefined) {
		return undefined;
	}
	const normalized = value.trim().toLowerCase();
	if (["true", "1", "yes", "y"].includes(normalized)) {
		return true;
	}
	if (["false", "0", "no", "n"].includes(normalized)) {
		return false;
	}
	throw new Error(`Invalid value for --allow-restart: ${value}`);
}

async function promptForNumber(
	message: string,
	defaultValue: number,
): Promise<number> {
	const response = await inquirer.prompt<{ value: number }>([
		{
			type: "input",
			name: "value",
			message,
			default: defaultValue,
			validate: (input: string) => {
				const num = Number.parseInt(input, 10);
				if (Number.isNaN(num) || num < 0) {
					return "Please enter a valid non-negative number";
				}
				return true;
			},
			filter: (input: string) => Number.parseInt(input, 10),
			// biome-ignore lint/suspicious/noExplicitAny: inquirer type limitation
		} as any,
	]);
	return response.value;
}

async function runCvmsResizeCommand(
	input: CvmsResizeCommandInput,
	context: CommandContext,
): Promise<number> {
	// Enable JSON mode if --json flag is set
	setJsonMode(input.json);

	try {
		const resolvedAppId = await resolveCvmAppId(input.appId);
		const cvm = await getCvmByAppId(resolvedAppId);
		if (!cvm) {
			context.fail(`CVM with App ID app_${resolvedAppId} not found`);
			return 1;
		}

		let vcpu: number | undefined;
		let memory: number | undefined;
		let diskSize: number | undefined;
		let allowRestart: boolean | undefined;

		try {
			vcpu = parseIntegerOption(input.vcpu, "--vcpu");
			memory = parseIntegerOption(input.memory, "--memory");
			diskSize = parseIntegerOption(input.diskSize, "--disk-size");
			allowRestart = parseBooleanOption(input.allowRestart);
		} catch (error) {
			logger.error(error instanceof Error ? error.message : String(error));
			return 1;
		}

		// Prompt for missing values in interactive mode
		if (isInteractive()) {
			if (vcpu === undefined) {
				vcpu = await promptForNumber("Enter number of vCPUs:", cvm.vcpu);
			}

			if (memory === undefined) {
				memory = await promptForNumber("Enter memory in MB:", cvm.memory);
			}

			if (diskSize === undefined) {
				diskSize = await promptForNumber("Enter disk size in GB:", cvm.disk_size);
			}

			if (allowRestart === undefined) {
				const response = await inquirer.prompt([
					{
						type: "confirm",
						name: "allowRestart",
						message: "Allow restart of the CVM if needed for resizing?",
						default: false,
					},
				]);
				allowRestart = response.allowRestart;
			}
		} else {
			// In non-interactive mode (--json), use current values as defaults if not specified
			if (vcpu === undefined) vcpu = cvm.vcpu;
			if (memory === undefined) memory = cvm.memory;
			if (diskSize === undefined) diskSize = cvm.disk_size;
			// Default to allowing restart in non-interactive mode to ensure resize can complete
			// (vCPU changes typically require restart)
			if (allowRestart === undefined) allowRestart = true;
		}

		// Show preview and confirmation in interactive mode
		if (isInteractive()) {
			logger.keyValueTable({
				vCPUs:
					cvm.vcpu !== vcpu
						? `${chalk.red(cvm.vcpu)} -> ${chalk.green(vcpu)}`
						: cvm.vcpu,
				Memory:
					cvm.memory !== memory
						? `${chalk.red(cvm.memory)} MB -> ${chalk.green(memory)} MB`
						: cvm.memory,
				"Disk Size":
					cvm.disk_size !== diskSize
						? `${chalk.red(cvm.disk_size)} GB -> ${chalk.green(diskSize)} GB`
						: cvm.disk_size,
				"Allow Restart": allowRestart ? chalk.green("Yes") : chalk.red("No"),
			});

			if (!input.yes) {
				const { confirm } = await inquirer.prompt([
					{
						type: "confirm",
						name: "confirm",
						message: `Are you sure you want to resize CVM app_${resolvedAppId}?`,
						default: false,
					},
				]);

				if (!confirm) {
					logger.info("Resize operation cancelled");
					return 0;
				}
			}

			const spinner = logger.startSpinner(
				`Resizing CVM with App ID app_${resolvedAppId}`,
			);
			await retryOnConflict(
				() => resizeCvm(
					resolvedAppId,
					vcpu,
					memory,
					diskSize,
					allowRestart ? 1 : 0,
				),
				{ spinner }
			);
			spinner.stop(true);

			logger.break();
			logger.success(
				`Your CVM is being resized. You can check the dashboard for more details:
${CLOUD_URL}/dashboard/cvms/app_${resolvedAppId}`,
			);
		} else {
			await retryOnConflict(
				() => resizeCvm(
					resolvedAppId,
					vcpu,
					memory,
					diskSize,
					allowRestart ? 1 : 0,
				)
			);
			context.success({
				app_id: resolvedAppId,
				vcpu,
				memory,
				disk_size: diskSize,
				allow_restart: allowRestart,
			});
		}
		return 0;
	} catch (error) {
		logger.error("Failed to resize CVM");
		logger.logDetailedError(error);
		context.fail(error instanceof Error ? error.message : String(error));
		return 1;
	}
}

export const cvmsResizeCommand = defineCommand({
	path: ["cvms", "resize"],
	meta: cvmsResizeCommandMeta,
	schema: cvmsResizeCommandSchema,
	handler: runCvmsResizeCommand,
});

export default cvmsResizeCommand;
