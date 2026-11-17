import { verifyAppDomain } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import {
	failDomainError,
	normalizeDomain,
	renderRecordChecks,
	resolveAppFilter,
	resolveBinding,
} from "../shared";
import {
	domainsVerifyCommandMeta,
	domainsVerifyCommandSchema,
	type DomainsVerifyCommandInput,
} from "./command";

async function runDomainsVerifyCommand(
	input: DomainsVerifyCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);
		const binding = await resolveBinding(
			client,
			normalizeDomain(input.domain),
			await resolveAppFilter(client, input),
		);
		const result = await verifyAppDomain(client, {
			appId: binding.app_id,
			domainId: binding.id,
		});

		if (input.json) {
			context.success(result);
			return 0;
		}

		const write = (text: string) => context.stdout.write(text);
		write(
			result.dns_verified_at
				? `${result.domain} is verified.\n\n`
				: `${result.domain} is not verified yet.${result.dns_error ? ` ${result.dns_error}` : ""}\n\n`,
		);
		write(renderRecordChecks(result.records));
		if (!result.dns_verified_at) {
			write(
				"\nDNS changes can take a while to spread. Run this command again once the records are published.\n",
			);
		}
		return 0;
	} catch (error) {
		return failDomainError(
			context,
			error,
			"Verify domain",
			Boolean((input as { debug?: boolean }).debug),
		);
	}
}

export const domainsVerifyCommand = defineCommand({
	path: ["domains", "verify"],
	meta: domainsVerifyCommandMeta,
	schema: domainsVerifyCommandSchema,
	handler: runDomainsVerifyCommand,
});

export default domainsVerifyCommand;
