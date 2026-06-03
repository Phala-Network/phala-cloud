import chalk from "chalk";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient, resolveTimeoutSeconds } from "@/src/lib/client";
import { listAppsWithCvmStatus } from "@/src/lib/apps/list-apps-with-cvm-status";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";

function isTimeoutCause(cause: unknown): boolean {
	return (
		cause !== null &&
		typeof cause === "object" &&
		"code" in cause &&
		(cause as { code?: unknown }).code === "TIMEOUT"
	);
}

function formatTimeoutMessage(timeoutSeconds: number): string {
	return `Request timed out after ${timeoutSeconds}s.\n  Retry with --timeout <seconds> to allow more time.`;
}

import {
	cvmsListCommandMeta,
	cvmsListCommandSchema,
	type CvmsListCommandInput,
} from "./command";

function formatStatus(status: string): string {
	if (status.toLowerCase().endsWith("ing")) return chalk.yellow(status);
	if (status === "running") return chalk.green(status);
	if (status === "stopped") return chalk.red(status);
	return chalk.yellow(status);
}

async function runCvmsListCommand(
	input: CvmsListCommandInput,
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
			showReplicas: input.showReplicas,
		});

		if (result.success === false) {
			const cause = result.error.cause;
			logger.logDetailedError(cause ?? result.error);
			const message = isTimeoutCause(cause)
				? formatTimeoutMessage(resolveTimeoutSeconds(context))
				: result.error.message;
			context.fail(message);
			return 1;
		}

		const data = result.data;

		if (input.json) {
			context.success(data);
			return 0;
		}

		const columns = input.showReplicas
			? (["APP_ID", "CVM", "VM_UUID", "STATUS", "UPTIME", "REPLICAS"] as const)
			: (["APP_ID", "CVM", "STATUS", "UPTIME", "REPLICAS"] as const);
		const rows = data.items.map((item) => {
			const row: Record<string, string> = {
				APP_ID: item.appId,
				CVM: item.cvmName,
				STATUS: formatStatus(item.status),
				UPTIME: item.uptime ?? "-",
				REPLICAS: input.showReplicas
					? `${item.replicaIndex}/${item.replicaCount}`
					: String(item.replicaCount),
			};
			if (input.showReplicas) row.VM_UUID = item.vmUuid;
			return row;
		});

		if (rows.length === 0) {
			logger.info("No CVMs found");
			return 0;
		}

		printTable(columns, rows);
		logger.info(`Page ${data.page}/${data.totalPages} (total ${data.total})`);
		if (
			!input.showReplicas &&
			data.items.some((item) => item.replicaCount > 1)
		) {
			logger.info(
				"Some apps have multiple replicas. Use --show-replicas to list every CVM.",
			);
		}
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
