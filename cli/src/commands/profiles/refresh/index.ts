import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { tryRevokeApiToken } from "@/src/lib/client";
import {
	DEFAULT_API_PREFIX,
	loadCredentialsFile,
	upsertProfile,
} from "@/src/utils/credentials";
import {
	promptForApiKey,
	runDeviceAuthFlow,
	validateApiKey,
} from "@/src/commands/login";
import { logger } from "@/src/utils/logger";
import {
	profilesRefreshCommandMeta,
	profilesRefreshCommandSchema,
	type ProfilesRefreshCommandInput,
} from "./command";

async function runProfilesRefreshCommand(
	input: ProfilesRefreshCommandInput,
	context: CommandContext,
): Promise<number> {
	const isJson = context.globalOptions?.json === true;

	try {
		const credentials = loadCredentialsFile();

		// Default to the current profile when no name is given.
		const profileName =
			input.profileName ?? credentials?.current_profile ?? undefined;
		if (!profileName) {
			const message =
				"No profile specified and no current profile. Please login first.";
			if (isJson) {
				context.fail(message);
				return 1;
			}
			logger.error(message);
			return 1;
		}

		const existing = credentials?.profiles[profileName];

		if (!existing) {
			const message = `Profile "${profileName}" not found`;
			if (isJson) {
				context.fail(message);
				return 1;
			}
			logger.error(message);
			return 1;
		}

		const baseURL =
			context.env.PHALA_CLOUD_API_PREFIX ||
			existing.api_prefix ||
			DEFAULT_API_PREFIX;

		// Best-effort revoke of the old token first. The common case for a
		// refresh is that the old token is already invalid server-side (401),
		// in which case this is a no-op.
		if (existing.token) {
			const result = await tryRevokeApiToken({
				apiKey: existing.token,
				baseURL,
			});
			if (!isJson && result.outcome === "revoked") {
				logger.info("Previous API token revoked on the server");
			}
			if (!isJson && result.outcome === "failed") {
				logger.warn(
					`Could not revoke the previous token on the server: ${result.message}`,
				);
			}
		}

		let apiKey: string;
		let user;
		if (input.manual) {
			const result = await promptForApiKey({ baseURL });
			apiKey = result.apiKey;
			user = result.user;
		} else {
			apiKey = await runDeviceAuthFlow(context, {
				noOpen: input.noOpen,
				baseURL,
				workspaceSlug: existing.workspace.slug,
			});
			user = await validateApiKey({ apiKey, baseURL });
		}

		// A refresh must not silently move the profile to another workspace.
		const previousSlug = existing.workspace.slug;
		const newSlug = user.workspace.slug;
		if (previousSlug && newSlug && previousSlug !== newSlug) {
			throw new Error(
				`Workspace mismatch: profile "${profileName}" belongs to workspace "${previousSlug}", but the new token is bound to "${newSlug}". Run the refresh again and authorize against "${previousSlug}".`,
			);
		}

		upsertProfile({
			profileName,
			token: apiKey,
			apiPrefix: baseURL,
			workspaceName: user.workspace.name || existing.workspace.name,
			workspaceSlug: user.workspace.slug || existing.workspace.slug,
			user: {
				username: user.user.username,
				email: user.user.email,
			},
			// Keep the current profile unchanged unless the refreshed profile
			// is the current one.
			setCurrent: credentials?.current_profile === profileName,
		});

		if (isJson) {
			context.success({
				refreshed: profileName,
				username: user.user.username,
			});
			return 0;
		}
		logger.success(
			`Profile "${profileName}" refreshed (user: ${user.user.username})`,
		);
		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Refresh profile",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}
}

export const profilesRefreshCommand = defineCommand({
	path: ["profiles", "refresh"],
	meta: profilesRefreshCommandMeta,
	schema: profilesRefreshCommandSchema,
	handler: runProfilesRefreshCommand,
});

export default profilesRefreshCommand;
