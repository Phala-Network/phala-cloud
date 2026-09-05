import { defineCommand } from "@/src/core/define-command";
import { isInJsonMode } from "@/src/core/json-mode";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import {
	safeGetCurrentUser,
	safeGetCvmSshKeys,
	safeUpdateCvmSshKeys,
} from "@phala/cloud";
import {
	keyIds,
	keysToRevoke,
	printRestartHint,
	sameKeyIds,
} from "../authorized-set";
import {
	type SshKeysRevokeCommandInput,
	sshKeysRevokeCommandMeta,
	sshKeysRevokeCommandSchema,
} from "./command";

function currentUsername(user: unknown): string | undefined {
	if (!user || typeof user !== "object") return undefined;
	const record = user as { username?: string; user?: { username?: string } };
	return record.user?.username ?? record.username;
}

async function runSshKeysRevokeCommand(
	input: SshKeysRevokeCommandInput,
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
				operation: "Revoke CVM SSH keys",
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			return 1;
		}

		const dropped = keysToRevoke(
			current.data.keys,
			input.userNickname,
			input.sshKeyId,
		);
		const remaining = current.data.keys.filter(
			(key) => !dropped.some((item) => item.id === key.id),
		);

		if (dropped.length === 0) {
			if (isInJsonMode()) {
				context.success(current.data);
				return 0;
			}
			logger.info("not authorized");
			return 0;
		}

		const updated = await safeUpdateCvmSshKeys(client, {
			...context.cvmId,
			ssh_key_ids: keyIds(remaining),
			apply_now: input.applyNow,
		});
		if (!updated.success) {
			context.failWithError(updated.error.cause ?? updated.error, {
				operation: "Revoke CVM SSH keys",
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			return 1;
		}

		if (isInJsonMode()) {
			context.success(updated.data);
			return 0;
		}

		if (sameKeyIds(keyIds(current.data.keys), keyIds(updated.data.keys))) {
			logger.info("not authorized");
		} else {
			logger.success("Revoked SSH keys.");
		}

		const me = await safeGetCurrentUser(client);
		const username = me.success ? currentUsername(me.data) : undefined;
		const hadOwnKey = username
			? current.data.keys.some((key) => key.owner_username === username)
			: false;
		const stillHasOwnKey = username
			? updated.data.keys.some((key) => key.owner_username === username)
			: true;
		if (hadOwnKey && !stillHasOwnKey) {
			logger.info(
				"Your account key is still registered. Re-grant it with `phala ssh-keys grant` if you want SSH access again.",
			);
		}

		printRestartHint(updated.data, input.applyNow);
		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Revoke CVM SSH keys",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}
}

export const sshKeysRevokeCommand = defineCommand({
	path: ["ssh-keys", "revoke"],
	meta: sshKeysRevokeCommandMeta,
	schema: sshKeysRevokeCommandSchema,
	handler: runSshKeysRevokeCommand,
});

export default sshKeysRevokeCommand;
