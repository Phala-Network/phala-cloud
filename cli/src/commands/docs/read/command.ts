import { z } from "zod";
import { jsonOption } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";

export const docsReadCommandMeta: CommandMeta = {
	name: "read",
	category: "advanced",
	description:
		"Read one or more Phala documentation pages in full. Accepts page paths from `phala docs search`/`phala docs tree` or docs.phala.com URLs.",
	stability: "unstable",
	arguments: [
		{
			name: "page...",
			description:
				"Page path (e.g. /phala-cloud/getting-started) or docs.phala.com URL",
			required: true,
			variadic: true,
			target: "pages",
		},
	],
	options: [jsonOption],
	examples: [
		{
			name: "Read a page by path",
			value: "phala docs read /dstack/getting-started",
		},
		{
			name: "Read a page by URL",
			value:
				"phala docs read https://docs.phala.com/phala-cloud/getting-started/overview",
		},
		{
			name: "Read multiple pages",
			value: "phala docs read /dstack/overview /dstack/faqs",
		},
	],
};

export const docsReadCommandSchema = z.object({
	pages: z.array(z.string()).min(1),
	json: z.boolean().default(false),
});

export type DocsReadCommandInput = z.infer<typeof docsReadCommandSchema>;
