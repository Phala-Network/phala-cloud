import chalk from "chalk";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";
import { listAppsWithCvmStatus } from "@/src/lib/apps/list-apps-with-cvm-status";

import {
	appsCommandMeta,
	appsCommandSchema,
	type AppsCommandInput,
} from "./command";

function formatStatus(status: string): string {
	// per requirement: statuses ending with "ing" mean in progress
	if (status.toLowerCase().endsWith("ing")) return chalk.yellow(status);
	if (status === "running") return chalk.green(status);
	if (status === "stopped") return chalk.red(status);
	return chalk.yellow(status);
}

async function runAppsCommand(
	input: AppsCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);
		const result = await listAppsWithCvmStatus(client as never, {
			page: input.page,
			pageSize: input.pageSize,
			search: input.search,
			status: input.status,
			listed: input.listed,
			baseImage: input.baseImage,
			instanceType: input.instanceType,
			kmsType: input.kmsType,
			node: input.node,
			region: input.region,
		});

		if (result.success === false) {
			context.fail(result.error.message);
			return 1;
		}

		const data = result.data;

		if (input.json) {
			context.success(data);
			return 0;
		}

		const columns = ["APP_ID", "CVM", "STATUS", "UPTIME"] as const;
		const rows = data.items.map((item) => ({
			APP_ID: item.appId,
			CVM: item.cvmName,
			STATUS: formatStatus(item.status),
			UPTIME: item.uptime ?? "-",
		}));

		if (rows.length === 0) {
			logger.info("No CVMs found");
			return 0;
		}

		printTable(columns, rows);
		logger.info(`Page ${data.page}/${data.totalPages} (total ${data.total})`);
		return 0;
	} catch (error) {
		logger.logDetailedError(error);
		context.fail(
			`Failed to list apps: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return 1;
	}
}

export const appsCommand = defineCommand({
	path: ["apps"],
	meta: appsCommandMeta,
	schema: appsCommandSchema,
	handler: runAppsCommand,
});

export default appsCommand;
