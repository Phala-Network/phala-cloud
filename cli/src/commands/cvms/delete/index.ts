import inquirer from "inquirer";
import { safeDeleteCvm, safeGetCvmInfo } from "@phala/cloud";
import { getClient } from "@/src/lib/client";
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
		const isJson = context.globalOptions?.json === true;

		// Get CVM details for confirmation message
		const infoResult = await safeGetCvmInfo(client, context.cvmId);

		if (!infoResult.success) {
			context.fail(infoResult.error.message);
			return 1;
		}

		const cvm = infoResult.data;

		if (!cvm) {
			context.fail("CVM not found");
			return 1;
		}

		const cvmIdentifier = cvm.name || `app_${cvm.app_id}`;

		if (!input.force && !input.yes) {
			const { confirm } = await inquirer.prompt([
				{
					type: "confirm",
					name: "confirm",
					message: `Are you sure you want to delete CVM "${cvmIdentifier}"? This action cannot be undone.`,
					default: false,
				},
			]);

			if (!confirm) {
				if (isJson) {
					context.success({
						deleted: false,
						cancelled: true,
						cvm: cvmIdentifier,
					});
					return 0;
				}
				logger.info("Deletion cancelled");
				return 0;
			}
		}

		const spinner = logger.startSpinner(`Deleting CVM ${cvmIdentifier}`);
		const result = await safeDeleteCvm(client, context.cvmId);
		spinner.stop(true);

		if (!result.success) {
			context.fail(
				`Failed to delete CVM ${cvmIdentifier}: ${result.error.message}`,
			);
			return 1;
		}

		if (isJson) {
			context.success({ deleted: true, cvm: cvmIdentifier });
			return 0;
		}

		logger.success(`CVM ${cvmIdentifier} deleted successfully`);
		return 0;
	} catch (error) {
		context.fail("Failed to delete CVM");
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
