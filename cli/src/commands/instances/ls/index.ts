import chalk from "chalk";
import { safeGetAppCvms } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";
import {
	instancesLsCommandMeta,
	instancesLsCommandSchema,
	type InstancesLsCommandInput,
} from "./command";

function formatStatus(status: string): string {
	if (status.toLowerCase().endsWith("ing")) return chalk.yellow(status);
	if (status === "running") return chalk.green(status);
	if (status === "stopped") return chalk.red(status);
	return chalk.yellow(status);
}

function resolveAppId(
	input: InstancesLsCommandInput,
	context: CommandContext,
): string {
	const appId = input.appId || context.projectConfig.app_id;
	if (!appId) {
		throw new Error(
			"No app ID provided. Pass --app-id or run `phala link` to create phala.toml with app_id.",
		);
	}
	return appId.replace(/^app_/, "").replace(/^0x/, "").toLowerCase();
}

async function runInstancesLsCommand(
	input: InstancesLsCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const appId = resolveAppId(input, context);
		const client = await getClient(context);

		const result = await safeGetAppCvms(client as never, { appId });
		if (!result.success) {
			const err = "error" in result ? result.error : undefined;
			context.fail(err?.message || "Failed to list instances");
			return 1;
		}

		const instances = result.data;

		if (input.json) {
			context.success(instances);
			return 0;
		}

		if (instances.length === 0) {
			logger.info("No instances found");
			return 0;
		}

		const columns = [
			"VM_UUID",
			"NAME",
			"STATUS",
			"UPTIME",
			"NODE",
			"REGION",
		] as const;
		const rows = instances.map((item) => {
			const nodeName =
				item.node_info && typeof item.node_info === "object"
					? (item.node_info.name ?? "-")
					: "-";
			const region =
				item.node_info && typeof item.node_info === "object"
					? (item.node_info.region ?? "-")
					: "-";
			return {
				VM_UUID: item.vm_uuid ?? "-",
				NAME: item.name,
				STATUS: formatStatus(item.status),
				UPTIME: "-",
				NODE: nodeName,
				REGION: region,
			};
		});

		printTable(columns, rows);
		return 0;
	} catch (error) {
		logger.logDetailedError(error);
		context.fail(
			`Failed to list instances: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return 1;
	}
}

export const instancesLsCommand = defineCommand({
	path: ["instances", "ls"],
	meta: instancesLsCommandMeta,
	schema: instancesLsCommandSchema,
	handler: runInstancesLsCommand,
});

export default instancesLsCommand;
