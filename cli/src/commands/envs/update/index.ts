import {
	encryptEnvVars,
	safeAddComposeHash,
	safeUpdateCvmEnvs,
} from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { resolveCvmForInput } from "@/src/utils/cvms";
import { logger } from "@/src/utils/logger";
import { resolveEnvInputs } from "../resolve-envs";
import { getEncryptPubkey } from "../get-encrypt-pubkey";
import {
	envsUpdateCommandMeta,
	envsUpdateCommandSchema,
	type EnvsUpdateCommandInput,
} from "./command";

async function runEnvsUpdateCommand(
	input: EnvsUpdateCommandInput,
	context: CommandContext,
): Promise<number> {
	if (!context.cvmId) {
		context.fail(
			"No CVM ID provided. Pass a CVM identifier or set it in phala.toml.",
		);
		return 1;
	}

	const hasEnv = input.env && input.env.length > 0;
	const hasEncryptedEnv = !!input.encryptedEnv;

	if (!hasEnv && !hasEncryptedEnv) {
		context.fail(
			"Provide either -e (environment variables) or --encrypted-env (pre-encrypted hex).",
		);
		return 1;
	}

	if (hasEnv && hasEncryptedEnv) {
		context.fail("Cannot use both -e and --encrypted-env at the same time.");
		return 1;
	}

	try {
		const client = await getClient();
		const cvm = await resolveCvmForInput(client, context.cvmId);
		let encryptedEnv: string;
		let envKeys: string[] | undefined;

		if (hasEnv && input.env) {
			const envs = resolveEnvInputs(input.env);
			if (envs.length === 0) {
				context.fail("No environment variables found in the provided inputs.");
				return 1;
			}

			envKeys = envs.map((e) => e.key);
			const pubkey = await getEncryptPubkey(client, cvm);
			encryptedEnv = await encryptEnvVars(envs, pubkey);
		} else if (input.encryptedEnv) {
			encryptedEnv = input.encryptedEnv;
			// env_keys unknown when using pre-encrypted hex
		} else {
			// Unreachable: validated above
			context.fail("No environment input provided.");
			return 1;
		}

		logger.info("Updating environment variables...");
		const updateResult = await safeUpdateCvmEnvs(client, {
			id: cvm.id,
			encrypted_env: encryptedEnv,
			env_keys: envKeys,
		});

		if (!updateResult.success) {
			context.fail(updateResult.error.message);
			return 1;
		}

		const data = updateResult.data;

		if (data.status === "in_progress") {
			logger.success(
				`Environment update initiated (correlation_id: ${data.correlation_id})`,
			);
			return 0;
		}

		if (data.status === "precondition_required") {
			// Two-phase flow: on-chain compose hash registration required
			const privateKey = input.privateKey || process.env.PRIVATE_KEY;
			if (!privateKey) {
				context.fail(
					"On-chain KMS requires a private key. Use --private-key or set PRIVATE_KEY env var.",
				);
				return 1;
			}

			logger.info(
				"Environment key list changed — registering compose hash on-chain...",
			);

			// KmsInfoSchema transform adds .chain when chain_id maps to a supported chain
			const kmsChain = (data.kms_info as unknown as Record<string, unknown>)
				.chain;
			if (!kmsChain) {
				context.fail(
					`Unsupported chain_id ${data.kms_info.chain_id} — update @phala/cloud to add support.`,
				);
				return 1;
			}

			const addHashResult = await safeAddComposeHash({
				// biome-ignore lint/suspicious/noExplicitAny: chain is added by KmsInfoSchema transform at runtime
				chain: kmsChain as any,
				rpcUrl: input.rpcUrl,
				appId: data.app_id as `0x${string}`,
				composeHash: data.compose_hash,
				privateKey: privateKey as `0x${string}`,
			});

			if (!addHashResult.success) {
				logger.logDetailedError(addHashResult, "Add Compose Hash");
				context.fail("Failed to register compose hash on-chain.");
				return 1;
			}

			const txResult = addHashResult.data as {
				transactionHash?: string;
			};

			logger.info("Completing environment update...");
			const retryResult = await safeUpdateCvmEnvs(client, {
				id: cvm.id,
				encrypted_env: encryptedEnv,
				env_keys: envKeys,
				compose_hash: data.compose_hash,
				transaction_hash: txResult.transactionHash,
			});

			if (!retryResult.success) {
				context.fail(retryResult.error.message);
				return 1;
			}

			if (retryResult.data.status === "in_progress") {
				logger.success(
					`Environment update initiated (correlation_id: ${retryResult.data.correlation_id})`,
				);
				return 0;
			}

			context.fail("Unexpected response after on-chain verification.");
			return 1;
		}

		context.fail(
			`Unexpected response status: ${(data as { status: string }).status}`,
		);
		return 1;
	} catch (error) {
		context.fail(error instanceof Error ? error.message : String(error));
		return 1;
	}
}

export const envsUpdateCommand = defineCommand({
	path: ["envs", "update"],
	meta: envsUpdateCommandMeta,
	schema: envsUpdateCommandSchema,
	handler: runEnvsUpdateCommand,
});

export default envsUpdateCommand;
