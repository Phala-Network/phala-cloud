import { setConfigValue } from "@/src/utils/config";
import { logDetailedError } from "@/src/utils/error-handling";
import { logger } from "@/src/utils/logger";
import { Command } from "commander";

export const setCommand = new Command()
	.name("set")
	.description("Set a configuration value")
	.argument("<key>", "Configuration key")
	.argument("<value>", "Configuration value")
	.action((key, value) => {
		try {
			// Try to parse the value as JSON if it looks like a JSON value
			let parsedValue = value;
			if (
				value.startsWith("{") ||
				value.startsWith("[") ||
				value === "true" ||
				value === "false" ||
				!Number.isNaN(Number(value))
			) {
				try {
					parsedValue = JSON.parse(value);
				} catch (e) {
					// If parsing fails, use the original string value
				}
			}

			setConfigValue(key, parsedValue);
			logger.success(`Configuration value for '${key}' set successfully`);
		} catch (error) {
			logger.error("Failed to set configuration value");
			logDetailedError(error);
			process.exit(1);
		}
	});
