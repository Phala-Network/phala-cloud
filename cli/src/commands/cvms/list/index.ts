import chalk from "chalk";
import { safeGetCvmList } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import type { CvmListResponse } from "@/src/api/types";
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
		const result = await safeGetCvmList(client);

		spinner.stop(true);

		if (!result.success) {
			context.fail(result.error.message);
			return 1;
		}

		const cvms = (result.data as CvmListResponse).items ?? [];

		// Always return the list (context.success handles JSON vs human output)
		if (input.json) {
			context.success({ items: cvms });
			return 0;
		}

		// Human-readable output
		if (cvms.length === 0) {
			logger.info("No CVMs found");
			return 0;
		}

		for (const cvm of cvms) {
			const item = cvm as {
				name?: string;
				hosted?: { app_id?: string; id?: string; app_url?: string };
				node?: { region_identifier?: string };
				status?: string;
			};

			const formattedStatus =
				item.status === "running"
					? chalk.green(item.status)
					: item.status === "stopped"
						? chalk.red(item.status)
						: chalk.yellow(item.status ?? "unknown");

			logger.keyValueTable(
				{
					Name: item.name || "Unknown",
					"App ID": `app_${item.hosted?.app_id || "unknown"}`,
					"CVM ID": item.hosted?.id?.replace(/-/g, "") || "unknown",
					Region: item.node?.region_identifier || "N/A",
					Status: formattedStatus,
					"Node Info URL": item.hosted?.app_url || "N/A",
					"App URL": `${CLOUD_URL}/dashboard/cvms/${
						item.hosted?.id?.replace(/-/g, "") || "unknown"
					}`,
				},
				{ borderStyle: "rounded" },
			);
			logger.break();
		}

		logger.success(`Found ${cvms.length} CVMs`);
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
