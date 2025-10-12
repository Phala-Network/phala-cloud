import { checkCvmExists, getCvmByAppId, restartCvm, selectCvm } from "@/src/api/cvms";
import { CLOUD_URL } from "@/src/utils/constants";
import { resolveCvmAppId, waitForCvmReady } from "@/src/utils/cvms";
import { logDetailedError } from "@/src/utils/error-handling";
import { logger } from "@/src/utils/logger";
import { Command } from "commander";

export const restartCommand = new Command()
	.name("restart")
	.description("Restart a CVM")
	.argument(
		"[app-id]",
		"App ID of the CVM (if not provided, a selection prompt will appear)",
	)
	.action(async (appId) => {
		try {
			const resolvedAppId = await resolveCvmAppId(appId);

			// Check if CVM is ready before restarting (not in_progress)
			const cvmInfo = await getCvmByAppId(resolvedAppId);

			if (cvmInfo.in_progress) {
				logger.warn("CVM is currently in progress (updating/restarting). Waiting for operation to complete...");

				// Wait for CVM to be ready using existing utility
				await waitForCvmReady(cvmInfo.vm_uuid, 300000, true);
			}

			const spinner = logger.startSpinner(
				`Restarting CVM with App ID app_${resolvedAppId}`,
			);

			// Retry logic to handle race conditions where CVM becomes in_progress
			// between our check and the API call
			let response;
			const maxRetries = 5;
			let retries = 0;
			const baseBackoffMs = 1000; // Start with 1 second

			while (retries <= maxRetries) {
				try {
					response = await restartCvm(resolvedAppId);
					break; // Success!
				} catch (error: any) {
					// Check if it's a 409 Conflict error
					const is409 = error.message?.includes("409") || error.status === 409;

					if (is409 && retries < maxRetries) {
						// CVM became in_progress between our check and API call
						const backoffMs = baseBackoffMs * Math.pow(2, retries);
						spinner.stop(true);
						logger.warn(`CVM is busy, retrying in ${backoffMs}ms... (attempt ${retries + 1}/${maxRetries})`);

						await new Promise(resolve => setTimeout(resolve, backoffMs));
						retries++;

						// Restart spinner for next attempt
						spinner.start();
					} else {
						// Not a 409 or max retries exceeded, re-throw
						throw error;
					}
				}
			}

			if (!response) {
				throw new Error(`Failed to restart CVM after ${maxRetries} retries due to conflicts`);
			}

			spinner.stop(true);
			logger.break();

			const tableData = {
				"CVM ID": response.id,
				Name: response.name,
				Status: response.status,
				"App ID": `app_${response.app_id}`,
				"App URL": response.app_url
					? response.app_url
					: `${CLOUD_URL}/dashboard/cvms/app_${response.app_id}`,
			};
			logger.keyValueTable(tableData, {
				borderStyle: "rounded",
			});

			logger.break();
			logger.success(
				`Your CVM is being restarted. You can check the dashboard for more details:\n${CLOUD_URL}/dashboard/cvms/app_${response.app_id}`,
			);
		} catch (error) {
			logger.error("Failed to restart CVM");
			logDetailedError(error);
			process.exit(1);
		}
	});
