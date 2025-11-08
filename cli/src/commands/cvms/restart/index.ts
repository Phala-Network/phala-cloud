import { getCvmByAppId, restartCvm } from "@/src/api/cvms";
import { CLOUD_URL } from "@/src/utils/constants";
import { resolveCvmAppId, waitForCvmReady } from "@/src/utils/cvms";

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
	_context: CommandContext,
): Promise<number> {
	try {
		const resolvedAppId = await resolveCvmAppId(input.appId);

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

		// Retry on conflict errors (409) with the shared utility
		const response = await retryOnConflict(
			() => restartCvm(resolvedAppId),
			{ spinner }
		);

		spinner.stop(true);
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
		logger.error("Failed to restart CVM");
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
