import {
	simulatorStartCommandMeta,
	simulatorStartCommandSchema,
	type SimulatorStartCommandInput,
} from "./command";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";

import { logger } from "@/src/utils/logger";
import {
	installSimulator,
	isSimulatorInstalled,
	isSimulatorRunning,
	runSimulator,
} from "@/src/utils/simulator";

async function runSimulatorStart(
	input: SimulatorStartCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		if (!isSimulatorInstalled()) {
			await installSimulator();
		}

		const running = await isSimulatorRunning();
		if (running) {
			logger.success("TEE simulator is already running");
			return 0;
		}

		await runSimulator({
			verbose: input.verbose,
		});
		logger.success("TEE simulator started successfully");
		return 0;
	} catch (error) {
		logger.error("Failed to start TEE simulator");
		logger.logDetailedError(error);
		return 1;
	}
}

export const simulatorStartCommand = defineCommand({
	path: ["simulator", "start"],
	meta: simulatorStartCommandMeta,
	schema: simulatorStartCommandSchema,
	handler: runSimulatorStart,
});

export default simulatorStartCommand;
