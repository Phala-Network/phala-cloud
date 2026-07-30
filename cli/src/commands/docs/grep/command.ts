import { z } from "zod";
import { jsonOption } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";

export const docsGrepCommandMeta: CommandMeta = {
	name: "grep",
	category: "advanced",
	description:
		"Grep the full text of the Phala documentation (ripgrep, smart-case). For relevance-ranked results use `phala docs search`.",
	stability: "unstable",
	arguments: [
		{
			name: "pattern",
			description: "Regex pattern to search for",
			required: true,
			target: "pattern",
		},
		{
			name: "path",
			description: "Docs path to search under (default: /)",
			required: false,
			target: "path",
		},
	],
	options: [
		{
			name: "files",
			shorthand: "l",
			description: "Only list matching file paths",
			type: "boolean",
			target: "files",
		},
		jsonOption,
	],
	examples: [
		{
			name: "Find every mention of an env var",
			value: "phala docs grep PHALA_CLOUD_API_KEY",
		},
		{
			name: "Search within one section",
			value: 'phala docs grep "attestation" /dstack',
		},
		{
			name: "List matching pages only",
			value: "phala docs grep tdx_quote --files",
		},
	],
};

export const docsGrepCommandSchema = z.object({
	pattern: z.string().min(1),
	path: z.string().optional(),
	files: z.boolean().default(false),
	json: z.boolean().default(false),
});

export type DocsGrepCommandInput = z.infer<typeof docsGrepCommandSchema>;
