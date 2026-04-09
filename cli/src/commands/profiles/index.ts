import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	listProfiles,
	getCurrentProfile,
	loadCredentialsFile,
} from "@/src/utils/credentials";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";
import {
	profilesCommandMeta,
	profilesCommandSchema,
	type ProfilesCommandInput,
} from "./command";

async function runProfilesCommand(
	_input: ProfilesCommandInput,
	_context: CommandContext,
): Promise<number> {
	const profiles = listProfiles();
	const currentProfile = getCurrentProfile();

	if (profiles.length === 0) {
		logger.warn("No profiles found. Please login first.");
		return 0;
	}

	const credentials = loadCredentialsFile();
	const columns = ["PROFILE", "WORKSPACE", "USER", "API ENDPOINT", ""] as const;
	const rows = profiles.map((profile) => {
		const isCurrent = currentProfile?.name === profile;
		const profileInfo = credentials?.profiles[profile];
		return {
			PROFILE: profile,
			WORKSPACE: profileInfo?.workspace?.name || "",
			USER: profileInfo?.user?.username || "",
			"API ENDPOINT": profileInfo?.api_prefix || "",
			"": isCurrent ? "*" : "",
		};
	});

	printTable(columns, rows);
	return 0;
}

export const profilesCommand = defineCommand({
	path: ["profiles"],
	meta: profilesCommandMeta,
	schema: profilesCommandSchema,
	handler: runProfilesCommand,
});

export { profilesUseCommand } from "./use";
export { profilesRenameCommand } from "./rename";
export { profilesDeleteCommand } from "./delete";

export default profilesCommand;
