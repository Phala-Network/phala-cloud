import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { resolveAuthForContext } from "@/src/lib/client";
import { printTable } from "@/src/lib/table";
import {
	type ProfileSource,
	getCurrentProfile,
	listProfiles,
	loadCredentialsFile,
} from "@/src/utils/credentials";
import { logger } from "@/src/utils/logger";
import {
	type ProfilesCommandInput,
	profilesCommandMeta,
	profilesCommandSchema,
} from "./command";

const OVERRIDE_SOURCE_LABELS: Partial<Record<ProfileSource, string>> = {
	flag: "--profile",
	env: "PHALA_CLOUD_PROFILE",
	project: "phala.toml",
};

async function runProfilesCommand(
	_input: ProfilesCommandInput,
	context: CommandContext,
): Promise<number> {
	const profiles = listProfiles();
	const currentProfile = getCurrentProfile();

	if (profiles.length === 0) {
		if (context.globalOptions?.json) {
			context.success({ profiles: [] });
			return 0;
		}
		logger.warn("No profiles found. Please login first.");
		return 0;
	}

	const credentials = loadCredentialsFile();
	// The profile this command would actually use; differs from the stored
	// current profile when overridden by --profile, env, or phala.toml.
	const activeAuth = resolveAuthForContext(context);
	const activeProfile = activeAuth.profileName;
	const overrideSource =
		activeProfile !== currentProfile?.name
			? OVERRIDE_SOURCE_LABELS[activeAuth.profileSource]
			: undefined;

	const columns = [
		"PROFILE",
		"SLUG",
		"WORKSPACE",
		"USER",
		"API ENDPOINT",
		"",
	] as const;
	const rows = profiles.map((profile) => {
		const isCurrent = currentProfile?.name === profile;
		const isOverridden =
			overrideSource !== undefined && activeProfile === profile;
		const profileInfo = credentials?.profiles[profile];
		return {
			PROFILE: profile,
			SLUG: profileInfo?.workspace?.slug || "",
			WORKSPACE: profileInfo?.workspace?.name || "",
			USER: profileInfo?.user?.username || "",
			"API ENDPOINT": profileInfo?.api_prefix || "",
			"": [isCurrent ? "*" : "", isOverridden ? ">" : ""].join(""),
		};
	});

	if (context.globalOptions?.json) {
		context.success({
			profiles: profiles.map((profile) => ({
				name: profile,
				slug: credentials?.profiles[profile]?.workspace?.slug || null,
				workspace: credentials?.profiles[profile]?.workspace?.name || null,
				user: credentials?.profiles[profile]?.user?.username || null,
				apiEndpoint: credentials?.profiles[profile]?.api_prefix || null,
				current: currentProfile?.name === profile,
				active: activeProfile === profile,
			})),
		});
		return 0;
	}

	printTable(columns, rows);
	if (overrideSource !== undefined) {
		const note = profiles.includes(activeProfile)
			? `> active for this command (overridden by ${overrideSource})`
			: `Profile "${activeProfile}" from ${overrideSource} not found`;
		context.stdout.write(`\n${note}\n`);
	}
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
export { profilesRefreshCommand } from "./refresh";

export default profilesCommand;
