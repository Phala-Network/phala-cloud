import { safeListKmsContractNodes } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";
import {
	kmsNodesCommandMeta,
	kmsNodesCommandSchema,
	type KmsNodesCommandInput,
} from "./command";

async function runKmsNodesCommand(
	input: KmsNodesCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);

		const result = await safeListKmsContractNodes(client, { slug: input.slug });

		if (!result.success) {
			context.failWithError(result.error.cause ?? result.error, {
				operation: "List KMS nodes",
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
			logger.info(`No KMS nodes found for contract '${input.slug}'`);
			return 0;
		}

		const columns = ["SLUG", "URL", "VERSION", "TYPE"] as const;
		const rows = data.items.map((n) => ({
			SLUG: n.slug ?? "-",
			URL: n.url,
			VERSION: n.version,
			TYPE: n.kms_type,
		}));

		printTable(columns, rows);
		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "List KMS nodes",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}
}

export const kmsNodesCommand = defineCommand({
	path: ["kms", "nodes"],
	meta: kmsNodesCommandMeta,
	schema: kmsNodesCommandSchema,
	handler: runKmsNodesCommand,
});
