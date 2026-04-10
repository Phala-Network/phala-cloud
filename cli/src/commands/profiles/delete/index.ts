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
	context: CommandContext,
): Promise<number> {
	try {
		const wasActive = getCurrentProfile()?.name === input.profileName;
		const profilesBefore = listProfiles();

		if (!profilesBefore.includes(input.profileName)) {
			if (context.globalOptions?.json) {
				context.fail(`Profile "${input.profileName}" not found`);
				return 1;
			}
			logger.error(`Profile "${input.profileName}" not found`);
			return 1;
		}

		removeProfile(input.profileName);
		const newCurrent = getCurrentProfile();

		if (context.globalOptions?.json) {
			context.success({
				deleted: input.profileName,
				wasActive,
				currentProfile: newCurrent?.name || null,
			});
			return 0;
		}

		logger.success(`Deleted profile "${input.profileName}"`);
		if (wasActive) {
			if (newCurrent) {
				logger.info(`Switched to profile "${newCurrent.name}"`);
			} else {
				logger.info("No profiles remaining. Please login again.");
			}
		}

		return 0;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (context.globalOptions?.json) {
			context.fail(message);
			return 1;
		}
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
