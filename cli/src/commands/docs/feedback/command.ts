import { z } from "zod";
import { jsonOption } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";

export const docsFeedbackCommandMeta: CommandMeta = {
	name: "feedback",
	category: "advanced",
	description:
		"Report a documentation problem (incorrect, outdated, or confusing content) to the Phala docs team",
	stability: "unstable",
	arguments: [
		{
			name: "page",
			description:
				"Docs page path the feedback is about (e.g. /phala-cloud/getting-started)",
			required: true,
			target: "page",
		},
		{
			name: "message...",
			description: "Description of the issue",
			required: true,
			variadic: true,
			target: "message",
		},
	],
	options: [jsonOption],
	examples: [
		{
			name: "Report an outdated page",
			value:
				'phala docs feedback /phala-cloud/getting-started "The login example still shows the deprecated auth command"',
		},
	],
};

export const docsFeedbackCommandSchema = z.object({
	page: z.string().min(1),
	message: z.array(z.string()).min(1),
	json: z.boolean().default(false),
});

export type DocsFeedbackCommandInput = z.infer<
	typeof docsFeedbackCommandSchema
>;
