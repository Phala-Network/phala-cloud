import { removeApiKey } from "@/src/utils/credentials";
import { logDetailedError } from "@/src/utils/error-handling";
import { logger } from "@/src/utils/logger";
import { Command } from "commander";

export const logoutCommand = new Command()
	.name("logout")
	.description("Remove the stored API key")
	.action(async () => {
		try {
			await removeApiKey();
			logger.success("API key removed successfully");
		} catch (error) {
			logger.error("Failed to remove API key");
			logDetailedError(error);
			process.exit(1);
		}
	});
