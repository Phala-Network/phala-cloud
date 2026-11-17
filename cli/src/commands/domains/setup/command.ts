import { z } from "zod";
import { jsonOption } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";
import {
	appIdOption,
	cvmSelectorOption,
	DEFAULT_DOMAIN_PORT,
	portOption,
} from "../shared";

export const domainsSetupCommandMeta: CommandMeta = {
	name: "setup",
	description:
		"Add the dstack-ingress sidecar for a domain to your local compose file",
	stability: "unstable",
	arguments: [
		{
			name: "domain",
			description: "Domain name, for example app.example.com",
			required: true,
			target: "domain",
		},
	],
	options: [
		{
			...appIdOption,
			description: "App ID (hex identifier). Defaults to app_id in phala.toml.",
		},
		cvmSelectorOption,
		portOption,
		{
			name: "dns-provider",
			description:
				"DNS provider the ingress uses for certificates (default cloudflare).",
			type: "string",
			target: "dnsProvider",
		},
		{
			name: "compose",
			shorthand: "c",
			description:
				"Compose file to edit. Defaults to compose_file in phala.toml, then docker-compose.yml.",
			type: "string",
			target: "compose",
		},
		{
			name: "yes",
			shorthand: "y",
			description:
				"Write the change without asking. Required when the CLI cannot prompt.",
			type: "boolean",
			target: "yes",
		},
		jsonOption,
	],
	examples: [
		{
			name: "Add the ingress sidecar to docker-compose.yml",
			value: "phala domains setup app.example.com --app-id <app-id>",
		},
		{
			name: "Edit a specific compose file without a prompt",
			value:
				"phala domains setup app.example.com --app-id <app-id> -c ./compose.prod.yml --yes",
		},
	],
};

export const domainsSetupCommandSchema = z.object({
	domain: z.string().min(1),
	appId: z.string().optional(),
	cvmId: z.string().optional(),
	port: z.number().int().min(1).max(65535).default(DEFAULT_DOMAIN_PORT),
	dnsProvider: z.string().min(1).default("cloudflare"),
	compose: z.string().optional(),
	yes: z.boolean().default(false),
	json: z.boolean().default(false),
});

export type DomainsSetupCommandInput = z.infer<
	typeof domainsSetupCommandSchema
>;
