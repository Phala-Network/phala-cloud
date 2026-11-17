import { z } from "zod";
import { jsonOption } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";
import { appIdOption, DEFAULT_DOMAIN_PORT, portOption } from "../shared";

export const domainsAddCommandMeta: CommandMeta = {
	name: "add",
	description: "Add a custom domain to an app",
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
			name: "Add a domain to an app",
			value: "phala domains add app.example.com --app-id <app-id>",
		},
		{
			name: "Output as JSON",
			value: "phala domains add app.example.com --app-id <app-id> --json",
		},
	],
};

export const domainsAddCommandSchema = z.object({
	domain: z.string().min(1),
	appId: z.string().optional(),
	port: z.number().int().min(1).max(65535).default(DEFAULT_DOMAIN_PORT),
	json: z.boolean().default(false),
});

export type DomainsAddCommandInput = z.infer<typeof domainsAddCommandSchema>;
