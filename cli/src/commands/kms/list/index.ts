import { safeGetKmsList } from "@phala/cloud";
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
	1: "ethereum",
	8453: "base",
	31337: "anvil",
};

async function runKmsListCommand(
	input: KmsListCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);

		const result = await safeGetKmsList(client, {
			is_onchain: true,
			page_size: 100,
		});

		if (!result.success) {
			context.fail(result.error.message);
			return 1;
		}

		const data = result.data;

		if (input.json) {
			context.success(data);
			return 0;
		}

		// Group by (contract_address, chain_id) to show unique contracts
		const contracts = new Map<string, { address: string; chain: string }>();
		for (const kms of data.items) {
			const key = `${kms.kms_contract_address}:${kms.chain_id}`;
			if (!contracts.has(key)) {
				contracts.set(key, {
					address: kms.kms_contract_address ?? "-",
					chain: CHAIN_NAMES[kms.chain_id ?? 0] ?? `chain-${kms.chain_id}`,
				});
			}
		}

		const columns = ["CHAIN", "CONTRACT_ADDRESS"] as const;

		const rows = [...contracts.values()].map((c) => ({
			CHAIN: c.chain,
			CONTRACT_ADDRESS: c.address,
		}));

		if (rows.length === 0) {
			logger.info("No on-chain KMS contracts found");
			return 0;
		}

		printTable(columns, rows);
		return 0;
	} catch (error) {
		logger.logDetailedError(error);
		context.fail(
			`Failed to list KMS: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return 1;
	}
}

const kmsRootCommandMeta: CommandMeta = {
	name: "kms",
	description: "List and manage on-chain KMS contracts",
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
