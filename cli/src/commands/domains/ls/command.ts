import { z } from "zod";
import { jsonOption } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";
import { appIdOption, cvmSelectorOption } from "../shared";

export const domainsLsCommandMeta: CommandMeta = {
	name: "ls",
	description: "List custom domains in the workspace",
	stability: "unstable",
	options: [
		{
			...appIdOption,
			description: "Only list domains bound to this app.",
		},
		{
			name: "page",
			description: "Page number (default 1).",
			type: "number",
			target: "page",
		},
		{
			name: "page-size",
			description: "Items per page (1-100).",
			type: "number",
			target: "pageSize",
		},
		cvmSelectorOption,
		jsonOption,
	],
	examples: [
		{ name: "List every domain in the workspace", value: "phala domains ls" },
		{
			name: "List the domains of one app",
			value: "phala domains ls --app-id <app-id>",
		},
		{ name: "Output as JSON", value: "phala domains ls --json" },
	],
};

export const domainsLsCommandSchema = z.object({
	appId: z.string().optional(),
	cvmId: z.string().optional(),
	page: z.number().int().min(1).optional(),
	pageSize: z.number().int().min(1).max(100).optional(),
	json: z.boolean().default(false),
});

export type DomainsLsCommandInput = z.infer<typeof domainsLsCommandSchema>;
