import {
	simulatorStopCommandMeta,
	simulatorStopCommandSchema,
	type SimulatorStopCommandInput,
} from "./command";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";

import { logger } from "@/src/utils/logger";
import { stopSimulator } from "@/src/utils/simulator";

async function runSimulatorStop(
	_input: SimulatorStopCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		const success = await stopSimulator();

		if (!success) {
			logger.error("Failed to stop TEE simulator");
			return 1;
		}

		logger.success("TEE simulator stopped successfully");
		return 0;
	} catch (error) {
		logger.error("Failed to stop TEE simulator");
		logger.logDetailedError(error);
		return 1;
	}
}

export const simulatorStopCommand = defineCommand({
	path: ["simulator", "stop"],
	meta: simulatorStopCommandMeta,
	schema: simulatorStopCommandSchema,
	handler: runSimulatorStop,
});

export default simulatorStopCommand;
