import chalk from "chalk";
import inquirer from "inquirer";
import { safeGetCvmInfo } from "@phala/cloud";
import { resizeCvm } from "@/src/api/cvms";
import { CLOUD_URL } from "@/src/utils/constants";
import { getClient } from "@/src/lib/client";

import { logger } from "@/src/utils/logger";
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
	if (!context.cvmId) {
		context.fail(
			"No CVM ID provided. Use --interactive to select interactively.",
		);
		return 1;
	}

	try {
		const client = await getClient(context);
		const infoResult = await safeGetCvmInfo(client, context.cvmId);

		if (!infoResult.success) {
			context.failWithError(infoResult.error.cause ?? infoResult.error, {
				operation: "Resize CVM",
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			return 1;
		}

		const cvm = infoResult.data;
		if (!cvm) {
			context.fail("CVM not found");
			return 1;
		}

		// Store app_id for resize API call
		const resolvedAppId = cvm.app_id;

		let vcpu: number | undefined;
		let memory: number | undefined;
		let diskSize: number | undefined;

		try {
			vcpu = parseIntegerOption(input.vcpu, "--vcpu");
			memory = parseIntegerOption(input.memory, "--memory");
			diskSize = parseIntegerOption(input.diskSize, "--disk-size");
		} catch (error) {
			logger.error(error instanceof Error ? error.message : String(error));
			return 1;
		}
		if (input.allowRestart !== undefined) {
			logger.warn(
				"--allow-restart is deprecated and ignored: the CVM restarts when the resize needs it.",
			);
		}

		// Prompt for missing values in interactive mode
		if (isInteractive()) {
			if (vcpu === undefined) {
				vcpu = await promptForNumber(
					"Enter number of vCPUs:",
					cvm.resource.vcpu ?? undefined,
				);
			}

			if (memory === undefined) {
				memory = await promptForNumber(
					"Enter memory in MB:",
					cvm.resource.memory_in_gb
						? cvm.resource.memory_in_gb * 1024
						: undefined,
				);
			}

			if (diskSize === undefined) {
				diskSize = await promptForNumber(
					"Enter disk size in GB:",
					cvm.resource.disk_in_gb ?? undefined,
				);
			}
		} else {
			// In non-interactive mode (--json), use current values as defaults if not specified
			if (vcpu === undefined) vcpu = cvm.resource.vcpu ?? undefined;
			if (memory === undefined)
				memory = cvm.resource.memory_in_gb
					? cvm.resource.memory_in_gb * 1024
					: undefined;
			if (diskSize === undefined)
				diskSize = cvm.resource.disk_in_gb ?? undefined;
		}

		// Show preview and confirmation in interactive mode
		if (isInteractive()) {
			const currentVcpu = cvm.resource.vcpu;
			const currentMemoryMB = cvm.resource.memory_in_gb
				? cvm.resource.memory_in_gb * 1024
				: undefined;
			const currentDiskGB = cvm.resource.disk_in_gb;

			logger.keyValueTable({
				vCPUs:
					currentVcpu !== vcpu
						? `${chalk.red(currentVcpu)} -> ${chalk.green(vcpu)}`
						: currentVcpu,
				Memory:
					currentMemoryMB !== memory
						? `${chalk.red(currentMemoryMB)} MB -> ${chalk.green(memory)} MB`
						: currentMemoryMB,
				"Disk Size":
					currentDiskGB !== diskSize
						? `${chalk.red(currentDiskGB)} GB -> ${chalk.green(diskSize)} GB`
						: currentDiskGB,
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
				() => resizeCvm(resolvedAppId, vcpu, memory, diskSize),
				{ spinner },
			);
			spinner.stop(true);

			logger.break();
			logger.success(
				`Your CVM is being resized. You can check the dashboard for more details:
${CLOUD_URL}/dashboard/cvms/app_${resolvedAppId}`,
			);
		} else {
			await retryOnConflict(() =>
				resizeCvm(resolvedAppId, vcpu, memory, diskSize),
			);
			context.success({
				app_id: resolvedAppId,
				vcpu,
				memory,
				disk_size: diskSize,
			});
		}
		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Resize CVM",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
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
