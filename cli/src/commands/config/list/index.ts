import { defineCommand } from "@/src/core/define-command";
import { listConfigValues } from "@/src/utils/config";
import { logDetailedError } from "@/src/utils/error-handling";
import { setJsonMode } from "@/src/utils/logger";
import type { CommandContext } from "@/src/core/types";
import {
	configListCommandMeta,
	configListCommandSchema,
	type ConfigListCommandInput,
} from "./command";

async function runConfigList(
	input: ConfigListCommandInput,
	context: CommandContext,
): Promise<number> {
	// Enable JSON mode if --json flag is set
	setJsonMode(input.json);

	try {
		const config = listConfigValues();

		if (input.json) {
			context.success(config);
			return 0;
		}

		context.stdout.write("Configuration values:\n");
		for (const [key, value] of Object.entries(config)) {
			context.stdout.write(`${key}: ${JSON.stringify(value)}\n`);
		}
		return 0;
	} catch (error) {
		logDetailedError(error);
		context.fail("Failed to list configuration values");
		return 1;
	}
}

export const configListCommand = defineCommand({
	path: ["config", "list"],
	meta: configListCommandMeta,
	schema: configListCommandSchema,
	handler: runConfigList,
});
