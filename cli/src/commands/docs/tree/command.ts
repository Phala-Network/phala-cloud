import { z } from "zod";
import { jsonOption } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";

export const docsTreeCommandMeta: CommandMeta = {
	name: "tree",
	category: "advanced",
	description:
		"Show the structure of the Phala documentation site as a directory tree",
	stability: "unstable",
	arguments: [
		{
			name: "path",
			description: "Docs path to start from (default: /)",
			required: false,
			target: "path",
		},
	],
	options: [
		{
			name: "depth",
			shorthand: "L",
			description: "Maximum depth to display (default: 2)",
			type: "number",
			target: "depth",
		},
		jsonOption,
	],
	examples: [
		{
			name: "Show the top-level docs structure",
			value: "phala docs tree",
		},
		{
			name: "Explore a section in depth",
			value: "phala docs tree /phala-cloud --depth 3",
		},
	],
};

export const docsTreeCommandSchema = z.object({
	path: z.string().optional(),
	depth: z.coerce.number().int().min(1).max(10).default(2),
	json: z.boolean().default(false),
});

export type DocsTreeCommandInput = z.infer<typeof docsTreeCommandSchema>;
