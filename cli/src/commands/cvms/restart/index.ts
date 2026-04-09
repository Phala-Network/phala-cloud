import { safeGetCvmInfo, safeRestartCvm, type VM } from "@phala/cloud";
import { CLOUD_URL } from "@/src/utils/constants";
import { waitForCvmReady } from "@/src/utils/cvms";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import { retryOnConflict } from "@/src/utils/retry";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	cvmsRestartCommandMeta,
	cvmsRestartCommandSchema,
	type CvmsRestartCommandInput,
} from "./command";

async function runCvmsRestartCommand(
	input: CvmsRestartCommandInput,
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

		// Check if CVM is ready before restarting (not in_progress)
		const infoResult = await safeGetCvmInfo(client, context.cvmId);

		if (!infoResult.success) {
			context.fail(infoResult.error.message);
			return 1;
		}

		const cvmInfo = infoResult.data;

		if (cvmInfo.progress?.target) {
			logger.warn(
				"CVM is currently in progress (updating/restarting). Waiting for operation to complete...",
			);

			// Wait for CVM to be ready using existing utility
			await waitForCvmReady(cvmInfo.vm_uuid, 300000, context);
		}

		const spinner = logger.startSpinner("Restarting CVM");

		// Retry on conflict errors (409) with the shared utility
		const cvmId = context.cvmId;
		const result = await retryOnConflict(() => safeRestartCvm(client, cvmId), {
			spinner,
		});

		spinner.stop(true);

		if (!result.success) {
			context.fail(`Failed to restart CVM: ${result.error.message}`);
			return 1;
		}

		const response = result.data as VM;
		if (isJson) {
			context.success({
				cvm: response,
				dashboardUrl: `${CLOUD_URL}/dashboard/cvms/app_${response.app_id}`,
				message: "CVM restart requested",
			});
			return 0;
		}
		logger.break();

		logger.keyValueTable(
			{
				"CVM ID": response.id,
				Name: response.name,
				Status: response.status,
				"App ID": `app_${response.app_id}`,
				"App URL":
					response.app_url ||
					`${CLOUD_URL}/dashboard/cvms/app_${response.app_id}`,
			},
			{ borderStyle: "rounded" },
		);

		logger.break();
		logger.success(
			`Your CVM is being restarted. You can check the dashboard for more details:
${CLOUD_URL}/dashboard/cvms/app_${response.app_id}`,
		);
		return 0;
	} catch (error) {
		context.fail("Failed to restart CVM");
		logger.logDetailedError(error);
		return 1;
	}
}

export const cvmsRestartCommand = defineCommand({
	path: ["cvms", "restart"],
	meta: cvmsRestartCommandMeta,
	schema: cvmsRestartCommandSchema,
	handler: runCvmsRestartCommand,
});

export default cvmsRestartCommand;
