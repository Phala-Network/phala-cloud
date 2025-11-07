import { createClient, safeGetCurrentUser } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getApiKey } from "@/src/utils/credentials";
import { logDetailedError } from "@/src/utils/error-handling";
import { logger, setJsonMode } from "@/src/utils/logger";
import { statusCommandMeta, statusCommandSchema } from "./command";
import type { StatusCommandInput } from "./command";

export async function runStatusCommand(
	input: StatusCommandInput,
	context: CommandContext,
): Promise<number | undefined> {
	// Enable JSON mode if --json flag is set
	setJsonMode(input.json);

	const debug = input.debug || context.env.DEBUG?.toLowerCase() === "true";
	const apiKey = input.apiToken || getApiKey();

	if (!apiKey) {
		logger.warn(
			'Not authenticated. Please set an API key with "phala auth login"',
		);
		return 0;
	}

	if (debug) {
		logger.debug(`Using API key: ${apiKey.substring(0, 5)}...`);
	}

	try {
		const apiClient = createClient({ apiKey });
		const result = await safeGetCurrentUser(apiClient);

		if (!result.success) {
			logger.error("Failed to get user information");
			if (result.error) {
				logger.error(`Error: ${result.error.message}`);
			}
			context.fail(result.error?.message || "Failed to get user information");
			return 1;
		}

		const userInfo = result.data as { username?: string; team_name?: string };
		const apiUrl =
			context.env.PHALA_CLOUD_API_PREFIX ||
			"https://cloud-api.phala.network/api/v1";

		if (input.json) {
			context.success({
				apiUrl,
				username: userInfo.username,
				team_name: userInfo.team_name,
			});
			return 0;
		}

		context.stdout.write(`Integrated API: ${apiUrl}\n`);
		context.stdout.write(`Logged in as: ${userInfo.username}\n`);
		context.stdout.write(`Current Workspace: ${userInfo.team_name}\n`);
		return 0;
	} catch (error) {
		logger.error(
			"Authentication failed. Your API key may be invalid or expired.",
		);
		logger.info('Please set a new API key with "phala auth login"');

		if (debug) {
			logDetailedError(error);
		}
		context.fail("Authentication failed. Your API key may be invalid or expired.");
		return 1;
	}
}

export const statusCommand = defineCommand({
	path: ["status"],
	meta: statusCommandMeta,
	schema: statusCommandSchema,
	handler: runStatusCommand,
});

export default statusCommand;
