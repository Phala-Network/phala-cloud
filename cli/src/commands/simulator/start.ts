import { logDetailedError } from "@/src/utils/error-handling";
import { logger } from "@/src/utils/logger";
import {
	installSimulator,
	isSimulatorInstalled,
	isSimulatorRunning,
	runSimulator,
} from "@/src/utils/simulator";
import { Command } from "commander";

export const startCommand = new Command()
	.name("start")
	.description("Start the TEE simulator")
	.option("-p, --port <port>", "Simulator port (default: 8090)", "8090")
	.option("-v, --verbose", "Enable verbose output", false)
	.action(async (options) => {
		try {
			if (!isSimulatorInstalled()) {
				await installSimulator();
			}

			const running = await isSimulatorRunning();
			if (running) {
				logger.success("TEE simulator is already running");
				return;
			}

			const simulatorProcess = await runSimulator({
				verbose: options.verbose,
			});
			logger.success("TEE simulator started successfully");
		} catch (error) {
			logger.error("Failed to start TEE simulator");
			logDetailedError(error);
			process.exit(1);
		}
	});
