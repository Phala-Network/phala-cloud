import { safeStopCvm, type VM } from "@phala/cloud";
import { CLOUD_URL } from "@/src/utils/constants";
import { getClient } from "@/src/lib/client";
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
		const spinner = logger.startSpinner("Stopping CVM");

		const cvmId = context.cvmId;
		const result = await retryOnConflict(() => safeStopCvm(client, cvmId), {
			spinner,
		});

		spinner.stop(true);

		if (!result.success) {
			context.fail(`Failed to stop CVM: ${result.error.message}`);
			return 1;
		}

		const response = result.data as VM;
		if (isJson) {
			context.success({
				cvm: response,
				dashboardUrl: `${CLOUD_URL}/dashboard/cvms/app_${response.app_id}`,
				message: "CVM stop requested",
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
		context.fail("Failed to stop CVM");
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
