import { getConfigValue } from "@/src/utils/config";
import { logDetailedError } from "@/src/utils/error-handling";
import { logger } from "@/src/utils/logger";
import { Command } from "commander";

export const getCommand = new Command()
	.name("get")
	.description("Get a configuration value")
	.argument("<key>", "Configuration key")
	.action((key) => {
		try {
			const value = getConfigValue(key);

			if (value === undefined) {
				logger.error(`Configuration key '${key}' not found`);
				process.exit(1);
			}

			logger.info(`${key}: ${JSON.stringify(value)}`);
		} catch (error) {
			logger.error("Failed to get configuration value");
			logDetailedError(error);
			process.exit(1);
		}
	});
