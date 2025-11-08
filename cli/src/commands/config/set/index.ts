import { defineCommand } from "@/src/core/define-command";
import { setConfigValue } from "@/src/utils/config";

import type { CommandContext } from "@/src/core/types";
import {
	configSetCommandMeta,
	configSetCommandSchema,
	type ConfigSetCommandInput,
} from "./command";

async function runConfigSet(
	input: ConfigSetCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		// Try to parse the value as JSON if it looks like a JSON value
		let parsedValue: unknown = input.value;
		if (
			input.value.startsWith("{") ||
			input.value.startsWith("[") ||
			input.value === "true" ||
			input.value === "false" ||
			!Number.isNaN(Number(input.value))
		) {
			try {
				parsedValue = JSON.parse(input.value);
			} catch (e) {
				// If parsing fails, use the original string value
			}
		}

		setConfigValue(input.key, parsedValue as string | number | boolean);
		context.stdout.write(
			`Configuration value for '${input.key}' set successfully\n`,
		);
		return 0;
	} catch (error) {
		context.stderr.write("Failed to set configuration value\n");
		logger.logDetailedError(error);
		return 1;
	}
}

export const configSetCommand = defineCommand({
	path: ["config", "set"],
	meta: configSetCommandMeta,
	schema: configSetCommandSchema,
	handler: runConfigSet,
});
