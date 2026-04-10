import { safeGetWorkspaceNodes, safeGetCurrentUser } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext, CommandMeta } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";
import {
	nodesListCommandMeta,
	nodesListCommandSchema,
	type NodesListCommandInput,
} from "./command";

async function runNodesListCommand(
	input: NodesListCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);

		// Get current workspace to obtain teamSlug
		const userResult = await safeGetCurrentUser(client);
		if (!userResult.success) {
			context.fail(userResult.error.message);
			return 1;
		}

		const teamSlug = userResult.data.workspace.slug;
		if (!teamSlug) {
			context.fail("Workspace slug is not available. Please contact support.");
			return 1;
		}

		// Get workspace nodes
		const result = await safeGetWorkspaceNodes(client, {
			teamSlug,
			page: input.page,
			pageSize: input.pageSize,
		});

		if (!result.success) {
			context.fail(result.error.message);
			return 1;
		}

		const data = result.data;

		if (input.json) {
			context.success(data);
			return 0;
		}

		const columns = [
			"ID",
			"NAME",
			"REGION",
			"PPID",
			"DEVICE_ID",
			"VERSION",
		] as const;
		const rows = data.items.map((node) => ({
			ID: node.id?.toString() ?? "-",
			NAME: node.name ?? "-",
			REGION: node.region ?? "-",
			PPID: node.ppid ?? "-",
			DEVICE_ID: node.device_id ?? "-",
			VERSION: node.version?.split(" ")[0] ?? "-",
		}));

		if (rows.length === 0) {
			logger.info("No nodes found");
			return 0;
		}

		printTable(columns, rows);
		logger.info(`Page ${data.page}/${data.pages} (total ${data.total})`);
		return 0;
	} catch (error) {
		logger.logDetailedError(error);
		context.fail(
			`Failed to list nodes: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return 1;
	}
}

const nodesRootCommandMeta: CommandMeta = {
	name: "nodes",
	description: "List and manage TEE nodes",
	stability: "unstable",
};

export const nodesListCommand = defineCommand({
	path: ["nodes", "list"],
	meta: nodesListCommandMeta,
	schema: nodesListCommandSchema,
	handler: runNodesListCommand,
});

export const nodesCommand = defineCommand({
	path: ["nodes"],
	meta: nodesRootCommandMeta,
	schema: nodesListCommandSchema,
	handler: runNodesListCommand,
});

export default nodesListCommand;
