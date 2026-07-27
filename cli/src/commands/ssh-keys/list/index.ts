import { safeListSshKeys } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import { isInJsonMode } from "@/src/core/json-mode";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";
import {
	sshKeysListCommandMeta,
	sshKeysListCommandSchema,
	type SshKeysListCommandInput,
} from "./command";

async function runSshKeysListCommand(
	input: SshKeysListCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);
		const result = await safeListSshKeys(client);

		if (!result.success) {
			context.failWithError(result.error.cause ?? result.error, {
				operation: "List SSH keys",
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			return 1;
		}

		const keys = result.data;

		if (isInJsonMode()) {
			context.success(keys);
			return 0;
		}

		if (keys.length === 0) {
			logger.info("No SSH keys found");
			return 0;
		}

		const columns = [
			"ID",
			"NAME",
			"TYPE",
			"FINGERPRINT",
			"SOURCE",
			"CREATED",
		] as const;
		const rows = keys.map((key) => ({
			ID: key.id,
			NAME: key.name,
			TYPE: key.key_type,
			FINGERPRINT: key.fingerprint,
			SOURCE: key.source,
			CREATED: key.created_at.slice(0, 10),
		}));

		printTable(columns, rows);
		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "List SSH keys",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}
}

export const sshKeysListCommand = defineCommand({
	path: ["ssh-keys", "list"],
	meta: sshKeysListCommandMeta,
	schema: sshKeysListCommandSchema,
	handler: runSshKeysListCommand,
});
