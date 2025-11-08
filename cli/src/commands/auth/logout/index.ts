import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { removeApiKey } from "@/src/utils/credentials";

import { logger } from "@/src/utils/logger";
import {
	logoutCommandMeta,
	logoutCommandSchema,
	type LogoutCommandInput,
} from "./command";

async function runLogoutCommand(
	_input: LogoutCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		await removeApiKey();
		logger.success("API key removed successfully");
		return 0;
	} catch (error) {
		logger.error("Failed to remove API key");
		logger.logDetailedError(error);
		return 1;
	}
}

export const logoutCommand = defineCommand({
	path: ["auth", "logout"],
	meta: logoutCommandMeta,
	schema: logoutCommandSchema,
	handler: runLogoutCommand,
});

export default logoutCommand;
