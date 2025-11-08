import { stopCvm } from "@/src/api/cvms";
import { CLOUD_URL } from "@/src/utils/constants";
import { resolveCvmAppId } from "@/src/utils/cvms";

import { logger } from "@/src/utils/logger";
import { retryOnConflict } from "@/src/utils/retry";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	cvmsStopCommandMeta,
	cvmsStopCommandSchema,
	type CvmsStopCommandInput,
} from "./command";

async function runCvmsStopCommand(
	input: CvmsStopCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		const resolvedAppId = await resolveCvmAppId(input.appId);

		const spinner = logger.startSpinner(
			`Stopping CVM with App ID app_${resolvedAppId}`,
		);

		const response = await retryOnConflict(
			() => stopCvm(resolvedAppId),
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
			},
			{ borderStyle: "rounded" },
		);

		logger.break();
		logger.success(
			`Your CVM is being stopped. You can check the dashboard for more details:
${CLOUD_URL}/dashboard/cvms/app_${response.app_id}`,
		);
		return 0;
	} catch (error) {
		logger.error("Failed to stop CVM");
		logger.logDetailedError(error);
		return 1;
	}
}

export const cvmsStopCommand = defineCommand({
	path: ["cvms", "stop"],
	meta: cvmsStopCommandMeta,
	schema: cvmsStopCommandSchema,
	handler: runCvmsStopCommand,
});

export default cvmsStopCommand;
