import { preflightAppDomain } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import {
	failDomainError,
	normalizeDomain,
	renderRecordChecks,
	resolveAppId,
} from "../shared";
import {
	domainsCheckCommandMeta,
	domainsCheckCommandSchema,
	type DomainsCheckCommandInput,
} from "./command";

async function runDomainsCheckCommand(
	input: DomainsCheckCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const appId = resolveAppId(input.appId, context);
		const client = await getClient(context);
		const result = await preflightAppDomain(client, {
			appId,
			domain: normalizeDomain(input.domain),
			port: input.port,
		});

		if (input.json) {
			context.success(result);
			return 0;
		}

		context.stdout.write(
			`${result.domain} (port ${result.port}): ${result.is_valid ? "DNS is ready" : "DNS is not ready yet"}\n\n`,
		);
		context.stdout.write(renderRecordChecks(result.records));
		if (result.is_valid) {
			context.stdout.write(
				`\nNext: phala domains add ${result.domain} --app-id ${appId}\n`,
			);
		}
		return 0;
	} catch (error) {
		return failDomainError(
			context,
			error,
			"Check domain",
			Boolean((input as { debug?: boolean }).debug),
		);
	}
}

export const domainsCheckCommand = defineCommand({
	path: ["domains", "check"],
	meta: domainsCheckCommandMeta,
	schema: domainsCheckCommandSchema,
	handler: runDomainsCheckCommand,
});

export default domainsCheckCommand;
