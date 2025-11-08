import inquirer from "inquirer";
import { deleteCvm } from "@/src/api/cvms";
import { resolveCvmAppId } from "@/src/utils/cvms";

import { logger } from "@/src/utils/logger";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	cvmsDeleteCommandMeta,
	cvmsDeleteCommandSchema,
	type CvmsDeleteCommandInput,
} from "./command";

async function runCvmsDeleteCommand(
	input: CvmsDeleteCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		const resolvedAppId = await resolveCvmAppId(input.appId);

		if (!input.force && !input.yes) {
			const { confirm } = await inquirer.prompt([
				{
					type: "confirm",
					name: "confirm",
					message: `Are you sure you want to delete CVM with App ID app_${resolvedAppId}? This action cannot be undone.`,
					default: false,
				},
			]);

			if (!confirm) {
				logger.info("Deletion cancelled");
				return 0;
			}
		}

		const spinner = logger.startSpinner(`Deleting CVM app_${resolvedAppId}`);
		const success = await deleteCvm(resolvedAppId);
		spinner.stop(true);

		if (!success) {
			logger.error(`Failed to delete CVM app_${resolvedAppId}`);
			return 1;
		}

		logger.success(`CVM app_${resolvedAppId} deleted successfully`);
		return 0;
	} catch (error) {
		logger.error("Failed to delete CVM");
		logger.logDetailedError(error);
		return 1;
	}
}

export const cvmsDeleteCommand = defineCommand({
	path: ["cvms", "delete"],
	meta: cvmsDeleteCommandMeta,
	schema: cvmsDeleteCommandSchema,
	handler: runCvmsDeleteCommand,
});

export default cvmsDeleteCommand;
