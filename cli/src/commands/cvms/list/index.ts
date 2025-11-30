import chalk from "chalk";
import { safeGetAppsList, type AppCvmInfo } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { CLOUD_URL } from "@/src/utils/constants";

import { logger, setJsonMode } from "@/src/utils/logger";
import {
	cvmsListCommandMeta,
	cvmsListCommandSchema,
	type CvmsListCommandInput,
} from "./command";


async function runCvmsListCommand(
	input: CvmsListCommandInput,
	context: CommandContext,
): Promise<number> {
	// Enable JSON mode if --json flag is set
	setJsonMode(input.json);

	try {
		const spinner = logger.startSpinner("Fetching CVMs");

		const client = await getClient();

		// Fetch all pages
		const allCvms: AppCvmInfo[] = [];
		let page = 1;
		const pageSize = 100;

		while (true) {
			const result = await safeGetAppsList(client, {
				page,
				page_size: pageSize,
			});

			if (!result.success) {
				spinner.stop(true);
				context.fail(result.error.message);
				return 1;
			}

			const cvms = result.data.dstack_apps.flatMap((app) => app.cvms);
			allCvms.push(...cvms);

			if (page >= result.data.total_pages) {
				break;
			}
			page++;
		}

		spinner.stop(true);

		if (input.json) {
			context.success({ items: allCvms });
			return 0;
		}

		// Human-readable output
		if (allCvms.length === 0) {
			logger.info("No CVMs found");
			return 0;
		}

		for (const cvm of allCvms) {
			const formattedStatus =
				cvm.status === "running"
					? chalk.green(cvm.status)
					: cvm.status === "stopped"
						? chalk.red(cvm.status)
						: chalk.yellow(cvm.status ?? "unknown");

			logger.keyValueTable(
				{
					Name: cvm.name || "Unknown",
					"App ID": `app_${cvm.app_id || "unknown"}`,
					"CVM ID": cvm.vm_uuid?.replace(/-/g, "") || "unknown",
					Region: cvm.region_identifier || "N/A",
					Status: formattedStatus,
					"App URL": `${CLOUD_URL}/dashboard/cvms/${
						cvm.vm_uuid?.replace(/-/g, "") || "unknown"
					}`,
				},
				{ borderStyle: "rounded" },
			);
			logger.break();
		}

		logger.success(`Found ${allCvms.length} CVMs`);
		logger.break();
		logger.info(`Go to ${CLOUD_URL}/dashboard/ to view your CVMs`);
		return 0;
	} catch (error) {
		logger.logDetailedError(error);
		context.fail(
			`Failed to list CVMs: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return 1;
	}
}

export const cvmsListCommand = defineCommand({
	path: ["cvms", "list"],
	meta: cvmsListCommandMeta,
	schema: cvmsListCommandSchema,
	handler: runCvmsListCommand,
});

export default cvmsListCommand;
