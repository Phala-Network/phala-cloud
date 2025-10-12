import { stopSimulator } from "@/src/utils/simulator";
import { Command } from "commander";
import { logDetailedError } from "../../utils/error-handling";
import { logger } from "../../utils/logger";

export const stopCommand = new Command()
	.name("stop")
	.description("Stop the TEE simulator")
	.action(async () => {
		try {
			// Stop the simulator
			const success = await stopSimulator();

			if (!success) {
				logger.error("Failed to stop TEE simulator");
				process.exit(1);
			}

			logger.success("TEE simulator stopped successfully");
		} catch (error) {
			logger.error("Failed to stop TEE simulator");
			logDetailedError(error);
			process.exit(1);
		}
	});
