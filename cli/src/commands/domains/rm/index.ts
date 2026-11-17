import inquirer from "inquirer";
import { deleteAppDomain } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import {
	describeApp,
	failDomainError,
	normalizeDomain,
	resolveBinding,
} from "../shared";
import {
	domainsRmCommandMeta,
	domainsRmCommandSchema,
	type DomainsRmCommandInput,
} from "./command";

async function runDomainsRmCommand(
	input: DomainsRmCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);
		const binding = await resolveBinding(
			client,
			normalizeDomain(input.domain),
			input.appId,
		);

		if (!input.yes) {
			const canPrompt = context.stdin.isTTY === true && !input.json;
			if (!canPrompt) {
				context.fail(
					`Refusing to remove ${binding.domain} without confirmation. Pass --yes to remove it.`,
				);
				return 1;
			}
			const { confirm } = await inquirer.prompt([
				{
					type: "confirm",
					name: "confirm",
					message: `Remove ${binding.domain} from ${describeApp(binding)}? Traffic to this domain stops being served.`,
					default: false,
				},
			]);
			if (!confirm) {
				context.stdout.write("Cancelled. Nothing was removed.\n");
				return 0;
			}
		}

		const removed = await deleteAppDomain(client, {
			appId: binding.app_id,
			domainId: binding.id,
		});

		if (input.json) {
			context.success({ removed: true, ...removed });
			return 0;
		}
		context.stdout.write(
			`Removed ${removed.domain} from ${describeApp(binding)}.\n`,
		);
		return 0;
	} catch (error) {
		return failDomainError(
			context,
			error,
			"Remove domain",
			Boolean((input as { debug?: boolean }).debug),
		);
	}
}

export const domainsRmCommand = defineCommand({
	path: ["domains", "rm"],
	meta: domainsRmCommandMeta,
	schema: domainsRmCommandSchema,
	handler: runDomainsRmCommand,
});

export default domainsRmCommand;
