import { safeGetCurrentUser } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClientWithAuth } from "@/src/lib/client";
import { checkForUpdates } from "@/src/core/update-check";

import { logger } from "@/src/utils/logger";
import { statusCommandMeta, statusCommandSchema } from "./command";
import type { StatusCommandInput } from "./command";

export async function runStatusCommand(
	input: StatusCommandInput,
	context: CommandContext,
): Promise<number | undefined> {
	const debug = input.debug || context.env.DEBUG?.toLowerCase() === "true";

	const { client, auth } = await getClientWithAuth(context, {
		apiToken: input.apiToken,
	});

	if (!auth.apiKey) {
		logger.warn('Not authenticated. Please set an API key with "phala login"');
		return 0;
	}

	if (debug) {
		logger.debug(
			`Using API key: ${auth.apiKey.substring(0, 5)}... (source=${auth.tokenSource}, profile=${auth.profileName})`,
		);
		logger.debug(
			`Using API prefix: ${auth.baseURL} (source=${auth.apiPrefixSource})`,
		);
	}

	try {
		const result = await safeGetCurrentUser(client);

		if (!result.success) {
			context.failWithError(result.error.cause ?? result.error, {
				operation: "Status",
				debug,
			});
			return 1;
		}

		const userInfo = result.data;
		const apiUrl = auth.baseURL;

		const apiVersion = client.config.version;

		if (input.json) {
			context.success({
				apiUrl,
				apiVersion,
				username: userInfo.user.username,
				team_name: userInfo.workspace.name,
				profile: auth.profileName,
			});
			return 0;
		}

		context.stdout.write(`Integrated API: ${apiUrl}\n`);
		context.stdout.write(`API Version: ${apiVersion}\n`);
		context.stdout.write(`Logged in as: ${userInfo.user.username}\n`);
		context.stdout.write(`Current Workspace: ${userInfo.workspace.name}\n`);
		context.stdout.write(`Current Profile: ${auth.profileName}\n`);

		// Force upgrade check (bypass TTL cache)
		if (context.cli) {
			const notice = await checkForUpdates({
				executableName: context.cli.executableName,
				packageName: context.cli.packageName,
				currentVersion: context.cli.packageVersion,
				runtime: context.cli.runtime,
				env: context.env,
				isJson: false,
				stderrIsTTY: context.stderr.isTTY === true,
				ttlMs: 0,
				timeoutMs: 5000,
			});
			if (notice) {
				context.stderr.write(`\n${notice.message}`);
			} else {
				context.stdout.write("CLI is up to date.\n");
			}
		}

		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Status",
			debug,
			guidance: 'Please set a new API key with "phala login".',
		});
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
