import inquirer from "inquirer";
import { safeDeleteCvm } from "@phala/cloud";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	instancesRmCommandMeta,
	instancesRmCommandSchema,
	type InstancesRmCommandInput,
} from "./command";

async function runInstancesRmCommand(
	input: InstancesRmCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);
		const isJson = context.globalOptions?.json === true;

		if (!input.force && !input.yes) {
			const label =
				input.vmUuids.length === 1
					? `instance "${input.vmUuids[0]}"`
					: `${input.vmUuids.length} instances`;
			const { confirm } = await inquirer.prompt([
				{
					type: "confirm",
					name: "confirm",
					message: `Are you sure you want to delete ${label}? This action cannot be undone.`,
					default: false,
				},
			]);

			if (!confirm) {
				if (isJson) {
					context.success({
						deleted: false,
						cancelled: true,
						vm_uuids: input.vmUuids,
					});
					return 0;
				}
				logger.info("Deletion cancelled");
				return 0;
			}
		}

		const results: Array<{
			vm_uuid: string;
			deleted: boolean;
			error?: string;
		}> = [];

		for (const vmUuid of input.vmUuids) {
			const result = await safeDeleteCvm(client, { id: vmUuid });
			if (result.success) {
				results.push({ vm_uuid: vmUuid, deleted: true });
				if (!isJson) {
					logger.success(`Instance ${vmUuid} deleted successfully`);
				}
			} else {
				results.push({
					vm_uuid: vmUuid,
					deleted: false,
					error: result.error.message,
				});
				if (!isJson) {
					logger.error(
						`Failed to delete instance ${vmUuid}: ${result.error.message}`,
					);
				}
			}
		}

		if (isJson) {
			context.success(results);
			return 0;
		}

		const failed = results.filter((r) => !r.deleted);
		return failed.length > 0 ? 1 : 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Remove instance",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}
}

export const instancesRmCommand = defineCommand({
	path: ["instances", "rm"],
	meta: instancesRmCommandMeta,
	schema: instancesRmCommandSchema,
	handler: runInstancesRmCommand,
});

export default instancesRmCommand;
