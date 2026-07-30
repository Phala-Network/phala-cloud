import { z } from "zod";
import { jsonOption } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";

export const docsSearchCommandMeta: CommandMeta = {
	name: "search",
	category: "advanced",
	description:
		"Search the live Phala documentation. Returns titles, links, and content excerpts. Use `phala docs read <page>` to read a full page.",
	stability: "unstable",
	arguments: [
		{
			name: "query...",
			description: "Search query (multiple words are joined)",
			required: true,
			variadic: true,
			target: "query",
		},
	],
	options: [jsonOption],
	examples: [
		{
			name: "Search the docs",
			value: "phala docs search deploy a CVM with GPU",
		},
		{
			name: "Search and output JSON",
			value: 'phala docs search "on-chain KMS" --json',
		},
	],
};

export const docsSearchCommandSchema = z.object({
	query: z.array(z.string()).min(1),
	json: z.boolean().default(false),
});

export type DocsSearchCommandInput = z.infer<typeof docsSearchCommandSchema>;
