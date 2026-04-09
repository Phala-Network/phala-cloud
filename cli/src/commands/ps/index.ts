import { safeGetCvmContainersStats } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import { psCommandMeta, psCommandSchema, type PsCommandInput } from "./command";

function formatCreated(timestamp: number): string {
	const now = Date.now() / 1000;
	const diff = now - timestamp;

	if (diff < 60) return "Less than a minute ago";
	if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
	if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} days ago`;
	if (diff < 86400 * 365)
		return `${Math.floor(diff / (86400 * 30))} months ago`;
	return `${Math.floor(diff / (86400 * 365))} years ago`;
}

function containerName(names: string[]): string {
	const name = names[0] ?? "";
	return name.startsWith("/") ? name.slice(1) : name;
}

async function runPsCommand(
	input: PsCommandInput,
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
		const result = await safeGetCvmContainersStats(client, context.cvmId);

		if (!result.success) {
			context.fail(result.error.message);
			return 1;
		}

		const stats = result.data;

		if (!stats.is_online) {
			const errorMsg = stats.error ?? "CVM is offline";
			if (input.json) {
				context.success({ containers: [], error: errorMsg });
				return 0;
			}
			logger.warn(errorMsg);
			return 0;
		}

		const containers = stats.containers ?? [];

		if (input.json) {
			context.success({ containers });
			return 0;
		}

		if (containers.length === 0) {
			logger.info("No containers running");
			return 0;
		}

		const columns = ["NAME", "IMAGE", "CREATED", "STATUS", "STATE"] as const;
		const rows = containers.map((c) => ({
			NAME: containerName(c.names),
			IMAGE: c.image,
			CREATED: formatCreated(c.created),
			STATUS: c.status,
			STATE: c.state,
		}));

		const widths: Record<string, number> = {};
		for (const col of columns) {
			widths[col] = col.length;
			for (const row of rows) {
				widths[col] = Math.max(widths[col], row[col].length);
			}
		}

		const formatRow = (values: Record<string, string>) =>
			columns.map((col) => values[col].padEnd(widths[col])).join("  ");

		console.log(formatRow(Object.fromEntries(columns.map((c) => [c, c]))));
		for (const row of rows) {
			console.log(formatRow(row));
		}

		return 0;
	} catch (error) {
		logger.logDetailedError(error);
		context.fail(
			`Failed to list containers: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return 1;
	}
}

export const psCommand = defineCommand({
	path: ["ps"],
	meta: psCommandMeta,
	schema: psCommandSchema,
	handler: runPsCommand,
});

export default psCommand;
