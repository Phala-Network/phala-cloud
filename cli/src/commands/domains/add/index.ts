import { createAppDomain } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import {
	failDomainError,
	normalizeDomain,
	renderExpectedRecords,
	resolveAppId,
} from "../shared";
import {
	domainsAddCommandMeta,
	domainsAddCommandSchema,
	type DomainsAddCommandInput,
} from "./command";

async function runDomainsAddCommand(
	input: DomainsAddCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const appId = resolveAppId(input.appId, context);
		const domain = normalizeDomain(input.domain);
		const client = await getClient(context);
		const created = await createAppDomain(client, {
			appId,
			domain,
			port: input.port,
		});

		if (input.json) {
			context.success(created);
			return 0;
		}

		const write = (text: string) => context.stdout.write(text);
		write(`Added ${created.domain} (port ${created.port}) to app ${appId}.\n`);
		write("\nPublish these DNS records at your DNS provider:\n");
		write(renderExpectedRecords(created.expected_records));
		if (created.sync.warnings.length > 0) {
			write("\nWarnings:\n");
			for (const warning of created.sync.warnings) {
				write(
					`  - ${typeof warning === "string" ? warning : JSON.stringify(warning)}\n`,
				);
			}
		}
		write(
			`\nOnce the records are live, run: phala domains verify ${created.domain}\n`,
		);
		return 0;
	} catch (error) {
		return failDomainError(
			context,
			error,
			"Add domain",
			Boolean((input as { debug?: boolean }).debug),
		);
	}
}

export const domainsAddCommand = defineCommand({
	path: ["domains", "add"],
	meta: domainsAddCommandMeta,
	schema: domainsAddCommandSchema,
	handler: runDomainsAddCommand,
});

export default domainsAddCommand;
