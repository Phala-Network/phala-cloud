import { checkCvmExists, deleteCvm, selectCvm } from "@/src/api/cvms";
import { resolveCvmAppId } from "@/src/utils/cvms";
import { logDetailedError } from "@/src/utils/error-handling";
import { logger } from "@/src/utils/logger";
import { Command } from "commander";
import inquirer from "inquirer";

export const deleteCommand = new Command()
	.name("delete")
	.description("Delete a CVM")
	.argument(
		"[app-id]",
		"App ID of the CVM to delete (if not provided, a selection prompt will appear)",
	)
	.option("-f, --force", "Skip confirmation prompt", false)
	.option("-y, --yes", "Alias for --force (skip confirmation prompt)", false)
	.action(async (appId, options) => {
		try {
			const resolvedAppId = await resolveCvmAppId(appId);

			// Confirm deletion unless force or yes option is used
			if (!options.force && !options.yes) {
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
					return;
				}
			}

			// Delete the CVM
			const spinner = logger.startSpinner(`Deleting CVM app_${resolvedAppId}`);
			const success = await deleteCvm(resolvedAppId);
			spinner.stop(true);

			if (!success) {
				logger.error(`Failed to delete CVM app_${resolvedAppId}`);
				process.exit(1);
			}

			logger.success(`CVM app_${resolvedAppId} deleted successfully`);
		} catch (error) {
			logger.error("Failed to delete CVM");
			logDetailedError(error);
			process.exit(1);
		}
	});
