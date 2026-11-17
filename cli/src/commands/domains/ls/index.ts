import { listDomains } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { formatTable } from "@/src/lib/table";
import {
	describeApp,
	dnsStatus,
	failDomainError,
	normalizeAppId,
} from "../shared";
import {
	domainsLsCommandMeta,
	domainsLsCommandSchema,
	type DomainsLsCommandInput,
} from "./command";

async function runDomainsLsCommand(
	input: DomainsLsCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);
		const result = await listDomains(client, {
			...(input.appId ? { app_id: normalizeAppId(input.appId) } : {}),
			...(input.page ? { page: input.page } : {}),
			...(input.pageSize ? { page_size: input.pageSize } : {}),
		});

		if (input.json) {
			context.success(result);
			return 0;
		}

		if (result.items.length === 0) {
			context.stdout.write("No domains found\n");
			return 0;
		}

		context.stdout.write(
			`${formatTable(
				["DOMAIN", "APP", "PORT", "DNS", "ROUTING"],
				result.items.map((item) => ({
					DOMAIN: item.domain,
					APP: describeApp(item),
					PORT: String(item.port),
					DNS: dnsStatus(item),
					ROUTING: item.routing_status ?? "-",
				})),
			)}\n`,
		);
		if (result.total_pages > 1) {
			context.stdout.write(
				`\nPage ${result.page} of ${result.total_pages} (${result.total} domains). Use --page to see more.\n`,
			);
		}
		return 0;
	} catch (error) {
		return failDomainError(
			context,
			error,
			"List domains",
			Boolean((input as { debug?: boolean }).debug),
		);
	}
}

export const domainsLsCommand = defineCommand({
	path: ["domains", "ls"],
	meta: domainsLsCommandMeta,
	schema: domainsLsCommandSchema,
	handler: runDomainsLsCommand,
});

export default domainsLsCommand;
