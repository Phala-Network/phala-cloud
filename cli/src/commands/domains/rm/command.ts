import { z } from "zod";
import { jsonOption } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";
import { appIdOption } from "../shared";

export const domainsRmCommandMeta: CommandMeta = {
	name: "rm",
	description: "Remove a custom domain from an app",
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
			description:
				"App the domain is bound to. Required when the domain is bound to more than one app.",
		},
		{
			name: "yes",
			shorthand: "y",
			description:
				"Skip the confirmation prompt. Required when the CLI cannot prompt.",
			type: "boolean",
			target: "yes",
		},
		jsonOption,
	],
	examples: [
		{
			name: "Remove a domain after confirming",
			value: "phala domains rm app.example.com",
		},
		{
			name: "Remove a domain without a prompt",
			value: "phala domains rm app.example.com --yes",
		},
	],
};

export const domainsRmCommandSchema = z.object({
	domain: z.string().min(1),
	appId: z.string().optional(),
	yes: z.boolean().default(false),
	json: z.boolean().default(false),
});

export type DomainsRmCommandInput = z.infer<typeof domainsRmCommandSchema>;
