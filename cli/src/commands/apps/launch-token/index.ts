import { safeClearAppLaunchToken, safeSetAppLaunchToken } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import { isInJsonMode } from "@/src/core/json-mode";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import {
	type AppsLaunchTokenClearCommandInput,
	type AppsLaunchTokenSetCommandInput,
	appsLaunchTokenClearCommandMeta,
	appsLaunchTokenClearCommandSchema,
	appsLaunchTokenGroup,
	appsLaunchTokenSetCommandMeta,
	appsLaunchTokenSetCommandSchema,
} from "./command";

async function runSet(
	input: AppsLaunchTokenSetCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);
		const result = await safeSetAppLaunchToken(client, {
			appId: input.appId,
			launchToken: input.token,
		});
		if (!result.success) throw result.error;
		if (isInJsonMode()) {
			context.success(result.data);
			return 0;
		}
		context.stdout.write(
			`Launch token:      ${result.data.launch_token}\nLaunch token hash: ${result.data.launch_token_hash}\n`,
		);
		logger.warn(
			"This is the only time the launch token is shown. Store it. Update each CVM of the app to the new hash before its next boot (phala deploy --cvm-id <id> --launch-token-hash <hash>), or it fails to boot.",
		);
		return 0;
	} catch (error) {
		context.failWithError(error, { operation: "Set app launch token" });
		return 1;
	}
}

async function runClear(
	input: AppsLaunchTokenClearCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);
		const result = await safeClearAppLaunchToken(client, {
			appId: input.appId,
		});
		if (!result.success) throw result.error;
		if (isInJsonMode()) {
			context.success({ app_id: input.appId, cleared: true });
			return 0;
		}
		logger.success(`Launch token of app ${input.appId} cleared`);
		return 0;
	} catch (error) {
		context.failWithError(error, { operation: "Clear app launch token" });
		return 1;
	}
}

export const appsLaunchTokenSetCommand = defineCommand({
	path: ["apps", "launch-token", "set"],
	meta: appsLaunchTokenSetCommandMeta,
	schema: appsLaunchTokenSetCommandSchema,
	handler: runSet,
});

export const appsLaunchTokenClearCommand = defineCommand({
	path: ["apps", "launch-token", "clear"],
	meta: appsLaunchTokenClearCommandMeta,
	schema: appsLaunchTokenClearCommandSchema,
	handler: runClear,
});

export const appsLaunchTokenCommands = {
	group: appsLaunchTokenGroup,
	commands: [appsLaunchTokenSetCommand, appsLaunchTokenClearCommand],
};
