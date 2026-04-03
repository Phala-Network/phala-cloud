import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	removeProfile,
	getCurrentProfile,
	listProfiles,
} from "@/src/utils/credentials";
import { logger } from "@/src/utils/logger";
import {
	profilesDeleteCommandMeta,
	profilesDeleteCommandSchema,
	type ProfilesDeleteCommandInput,
} from "./command";

async function runProfilesDeleteCommand(
	input: ProfilesDeleteCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		const wasActive = getCurrentProfile()?.name === input.profileName;
		const profilesBefore = listProfiles();

		if (!profilesBefore.includes(input.profileName)) {
			logger.error(`Profile "${input.profileName}" not found`);
			return 1;
		}

		removeProfile(input.profileName);
		logger.success(`Deleted profile "${input.profileName}"`);

		if (wasActive) {
			const newCurrent = getCurrentProfile();
			if (newCurrent) {
				logger.info(`Switched to profile "${newCurrent.name}"`);
			} else {
				logger.info("No profiles remaining. Please login again.");
			}
		}

		return 0;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error(message);
		return 1;
	}
}

export const profilesDeleteCommand = defineCommand({
	path: ["profiles", "delete"],
	meta: profilesDeleteCommandMeta,
	schema: profilesDeleteCommandSchema,
	handler: runProfilesDeleteCommand,
});

export default profilesDeleteCommand;
