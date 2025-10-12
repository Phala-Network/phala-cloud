import { checkCvmExists, selectCvm, stopCvm } from "@/src/api/cvms";
import { CLOUD_URL } from "@/src/utils/constants";
import { resolveCvmAppId } from "@/src/utils/cvms";
import { logDetailedError } from "@/src/utils/error-handling";
import { logger } from "@/src/utils/logger";
import { Command } from "commander";

export const stopCommand = new Command()
	.name("stop")
	.description("Stop a running CVM")
	.argument(
		"[app-id]",
		"App ID of the CVM (if not provided, a selection prompt will appear)",
	)
	.action(async (appId) => {
		try {
			const resolvedAppId = await resolveCvmAppId(appId);

			const spinner = logger.startSpinner(
				`Stopping CVM with App ID app_${resolvedAppId}`,
			);

			const response = await stopCvm(resolvedAppId);

			spinner.stop(true);
			logger.break();

			const tableData = {
				"CVM ID": response.id,
				Name: response.name,
				Status: response.status,
				"App ID": `app_${response.app_id}`,
			};
			logger.keyValueTable(tableData, {
				borderStyle: "rounded",
			});

			logger.break();
			logger.success(
				`Your CVM is being stopped. You can check the dashboard for more details:\n${CLOUD_URL}/dashboard/cvms/app_${response.app_id}`,
			);
		} catch (error) {
			logger.error("Failed to stop CVM");
			logDetailedError(error);
			process.exit(1);
		}
	});
