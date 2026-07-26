import inquirer from "inquirer";
import { safeDeleteSshKey, safeListSshKeys } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import { isInJsonMode } from "@/src/core/json-mode";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import {
	sshKeysRemoveCommandMeta,
	sshKeysRemoveCommandSchema,
	type SshKeysRemoveCommandInput,
} from "./command";

async function selectSshKey(
	context: Pick<CommandContext, "env" | "projectConfig" | "globalOptions">,
): Promise<string | undefined> {
	const spinner = logger.startSpinner("Fetching SSH keys");
	const client = await getClient(context);
	const result = await safeListSshKeys(client);
	spinner.stop(true);

	if (!result.success) {
		logger.error(`Failed to fetch SSH keys: ${result.error.message}`);
		return undefined;
	}

	const keys = result.data;
	if (keys.length === 0) {
		logger.info("No SSH keys found");
		return undefined;
	}

	const choices = keys.map((key) => ({
		name: `${key.id}  ${key.name}  (${key.key_type}, ${key.fingerprint})`,
		value: key.id,
	}));

	const { selectedKey } = await inquirer.prompt([
		{
			type: "list",
			name: "selectedKey",
			message: "Select an SSH key to remove:",
			choices,
		},
	]);

	return selectedKey;
}

async function runSshKeysRemoveCommand(
	input: SshKeysRemoveCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		let keyId = input.keyId;

		if (!keyId && input.interactive) {
			keyId = await selectSshKey(context);
			if (!keyId) {
				return 0;
			}
		}

		if (!keyId) {
			context.fail(
				"Missing key_id. Use `phala ssh-keys rm <key_id>` or `phala ssh-keys rm -i` for interactive selection.",
			);
			return 1;
		}

		const client = await getClient(context);
		const result = await safeDeleteSshKey(client, { keyId });

		if (!result.success) {
			context.failWithError(result.error.cause ?? result.error, {
				operation: "Remove SSH key",
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			return 1;
		}

		if (isInJsonMode()) {
			context.success({ keyId, removed: true });
			return 0;
		}

		logger.success(`SSH key ${keyId} removed`);
		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Remove SSH key",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}
}

export const sshKeysRemoveCommand = defineCommand({
	path: ["ssh-keys", "remove"],
	meta: sshKeysRemoveCommandMeta,
	schema: sshKeysRemoveCommandSchema,
	handler: runSshKeysRemoveCommand,
});

export default sshKeysRemoveCommand;
