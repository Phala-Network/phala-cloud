import {
	listAllInstanceTypeFamilies,
	listFamilyInstanceTypes,
} from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";
import {
	instanceTypesCommandMeta,
	instanceTypesCommandSchema,
	type InstanceTypesCommandInput,
} from "./command";

function formatMemoryGB(memoryMb: number): string {
	return (memoryMb / 1024).toFixed(0);
}

function formatHourlyRate(rate: string): string {
	return `$${rate}`;
}

async function runInstanceTypesCommand(
	input: InstanceTypesCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);

		// If family is specified, list only that family
		if (input.family) {
			const result = await listFamilyInstanceTypes(client, {
				family: input.family,
			});

			if (input.json) {
				context.success(result);
				return 0;
			}

			const columns = [
				"ID",
				"NAME",
				"vCPU",
				"Memory(GB)",
				"Hourly Rate",
				"GPU",
			] as const;
			const rows = result.items.map((item) => ({
				ID: item.id,
				NAME: item.name,
				vCPU: item.vcpu.toString(),
				"Memory(GB)": formatMemoryGB(item.memory_mb),
				"Hourly Rate": formatHourlyRate(item.hourly_rate),
				GPU: item.requires_gpu ? "Yes" : "No",
			}));

			if (rows.length === 0) {
				logger.info(`No instance types found for family '${input.family}'`);
				return 0;
			}

			printTable(columns, rows);
			logger.info(`Total: ${result.total} instance types`);
			return 0;
		}

		// List all families
		const result = await listAllInstanceTypeFamilies(client);

		if (input.json) {
			context.success(result);
			return 0;
		}

		if (result.result.length === 0) {
			logger.info("No instance types found");
			return 0;
		}

		const columns = [
			"ID",
			"NAME",
			"vCPU",
			"Memory(GB)",
			"Hourly Rate",
		] as const;

		for (const familyGroup of result.result) {
			logger.info(`\nFamily: ${familyGroup.name} (${familyGroup.total} types)`);

			const rows = familyGroup.items.map((item) => ({
				ID: item.id,
				NAME: item.name,
				vCPU: item.vcpu.toString(),
				"Memory(GB)": formatMemoryGB(item.memory_mb),
				"Hourly Rate": formatHourlyRate(item.hourly_rate),
			}));

			printTable(columns, rows);
		}

		return 0;
	} catch (error) {
		logger.logDetailedError(error);
		context.fail(
			`Failed to list instance types: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return 1;
	}
}

export const instanceTypesCommand = defineCommand({
	path: ["instance-types"],
	meta: instanceTypesCommandMeta,
	schema: instanceTypesCommandSchema,
	handler: runInstanceTypesCommand,
});

export default instanceTypesCommand;
