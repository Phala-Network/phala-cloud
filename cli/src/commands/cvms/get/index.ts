import chalk from "chalk";
import { safeGetCvmInfo } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import type { CvmInfoResponse } from "@/src/api/types";
import { getClient } from "@/src/lib/client";
import { CLOUD_URL } from "@/src/utils/constants";
import { resolveCvmAppId } from "@/src/utils/cvms";
import { logger, setJsonMode } from "@/src/utils/logger";
import {
	cvmsGetCommandMeta,
	cvmsGetCommandSchema,
	type CvmsGetCommandInput,
} from "./command";

async function runCvmsGetCommand(
	input: CvmsGetCommandInput,
	context: CommandContext,
): Promise<number> {
	// Enable JSON mode if --json flag is set
	setJsonMode(input.json);

	try {
		const resolvedAppId = await resolveCvmAppId(input.appId);
		const cleanAppId = resolvedAppId?.replace(/^app_/, "") ?? "";

		if (!cleanAppId) {
			context.fail("No CVM App ID provided.");
			return 1;
		}

		const spinner = logger.startSpinner(
			`Fetching CVM with App ID app_${cleanAppId}`,
		);

		const client = await getClient();
		const result = await safeGetCvmInfo(client, { app_id: cleanAppId });

		spinner.stop(true);

		if (!result.success) {
			context.fail(result.error.message);
			return 1;
		}

		const cvm = result.data as CvmInfoResponse | undefined;

		if (!cvm) {
			context.fail(`CVM with App ID app_${resolvedAppId} not found`);
			return 1;
		}

		if (input.json) {
			context.success(cvm);
			return 0;
		}

		logger.break();

		const statusColour =
			cvm.status === "running"
				? chalk.green(cvm.status)
				: cvm.status === "stopped"
					? chalk.red(cvm.status)
					: chalk.yellow(cvm.status);

		logger.keyValueTable({
			Name: cvm.name,
			"App ID": `app_${cvm.app_id}`,
			Status: statusColour,
			vCPU: cvm.vcpu,
			Memory: `${cvm.memory} MB`,
			"Disk Size": `${cvm.disk_size} GB`,
			"Dstack Image": cvm.base_image,
			"App URL": `${CLOUD_URL}/dashboard/cvms/app_${cvm.app_id}`,
		});

		return 0;
	} catch (error) {
		logger.logDetailedError(error);
		context.fail(
			`Failed to get CVM details: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return 1;
	}
}

export const cvmsGetCommand = defineCommand({
	path: ["cvms", "get"],
	meta: cvmsGetCommandMeta,
	schema: cvmsGetCommandSchema,
	handler: runCvmsGetCommand,
});

export default cvmsGetCommand;
