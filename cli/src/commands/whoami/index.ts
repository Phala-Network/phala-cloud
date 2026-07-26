import { safeGetCurrentUser } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClientWithAuth } from "@/src/lib/client";
import {
	whoamiCommandMeta,
	whoamiCommandSchema,
	type WhoamiCommandInput,
} from "./command";

async function runWhoamiCommand(
	input: WhoamiCommandInput,
	context: CommandContext,
): Promise<number> {
	const { client, auth } = await getClientWithAuth(context, {
		apiToken: input.apiToken,
	});

	if (!auth.apiKey) {
		context.fail('Not authenticated. Run "phala login" first.');
		return 1;
	}

	const result = await safeGetCurrentUser(client);

	if (!result.success) {
		context.failWithError(result.error.cause ?? result.error, {
			operation: "Whoami",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}

	const { user, workspace } = result.data;

	if (input.json) {
		context.success({
			username: user.username,
			email: user.email,
			workspace: workspace.name,
			profile: auth.profileName,
		});
		return 0;
	}

	context.stdout.write(`${user.username} (${workspace.name})\n`);
	return 0;
}

export const whoamiCommand = defineCommand({
	path: ["whoami"],
	meta: whoamiCommandMeta,
	schema: whoamiCommandSchema,
	handler: runWhoamiCommand,
});

export default whoamiCommand;
