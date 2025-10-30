import { Command } from "commander";
import { safeGetCvmList } from "@phala/cloud";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import { CLOUD_URL } from "@/src/utils/constants";
import chalk from "chalk";
import type { CvmListResponse } from "@/src/api/types";

export const listCommand = new Command()
	.name("list")
	.alias("ls")
	.description("List all CVMs")
	.option("-j, --json", "Output in JSON format")
	.action(async (options) => {
		try {
			let spinner;
			if (!options.json) {
				spinner = logger.startSpinner("Fetching CVMs");
			}

			const client = await getClient();
			const result = await safeGetCvmList(client);

			if (spinner) {
				spinner.stop(true);
			}

			if (!result.success) {
				throw new Error(result.error.message);
			}

			const cvmList = result.data as CvmListResponse;
			const cvms = cvmList.items;

			if (!cvms || cvms.length === 0) {
				logger.info("No CVMs found");
				return;
			}

			if (options.json) {
				console.log(JSON.stringify(cvms, null, 2));
				return;
			}

			for (const cvm of cvms) {
				const item = cvm as {
					name?: string;
					hosted?: { app_id?: string; id?: string; app_url?: string };
					node?: { region_identifier?: string };
					status?: string;
				};
				logger.keyValueTable({
					Name: item.name || "Unknown",
					"App ID": `app_${item.hosted?.app_id || "unknown"}`,
					"CVM ID": item.hosted?.id?.replace(/-/g, "") || "unknown",
					Region: item.node?.region_identifier || "N/A",
					Status:
						item.status === "running"
							? chalk.green(item.status)
							: item.status === "stopped"
								? chalk.red(item.status)
								: chalk.yellow(item.status || "unknown"),
					"Node Info URL": item.hosted?.app_url || "N/A",
					"App URL": `${CLOUD_URL}/dashboard/cvms/${item.hosted?.id?.replace(/-/g, "") || "unknown"}`,
				});
				logger.break();
			}
			logger.success(`Found ${cvms.length} CVMs`);
			logger.break();
			logger.info(`Go to ${CLOUD_URL}/dashboard/ to view your CVMs`);
		} catch (error) {
			logger.error(
				`Failed to list CVMs: ${error instanceof Error ? error.message : String(error)}`,
			);
			process.exit(1);
		}
	});
