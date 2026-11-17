import {
	getAppDomainGuide,
	type AppDomainGuide,
	type WorkspaceDomain,
} from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient, type CliApiClient } from "@/src/lib/client";
import { formatTable } from "@/src/lib/table";
import {
	describeApp,
	dnsStatus,
	failDomainError,
	findBindings,
	resolveAppFilter,
	normalizeDomain,
} from "../shared";
import {
	domainsInspectCommandMeta,
	domainsInspectCommandSchema,
	type DomainsInspectCommandInput,
} from "./command";

interface Binding {
	readonly domain: WorkspaceDomain;
	readonly guide: AppDomainGuide | null;
	readonly guide_error: string | null;
}

async function loadGuide(
	client: CliApiClient,
	appId: string,
): Promise<Pick<Binding, "guide" | "guide_error">> {
	try {
		return {
			guide: await getAppDomainGuide(client, { appId }),
			guide_error: null,
		};
	} catch (error) {
		// The guide is extra context; a 422 while the app has no route yet must
		// not hide the domain itself.
		const message = error instanceof Error ? error.message : String(error);
		return { guide: null, guide_error: message };
	}
}

function render(binding: Binding, write: (text: string) => void): void {
	const { domain, guide, guide_error } = binding;
	write(`Domain:   ${domain.domain}\n`);
	write(`App:      ${describeApp(domain)}\n`);
	write(`Port:     ${domain.port}\n`);
	write(
		`DNS:      ${dnsStatus(domain)}${domain.dns_error ? ` (${domain.dns_error})` : ""}\n`,
	);
	write(`Routing:  ${domain.routing_status ?? "-"}\n`);
	write(`Created:  ${domain.created_at}\n`);

	write("\nRecords to publish:\n");
	if (domain.expected_records.length === 0) {
		write("  (none)\n");
	} else {
		write(
			`${formatTable(
				["TYPE", "NAME", "VALUE"],
				domain.expected_records.map((record) => ({
					TYPE: record.record_type,
					NAME: record.query_name,
					VALUE: record.expected_value,
				})),
			)}\n`,
		);
	}

	if (guide) {
		write(`\nCNAME target:    gateway.${guide.gateway_domain_suffix}\n`);
		write(`TXT required:    ${guide.txt_required ? "yes" : "no"}\n`);
		write(
			`dstack-ingress:  ${guide.ingress_configured ? "configured" : "not configured"}\n`,
		);
	} else if (guide_error) {
		write(`\nApp DNS guide unavailable: ${guide_error}\n`);
	}
}

async function runDomainsInspectCommand(
	input: DomainsInspectCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);
		const items = await findBindings(
			client,
			normalizeDomain(input.domain),
			await resolveAppFilter(client, input),
		);
		const bindings: Binding[] = [];
		for (const domain of items) {
			bindings.push({ domain, ...(await loadGuide(client, domain.app_id)) });
		}

		if (input.json) {
			context.success({ bindings });
			return 0;
		}

		const write = (text: string) => context.stdout.write(text);
		bindings.forEach((binding, index) => {
			if (index > 0) write("\n----\n\n");
			render(binding, write);
		});
		return 0;
	} catch (error) {
		return failDomainError(
			context,
			error,
			"Inspect domain",
			Boolean((input as { debug?: boolean }).debug),
		);
	}
}

export const domainsInspectCommand = defineCommand({
	path: ["domains", "inspect"],
	meta: domainsInspectCommandMeta,
	schema: domainsInspectCommandSchema,
	handler: runDomainsInspectCommand,
});

export default domainsInspectCommand;
