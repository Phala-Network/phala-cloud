import { safeImportGithubProfileSshKeys } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import { isInJsonMode } from "@/src/core/json-mode";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import {
	sshKeysImportGithubCommandMeta,
	sshKeysImportGithubCommandSchema,
	type SshKeysImportGithubCommandInput,
} from "./command";

async function runSshKeysImportGithubCommand(
	input: SshKeysImportGithubCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);
		const spinner = logger.startSpinner(
			`Importing SSH keys from github.com/${input.githubUsername}`,
		);

		const result = await safeImportGithubProfileSshKeys(client, {
			github_username: input.githubUsername,
		});

		spinner.stop(true);

		if (!result.success) {
			context.failWithError(result.error.cause ?? result.error, {
				operation: "Import GitHub SSH keys",
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			return 1;
		}

		if (isInJsonMode()) {
			context.success(result.data);
			return 0;
		}

		const { keys_added, keys_skipped, errors } = result.data;

		if (errors.length > 0) {
			logger.warn(`${errors.length} key(s) could not be imported:`);
			for (const err of errors) {
				logger.warn(`  ${err}`);
			}
		}

		if (keys_added > 0) {
			logger.success(
				`Added ${keys_added} SSH key(s) from github.com/${input.githubUsername} (${keys_skipped} skipped)`,
			);
		} else {
			logger.info("No new keys added (all keys already exist)");
		}

		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Import GitHub SSH keys",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}
}

export const sshKeysImportGithubCommand = defineCommand({
	path: ["ssh-keys", "import-github"],
	meta: sshKeysImportGithubCommandMeta,
	schema: sshKeysImportGithubCommandSchema,
	handler: runSshKeysImportGithubCommand,
});

export default sshKeysImportGithubCommand;
