import { defineCommand } from "@/src/core/define-command";
import { isInJsonMode } from "@/src/core/json-mode";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { safeGetCvmSshKeys } from "@phala/cloud";
import { printAuthorizedSet } from "../authorized-set";
import {
	type SshKeysShowCommandInput,
	sshKeysShowCommandMeta,
	sshKeysShowCommandSchema,
} from "./command";

async function runSshKeysShowCommand(
	input: SshKeysShowCommandInput,
	context: CommandContext,
): Promise<number> {
	if (!context.cvmId) {
		context.fail(
			"No CVM ID provided. Either pass a CVM ID as argument or configure it in phala.toml.",
		);
		return 1;
	}

	try {
		const client = await getClient(context);
		const result = await safeGetCvmSshKeys(client, context.cvmId);

		if (!result.success) {
			context.failWithError(result.error.cause ?? result.error, {
				operation: "Show CVM SSH keys",
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			return 1;
		}

		if (isInJsonMode()) {
			context.success(result.data);
			return 0;
		}

		printAuthorizedSet(result.data);
		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Show CVM SSH keys",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}
}

export const sshKeysShowCommand = defineCommand({
	path: ["ssh-keys", "show"],
	meta: sshKeysShowCommandMeta,
	schema: sshKeysShowCommandSchema,
	handler: runSshKeysShowCommand,
});

export default sshKeysShowCommand;
