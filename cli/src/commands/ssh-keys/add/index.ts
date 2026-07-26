import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir, hostname } from "node:os";
import { safeCreateSshKey } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import { isInJsonMode } from "@/src/core/json-mode";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import {
	sshKeysAddCommandMeta,
	sshKeysAddCommandSchema,
	type SshKeysAddCommandInput,
} from "./command";

function findDefaultPubKey(): string | undefined {
	const candidates = [
		join(homedir(), ".ssh", "id_ed25519.pub"),
		join(homedir(), ".ssh", "id_rsa.pub"),
		join(homedir(), ".ssh", "id_ecdsa.pub"),
	];
	for (const p of candidates) {
		if (existsSync(p)) return p;
	}
	return undefined;
}

async function runSshKeysAddCommand(
	input: SshKeysAddCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		let keyFilePath = input.keyFile;
		if (keyFilePath?.startsWith("~/")) {
			keyFilePath = join(homedir(), keyFilePath.slice(2));
		}

		if (!keyFilePath) {
			keyFilePath = findDefaultPubKey();
			if (!keyFilePath) {
				context.fail(
					"No SSH public key found. Specify one with --key-file or generate one with ssh-keygen.",
				);
				return 1;
			}
		}

		if (!existsSync(keyFilePath)) {
			context.fail(`SSH public key file not found: ${keyFilePath}`);
			return 1;
		}

		const publicKey = readFileSync(keyFilePath, "utf-8").trim();
		const keyName =
			input.name ?? `${hostname()}-${basename(keyFilePath, ".pub")}`;

		const client = await getClient(context);
		const result = await safeCreateSshKey(client, {
			name: keyName,
			public_key: publicKey,
		});

		if (!result.success) {
			context.failWithError(result.error.cause ?? result.error, {
				operation: "Add SSH key",
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			return 1;
		}

		if (isInJsonMode()) {
			context.success(result.data);
			return 0;
		}

		logger.success(
			`Added SSH key "${keyName}" (${result.data.key_type}, ${result.data.fingerprint})`,
		);
		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Add SSH key",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}
}

export const sshKeysAddCommand = defineCommand({
	path: ["ssh-keys", "add"],
	meta: sshKeysAddCommandMeta,
	schema: sshKeysAddCommandSchema,
	handler: runSshKeysAddCommand,
});

export default sshKeysAddCommand;
