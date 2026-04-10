import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { renameProfile, getCurrentProfile } from "@/src/utils/credentials";
import { logger } from "@/src/utils/logger";
import {
	profilesRenameCommandMeta,
	profilesRenameCommandSchema,
	type ProfilesRenameCommandInput,
} from "./command";

async function runProfilesRenameCommand(
	input: ProfilesRenameCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const wasActive = getCurrentProfile()?.name === input.oldName;
		renameProfile(input.oldName, input.newName);
		if (context.globalOptions?.json) {
			context.success({
				oldName: input.oldName,
				newName: input.newName,
				wasActive,
			});
			return 0;
		}
		logger.success(`Renamed profile "${input.oldName}" to "${input.newName}"`);
		if (wasActive) {
			logger.info(`Current profile updated to "${input.newName}"`);
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

export const profilesRenameCommand = defineCommand({
	path: ["profiles", "rename"],
	meta: profilesRenameCommandMeta,
	schema: profilesRenameCommandSchema,
	handler: runProfilesRenameCommand,
});

export default profilesRenameCommand;
