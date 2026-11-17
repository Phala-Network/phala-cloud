import { z } from "zod";
import { jsonOption } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";
import { appIdOption } from "../shared";

export const domainsInspectCommandMeta: CommandMeta = {
	name: "inspect",
	description: "Show the DNS records, status and routing of a domain",
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
			description: "Only show the binding to this app.",
		},
		jsonOption,
	],
	examples: [
		{
			name: "Inspect a domain",
			value: "phala domains inspect app.example.com",
		},
		{
			name: "Output as JSON",
			value: "phala domains inspect app.example.com --json",
		},
	],
};

export const domainsInspectCommandSchema = z.object({
	domain: z.string().min(1),
	appId: z.string().optional(),
	json: z.boolean().default(false),
});

export type DomainsInspectCommandInput = z.infer<
	typeof domainsInspectCommandSchema
>;
