import { z } from "zod";
import { jsonOption } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";
import { appIdOption, DEFAULT_DOMAIN_PORT, portOption } from "../shared";

export const domainsCheckCommandMeta: CommandMeta = {
	name: "check",
	description: "Check a domain's DNS records against an app, without adding it",
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
		portOption,
		jsonOption,
	],
	examples: [
		{
			name: "Check a domain for an app",
			value: "phala domains check app.example.com --app-id <app-id>",
		},
		{
			name: "Check a domain served on another port",
			value:
				"phala domains check app.example.com --app-id <app-id> --port 8443",
		},
	],
};

export const domainsCheckCommandSchema = z.object({
	domain: z.string().min(1),
	appId: z.string().optional(),
	port: z.number().int().min(1).max(65535).default(DEFAULT_DOMAIN_PORT),
	json: z.boolean().default(false),
});

export type DomainsCheckCommandInput = z.infer<
	typeof domainsCheckCommandSchema
>;
