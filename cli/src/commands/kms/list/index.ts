import { safeListKmsContracts } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext, CommandMeta } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";
import {
	kmsListCommandMeta,
	kmsListCommandSchema,
	type KmsListCommandInput,
} from "./command";

const CHAIN_NAMES: Record<number, string> = {
	0: "phala",
	1: "ethereum",
	8453: "base",
	31337: "anvil",
};

function chainName(chainId: number): string {
	return CHAIN_NAMES[chainId] ?? `chain-${chainId}`;
}

async function runKmsListCommand(
	input: KmsListCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);

		const result = await safeListKmsContracts(client, { page_size: 100 });

		if (!result.success) {
			context.failWithError(result.error.cause ?? result.error, {
				operation: "List KMS",
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			return 1;
		}

		const data = result.data;

		if (input.json) {
			context.success(data);
			return 0;
		}

		if (data.items.length === 0) {
			logger.info("No KMS contracts found");
			return 0;
		}

		const columns = [
			"SLUG",
			"LABEL",
			"CHAIN",
			"CONTRACT_ADDRESS",
			"NODES",
		] as const;
		const rows = data.items.map((c) => ({
			SLUG: c.slug ?? "-",
			LABEL: c.label ?? "-",
			CHAIN: chainName(c.chain_id),
			CONTRACT_ADDRESS: c.contract_address,
			NODES: String(c.node_count),
		}));

		printTable(columns, rows);
		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "List KMS",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}
}

const kmsRootCommandMeta: CommandMeta = {
	name: "kms",
	description: "List and manage KMS contracts",
	stability: "unstable",
};

export const kmsListCommand = defineCommand({
	path: ["kms", "list"],
	meta: kmsListCommandMeta,
	schema: kmsListCommandSchema,
	handler: runKmsListCommand,
});

export const kmsCommand = defineCommand({
	path: ["kms"],
	meta: kmsRootCommandMeta,
	schema: kmsListCommandSchema,
	handler: runKmsListCommand,
});
