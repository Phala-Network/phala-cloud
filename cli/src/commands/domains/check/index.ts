import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { preflightAppDomain } from "@phala/cloud";
import {
	failDomainError,
	normalizeDomain,
	renderRecordChecks,
	resolveAppId,
} from "../shared";
import {
	type DomainsCheckCommandInput,
	domainsCheckCommandMeta,
	domainsCheckCommandSchema,
} from "./command";

async function runDomainsCheckCommand(
	input: DomainsCheckCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);
		const appId = await resolveAppId(client, input, context);
		const result = await preflightAppDomain(client, {
			appId,
			domain: normalizeDomain(input.domain),
			port: input.port,
		});

		if (input.json) {
			context.success(result);
			return 0;
		}

		// Platform rows decide whether the domain can be bound at all; DNS rows
		// only say whether traffic reaches the app yet. Binding does not wait for
		// DNS, so only a platform failure blocks the next step.
		const bindable = result.records.every(
			(record) => record.record_type !== "platform" || record.is_valid,
		);
		const status = result.is_valid
			? "ready"
			: bindable
				? "can be bound; DNS is not ready yet"
				: "cannot be bound to this app";
		context.stdout.write(
			`${result.domain} (port ${result.port}): ${status}\n\n`,
		);
		context.stdout.write(renderRecordChecks(result.records));
		if (bindable) {
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
