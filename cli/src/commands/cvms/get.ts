import { Command } from "commander";
import { safeGetCvmInfo } from "@phala/cloud";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import { CLOUD_URL } from "@/src/utils/constants";
import chalk from "chalk";
import { resolveCvmAppId } from "@/src/utils/cvms";
import type { CvmInfoResponse } from "@/src/api/types";

export const getCommand = new Command()
	.name("get")
	.description("Get details of a CVM")
	.argument("[id]", "ID of the CVM (optional)")
	.option("-j, --json", "Output in JSON format")
	.action(async (cvm_id, options) => {
		try {
			let spinner
			if (!options.json) {
				spinner = logger.startSpinner(
					`Fetching CVM with App ID ${cvm_id}`,
				);
			}

			const client = await getClient();
			const result = await safeGetCvmInfo(client, { id: cvm_id });

			if (spinner) {
				spinner.stop(true);
			}

			if (!result.success) {
				throw new Error(result.error.message);
			}

			const cvm = result.data as CvmInfoResponse;
			logger.break();

			if (!cvm) {
				logger.error(`CVM with App ID app_${cvm_id} not found`);
				process.exit(1);
			}

			if (options.json) {
				console.log(JSON.stringify(cvm, null, 2));
				return;
			}

			// Display additional details if available
			logger.keyValueTable({
				Name: cvm.name,
				"App ID": `app_${cvm.app_id}`,
				Status:
					cvm.status === "running"
						? chalk.green(cvm.status)
						: cvm.status === "stopped"
							? chalk.red(cvm.status)
							: chalk.yellow(cvm.status),
				vCPU: cvm.vcpu,
				Memory: `${cvm.memory} MB`,
				"Disk Size": `${cvm.disk_size} GB`,
				"Dstack Image": cvm.base_image,
				"App URL": `${CLOUD_URL}/dashboard/cvms/app_${cvm.app_id}`,
			});
		} catch (error) {
			logger.error(
				`Failed to get CVM details: ${error instanceof Error ? error.message : String(error)}`,
			);
			process.exit(1);
		}
	});
