import { listConfigValues } from "@/src/utils/config";
import { logDetailedError } from "@/src/utils/error-handling";
import { logger } from "@/src/utils/logger";
import { Command } from "commander";

export const listCommand = new Command()
	.name("list")
	.alias("ls")
	.description("List all configuration values")
	.option("-j, --json", "Output in JSON format")
	.action((options) => {
		try {
			const config = listConfigValues();

			if (options.json) {
				console.log(JSON.stringify(config, null, 2));
				return;
			}

			logger.info("Configuration values:");
			for (const [key, value] of Object.entries(config)) {
				logger.info(`${key}: ${JSON.stringify(value)}`);
			}
		} catch (error) {
			logger.error("Failed to list configuration values");
			logDetailedError(error);
			process.exit(1);
		}
	});
