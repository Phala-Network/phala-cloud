import chalk from "chalk";
import { safeGetCvmInfo } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { CLOUD_URL } from "@/src/utils/constants";
import { logger } from "@/src/utils/logger";
import {
	cvmsGetCommandMeta,
	cvmsGetCommandSchema,
	type CvmsGetCommandInput,
} from "./command";

async function runCvmsGetCommand(
	input: CvmsGetCommandInput,
	context: CommandContext,
): Promise<number> {
	if (!context.cvmId) {
		context.fail(
			"No CVM ID provided. Use --interactive to select interactively.",
		);
		return 1;
	}

	try {
		const spinner = logger.startSpinner("Fetching CVM details");

		const client = await getClient(context);
		const result = await safeGetCvmInfo(client, context.cvmId);

		spinner.stop(true);

		if (!result.success) {
			context.failWithError(result.error.cause ?? result.error, {
				operation: "Get CVM",
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			return 1;
		}

		const cvm = result.data;

		if (!cvm) {
			context.fail("CVM not found");
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
			vCPU: cvm.resource.vcpu,
			Memory:
				cvm.resource.memory_in_gb != null
					? `${cvm.resource.memory_in_gb} GB`
					: "N/A",
			"Disk Size":
				cvm.resource.disk_in_gb != null
					? `${cvm.resource.disk_in_gb} GB`
					: "N/A",
			"Dstack Image": cvm.os?.name,
			"App URL": `${CLOUD_URL}/dashboard/cvms/app_${cvm.app_id}`,
		});

		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Get CVM",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
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
