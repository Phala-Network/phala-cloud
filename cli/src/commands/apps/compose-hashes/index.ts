import { createInterface } from "node:readline/promises";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { type CliApiClient, getClient } from "@/src/lib/client";
import { getChainFinalityEtaSeconds } from "@/src/utils/finality";
import { resolveSigningKey, signingError } from "@/src/utils/signing-key";
import {
	RemoveComposeHashSchema,
	SUPPORTED_CHAINS,
	getAppPendingUpdates,
	removeComposeHash,
} from "@phala/cloud";
import { isAddress } from "viem";
import { z } from "zod";
import {
	composeHashListMeta,
	composeHashListSchema,
	composeHashRevokeMeta,
	composeHashRevokeSchema,
	composeHashesGroup,
} from "./command";

function hashKey(hash: string): string {
	return hash.replace(/^0x/i, "").toLowerCase();
}

const list = defineCommand({
	path: [...composeHashesGroup.path, "list"],
	meta: composeHashListMeta,
	schema: composeHashListSchema,
	handler: async ({ appId }, context) => {
		try {
			const { registered_unused } = await getAppPendingUpdates(
				await getClient(context),
				{ appId },
			);
			if (context.globalOptions?.json) {
				context.success({ registered_unused });
			} else if (registered_unused.length === 0) {
				context.stdout.write(
					"No registered compose hashes outside the app's running or previous versions.\n",
				);
			} else {
				for (const item of registered_unused) {
					context.stdout.write(`${item.compose_hash}  ${item.state}\n`);
				}
			}
			return 0;
		} catch (error) {
			context.failWithError(error, {
				operation: "List registered compose hashes",
			});
			return 1;
		}
	},
});

const appKmsInfoSchema = z.object({
	is_onchain_kms: z.boolean(),
	chain_id: z.number().int().nullish(),
	app_contract_address: z.string().nullish(),
});

async function getAppContract(client: CliApiClient, appId: string) {
	// The app ID is not necessarily its contract address. The KMS endpoint can
	// resolve the address even after an app's last CVM has been deleted.
	const info = appKmsInfoSchema.parse(
		await client.get(`/apps/${encodeURIComponent(appId)}/kms-info`),
	);
	if (!info.is_onchain_kms)
		throw new Error("This app does not use an on-chain KMS.");
	const chain =
		info.chain_id == null ? undefined : SUPPORTED_CHAINS[info.chain_id];
	if (!chain) {
		throw new Error(
			info.chain_id == null
				? "The app's KMS chain is unknown."
				: `Chain ID ${info.chain_id} is not supported.`,
		);
	}
	const rawAddress = info.app_contract_address;
	const appAddress = rawAddress ? `0x${rawAddress.replace(/^0x/i, "")}` : "";
	if (!isAddress(appAddress, { strict: false })) {
		throw new Error("Phala Cloud did not return a valid app contract address.");
	}
	return { chain, appAddress };
}

async function requireUnused(
	client: CliApiClient,
	appId: string,
	composeHash: string,
): Promise<void> {
	const { items, registered_unused } = await getAppPendingUpdates(client, {
		appId,
	});
	const matches = registered_unused.filter(
		(entry) => hashKey(entry.compose_hash) === composeHash,
	);
	if (
		items.some((entry) => hashKey(entry.compose_hash) === composeHash) ||
		matches.some((entry) => entry.state === "pending")
	) {
		throw new Error(
			"This compose hash is pending. A staged update or deployment may still use it.",
		);
	}
	if (!matches.some((entry) => entry.state === "unused")) {
		throw new Error(
			"Phala Cloud could not confirm that this compose hash is registered and unused. No transaction was sent.",
		);
	}
}

async function confirmRevocation(context: CommandContext): Promise<boolean> {
	const prompt = createInterface({
		input: context.stdin,
		output: context.stderr,
	});
	try {
		const answer = await prompt.question(
			"Sign the revocation transaction? [y/N] ",
		);
		return /^(y|yes)$/i.test(answer.trim());
	} finally {
		prompt.close();
	}
}

const revoke = defineCommand({
	path: [...composeHashesGroup.path, "revoke"],
	meta: composeHashRevokeMeta,
	schema: composeHashRevokeSchema,
	handler: async (input, context) => {
		const json = context.globalOptions?.json;
		try {
			if (context.rawPositionals.length > 2 || context.argv.includes("--")) {
				throw new Error(
					"Unexpected arguments. Run phala apps compose-hashes revoke --help for usage.",
				);
			}
			if (
				!input.yes &&
				(json || !context.stdin.isTTY || !context.stderr.isTTY)
			) {
				throw new Error(
					"Pass --yes to confirm revocation in noninteractive mode.",
				);
			}
			const client = await getClient(context);
			const { chain, appAddress } = await getAppContract(client, input.appId);
			const composeHash = hashKey(input.composeHash);
			await requireUnused(client, input.appId, composeHash);
			context.stderr.write(
				`Revoking compose hash 0x${composeHash} for app contract ${appAddress} on ${chain.name} is irreversible. It cannot take back keys already released.\n`,
			);
			if (!input.yes) {
				if (!(await confirmRevocation(context))) {
					context.stdout.write(
						"Revocation canceled. No transaction was sent.\n",
					);
					return 0;
				}
				// The app's drafts or deployments may have changed while the prompt was open.
				await requireUnused(client, input.appId, composeHash);
			}

			const privateKey = resolveSigningKey(
				input.privateKey || context.env.PRIVATE_KEY,
			);
			const result = await removeComposeHash(
				{
					chain,
					appAddress,
					composeHash,
					privateKey,
					rpcUrl: input.rpcUrl || context.env.ETH_RPC_URL,
					onTransactionSubmitted: (hash) =>
						context.stderr.write(`Revocation transaction submitted: ${hash}\n`),
				},
				{ schema: RemoveComposeHashSchema },
			).catch((error: unknown) => {
				throw signingError(error, privateKey);
			});
			const etaSeconds = getChainFinalityEtaSeconds(chain.id, "finalized");
			if (json) {
				context.success({
					app_id: input.appId,
					app_contract_address: result.appAddress,
					compose_hash: result.composeHash,
					chain_id: chain.id,
					transaction_hash: result.transactionHash,
					block_number: result.blockNumber.toString(),
					eta_seconds: etaSeconds,
				});
			} else {
				const estimate =
					etaSeconds === null
						? ""
						: ` (about ${Math.ceil(etaSeconds / 60)} min on ${chain.name})`;
				context.stdout.write(
					`Revocation included in block ${result.blockNumber}. The KMS stops honoring this hash once that block is final${estimate}.\n`,
				);
			}
			return 0;
		} catch (error) {
			context.failWithError(error, { operation: "Revoke compose hash" });
			return 1;
		}
	},
});

export const appsComposeHashesCommands = {
	group: composeHashesGroup,
	commands: [list, revoke],
};
