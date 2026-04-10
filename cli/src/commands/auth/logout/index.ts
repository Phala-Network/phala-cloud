import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { loadCredentialsFile, removeProfile } from "@/src/utils/credentials";

import { logger } from "@/src/utils/logger";
import {
	logoutCommandMeta,
	logoutCommandSchema,
	type LogoutCommandInput,
} from "./command";

async function runLogoutCommand(
	_input: LogoutCommandInput,
	context: CommandContext,
): Promise<number> {
	// Show deprecation warning
	logger.warn(
		'The "phala auth logout" command is deprecated and will be removed in a future version.',
	);
	logger.info('Please use "phala logout" instead.');
	logger.break();

	try {
		const current = loadCredentialsFile();
		const profile = current?.current_profile;
		removeProfile();
		const message = profile
			? `Credentials removed successfully (profile: ${profile})`
			: "Credentials removed successfully";
		if (context.globalOptions?.json) {
			context.success({ message, profile: profile || null });
			return 0;
		}
		logger.success(message);
		return 0;
	} catch (error) {
		if (context.globalOptions?.json) {
			context.fail("Failed to remove credentials");
			return 1;
		}
		logger.error("Failed to remove credentials");
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
