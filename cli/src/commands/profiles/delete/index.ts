import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { tryRevokeApiToken } from "@/src/lib/client";
import {
	removeProfile,
	getCurrentProfile,
	listProfiles,
	loadCredentialsFile,
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
	const isJson = context.globalOptions?.json === true;

	try {
		const credentials = loadCredentialsFile();
		const profilesBefore = listProfiles();

		// Fail fast: refuse to delete anything if any name is unknown.
		const missing = input.profileNames.filter(
			(name) => !profilesBefore.includes(name),
		);
		if (missing.length > 0) {
			const message =
				missing.length === 1
					? `Profile "${missing[0]}" not found`
					: `Profiles not found: ${missing.map((name) => `"${name}"`).join(", ")}`;
			if (isJson) {
				context.fail(message);
				return 1;
			}
			logger.error(message);
			return 1;
		}

		const currentBefore = getCurrentProfile()?.name;
		const wasActive =
			currentBefore !== undefined && input.profileNames.includes(currentBefore);

		// Best-effort server-side revocation before removing each profile
		// locally. Failures never block the local delete: the token may already
		// be invalid (401) or the server may predate self-revoke (404).
		const revoked: string[] = [];
		const revokeSkipped: string[] = [];
		for (const name of input.profileNames) {
			const info = credentials?.profiles[name];
			if (info?.token) {
				const result = await tryRevokeApiToken({
					apiKey: info.token,
					baseURL: info.api_prefix,
				});
				if (result.outcome === "revoked") {
					revoked.push(name);
				} else {
					revokeSkipped.push(name);
					if (!isJson && result.outcome === "failed") {
						logger.warn(
							`Could not revoke token for profile "${name}" on the server: ${result.message}`,
						);
					}
				}
			}
			removeProfile(name);
			if (!isJson) {
				logger.success(`Deleted profile "${name}"`);
			}
		}

		const newCurrent = getCurrentProfile();

		if (isJson) {
			context.success({
				deleted: input.profileNames,
				revoked,
				revokeSkipped,
				wasActive,
				currentProfile: newCurrent?.name || null,
			});
			return 0;
		}

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
		if (isJson) {
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
