import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { tryRevokeApiToken } from "@/src/lib/client";
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
	const isJson = context.globalOptions?.json === true;

	try {
		const current = loadCredentialsFile();
		const profile = current?.current_profile;
		const info = profile ? current?.profiles[profile] : undefined;

		// Best-effort server-side revocation before removing the profile
		// locally. Failures never block the local removal: the token may
		// already be invalid (401) or the server may predate self-revoke (404).
		let revoked = false;
		if (info?.token) {
			const result = await tryRevokeApiToken({
				apiKey: info.token,
				baseURL: info.api_prefix,
			});
			revoked = result.outcome === "revoked";
			if (!isJson && result.outcome === "failed") {
				logger.warn(
					`Could not revoke the API token on the server: ${result.message}`,
				);
			}
		}

		removeProfile();
		const message = profile
			? `Credentials removed successfully (profile: ${profile})`
			: "Credentials removed successfully";
		if (isJson) {
			context.success({ message, profile: profile || null, revoked });
			return 0;
		}
		logger.success(message);
		if (revoked) {
			logger.info("API token revoked on the server");
		}
		return 0;
	} catch (error) {
		if (isJson) {
			context.fail("Failed to remove credentials");
			return 1;
		}
		logger.error("Failed to remove credentials");
		logger.logDetailedError(error);
		return 1;
	}
}

export const logoutCommand = defineCommand({
	path: ["logout"],
	meta: logoutCommandMeta,
	schema: logoutCommandSchema,
	handler: runLogoutCommand,
});

export default logoutCommand;
