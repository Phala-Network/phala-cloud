import { encryptEnvVars } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { resolveCvmForInput } from "@/src/utils/cvms";
import { resolveEnvInputs } from "../resolve-envs";
import { getEncryptPubkey } from "../get-encrypt-pubkey";
import {
	envsEncryptCommandMeta,
	envsEncryptCommandSchema,
	type EnvsEncryptCommandInput,
} from "./command";

async function runEnvsEncryptCommand(
	input: EnvsEncryptCommandInput,
	context: CommandContext,
): Promise<number> {
	if (!context.cvmId) {
		context.fail(
			"No CVM ID provided. Pass a CVM identifier or set it in phala.toml.",
		);
		return 1;
	}

	try {
		const envs = resolveEnvInputs(input.env);

		if (envs.length === 0) {
			context.fail("No environment variables found in the provided inputs.");
			return 1;
		}

		const client = await getClient();
		const cvm = await resolveCvmForInput(client, context.cvmId);
		const pubkey = await getEncryptPubkey(client, cvm);
		const encrypted = await encryptEnvVars(envs, pubkey);

		// Output raw hex only — no colors, no formatting, suitable for piping
		process.stdout.write(input.noNewline ? encrypted : `${encrypted}\n`);

		return 0;
	} catch (error) {
		context.fail(error instanceof Error ? error.message : String(error));
		return 1;
	}
}

export const envsEncryptCommand = defineCommand({
	path: ["envs", "encrypt"],
	meta: envsEncryptCommandMeta,
	schema: envsEncryptCommandSchema,
	handler: runEnvsEncryptCommand,
});

export default envsEncryptCommand;
