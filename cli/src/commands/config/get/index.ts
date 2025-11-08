import { defineCommand } from "@/src/core/define-command";
import { getConfigValue } from "@/src/utils/config";

import type { CommandContext } from "@/src/core/types";
import {
	configGetCommandMeta,
	configGetCommandSchema,
	type ConfigGetCommandInput,
} from "./command";

async function runConfigGet(
	input: ConfigGetCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const value = getConfigValue(input.key);

		if (value === undefined) {
			context.stderr.write(`Configuration key '${input.key}' not found\n`);
			return 1;
		}

		context.stdout.write(`${input.key}: ${JSON.stringify(value)}\n`);
		return 0;
	} catch (error) {
		context.stderr.write("Failed to get configuration value\n");
		logger.logDetailedError(error);
		return 1;
	}
}

export const configGetCommand = defineCommand({
	path: ["config", "get"],
	meta: configGetCommandMeta,
	schema: configGetCommandSchema,
	handler: runConfigGet,
});
