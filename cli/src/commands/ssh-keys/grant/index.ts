import { defineCommand } from "@/src/core/define-command";
import { isInJsonMode } from "@/src/core/json-mode";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import { safeGetCvmSshKeys, safeUpdateCvmSshKeys } from "@phala/cloud";
import { keyIds, printRestartHint, sameKeyIds } from "../authorized-set";
import {
	type SshKeysGrantCommandInput,
	sshKeysGrantCommandMeta,
	sshKeysGrantCommandSchema,
} from "./command";

async function runSshKeysGrantCommand(
	input: SshKeysGrantCommandInput,
	context: CommandContext,
): Promise<number> {
	if (!context.cvmId) {
		context.fail(
			"No CVM ID provided. Either pass a CVM ID as argument or configure it in phala.toml.",
		);
		return 1;
	}

	if (!input.userNickname && !input.sshKeyId) {
		context.fail("Provide a user nickname or --id.");
		return 1;
	}

	try {
		const client = await getClient(context);
		const current = await safeGetCvmSshKeys(client, context.cvmId);
		if (!current.success) {
			context.failWithError(current.error.cause ?? current.error, {
				operation: "Grant CVM SSH keys",
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			return 1;
		}

		const sshKeyIds = [...keyIds(current.data.keys)];
		if (input.sshKeyId && !sshKeyIds.includes(input.sshKeyId)) {
			sshKeyIds.push(input.sshKeyId);
		}

		const updated = await safeUpdateCvmSshKeys(client, {
			...context.cvmId,
			ssh_key_ids: sshKeyIds,
			usernames: input.userNickname ? [input.userNickname] : undefined,
			apply_now: input.applyNow,
		});
		if (!updated.success) {
			context.failWithError(updated.error.cause ?? updated.error, {
				operation: "Grant CVM SSH keys",
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			return 1;
		}

		if (isInJsonMode()) {
			context.success(updated.data);
			return 0;
		}

		if (sameKeyIds(keyIds(current.data.keys), keyIds(updated.data.keys))) {
			logger.info("already authorized");
		} else {
			logger.success("Granted SSH keys.");
		}
		printRestartHint(updated.data, input.applyNow);
		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Grant CVM SSH keys",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}
}

export const sshKeysGrantCommand = defineCommand({
	path: ["ssh-keys", "grant"],
	meta: sshKeysGrantCommandMeta,
	schema: sshKeysGrantCommandSchema,
	handler: runSshKeysGrantCommand,
});

export default sshKeysGrantCommand;
