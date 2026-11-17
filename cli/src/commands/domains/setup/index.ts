import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import inquirer from "inquirer";
import { mergeAppDomainIngress } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { failDomainError, normalizeDomain, resolveAppId } from "../shared";
import {
	domainsSetupCommandMeta,
	domainsSetupCommandSchema,
	type DomainsSetupCommandInput,
} from "./command";
import {
	insertIngressService,
	unifiedDiff,
	writeFileAtomic,
} from "./compose-insert";

const DEFAULT_COMPOSE_FILES = ["docker-compose.yml", "docker-compose.yaml"];

/** The compose file `phala deploy` would use: --compose, phala.toml, then the default names. */
function resolveComposePath(
	input: DomainsSetupCommandInput,
	context: CommandContext,
): string {
	const configured = input.compose || context.projectConfig.compose_file;
	const candidates = configured ? [configured] : DEFAULT_COMPOSE_FILES;
	for (const candidate of candidates) {
		const path = resolve(context.cwd, candidate);
		if (existsSync(path)) return path;
	}
	throw new Error(
		configured
			? `Docker compose file not found: ${configured}`
			: "No docker compose file found. Pass -c/--compose <file>.",
	);
}

async function runDomainsSetupCommand(
	input: DomainsSetupCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const appId = resolveAppId(input.appId, context);
		const domain = normalizeDomain(input.domain);
		const composePath = resolveComposePath(input, context);
		const label = relative(context.cwd, composePath) || composePath;
		const original = readFileSync(composePath, "utf8");

		const client = await getClient(context);
		const merge = await mergeAppDomainIngress(client, {
			appId,
			domain,
			port: input.port,
			dns_provider: input.dnsProvider,
			docker_compose_file: original,
		});
		const write = (text: string) => context.stdout.write(text);

		if (merge.already_configured) {
			if (input.json) {
				context.success({
					file: composePath,
					already_configured: true,
					changed: false,
				});
			} else {
				write(
					`${label} already has dstack-ingress configured for ${domain}. Nothing changed.\n`,
				);
			}
			return 0;
		}

		if (!merge.ingress_service_name || !merge.ingress_service) {
			throw new Error(
				"The server did not return an ingress service to add. Update the CLI and try again.",
			);
		}
		const updated = insertIngressService(original, {
			serviceName: merge.ingress_service_name,
			service: merge.ingress_service,
			volumes: merge.top_level_volumes,
		});
		const diff = unifiedDiff(label, original, updated);
		const summary = {
			file: composePath,
			already_configured: false,
			diff,
			required_env_keys: merge.required_env_keys,
			warnings: merge.warnings,
		};

		if (!input.json) {
			write(`Changes to ${label}:\n\n${diff}`);
			if (merge.required_env_keys.length > 0) {
				write("\nEnvironment variables the ingress needs:\n");
				for (const key of merge.required_env_keys) write(`  - ${key}\n`);
			}
			if (merge.warnings.length > 0) {
				write("\nWarnings:\n");
				for (const warning of merge.warnings) write(`  - ${warning}\n`);
			}
			write("\n");
		}

		if (!input.yes) {
			const canPrompt = context.stdin.isTTY === true && !input.json;
			if (!canPrompt) {
				context.fail(
					`Not writing ${label} without confirmation. Review the diff and run again with --yes to apply it.`,
					input.json ? summary : undefined,
				);
				return 1;
			}
			const { confirm } = await inquirer.prompt([
				{
					type: "confirm",
					name: "confirm",
					message: `Write these changes to ${label}?`,
					default: true,
				},
			]);
			if (!confirm) {
				write("Cancelled. The file was not changed.\n");
				return 0;
			}
		}

		writeFileAtomic(composePath, updated);

		if (input.json) {
			context.success({ ...summary, changed: true });
			return 0;
		}
		write(`Updated ${label}.\n\n`);
		write(
			"Next: set the environment variables above (in your .env file or with `phala envs`), then run `phala deploy` to apply the compose.\n",
		);
		return 0;
	} catch (error) {
		return failDomainError(
			context,
			error,
			"Set up domain ingress",
			Boolean((input as { debug?: boolean }).debug),
		);
	}
}

export const domainsSetupCommand = defineCommand({
	path: ["domains", "setup"],
	meta: domainsSetupCommandMeta,
	schema: domainsSetupCommandSchema,
	handler: runDomainsSetupCommand,
});

export default domainsSetupCommand;
