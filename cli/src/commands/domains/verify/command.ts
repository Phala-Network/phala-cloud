import { z } from "zod";
import { jsonOption } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";
import { appIdOption } from "../shared";

export const domainsVerifyCommandMeta: CommandMeta = {
	name: "verify",
	description: "Re-check the DNS records of a domain you added",
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
		jsonOption,
	],
	examples: [
		{
			name: "Verify a domain",
			value: "phala domains verify app.example.com",
		},
		{
			name: "Verify a domain bound to several apps",
			value: "phala domains verify app.example.com --app-id <app-id>",
		},
	],
};

export const domainsVerifyCommandSchema = z.object({
	domain: z.string().min(1),
	appId: z.string().optional(),
	json: z.boolean().default(false),
});

export type DomainsVerifyCommandInput = z.infer<
	typeof domainsVerifyCommandSchema
>;
