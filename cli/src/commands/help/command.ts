import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";
import { helpTopics } from "./topics.generated";

function buildExamples(): { name: string; value: string }[] {
	const examples: { name: string; value: string }[] = [
		{
			name: "List available help topics",
			value: "phala help",
		},
	];
	for (const topic of Object.values(helpTopics)) {
		examples.push({
			name: `Show "${topic.name}" topic`,
			value: `phala help ${topic.name}`,
		});
	}
	return examples;
}

export const helpCommandMeta: CommandMeta = {
	name: "help",
	category: "advanced",
	description: "Show help topics bundled with the CLI",
	stability: "stable",
	arguments: [
		{
			name: "topic",
			description: "Help topic name (see `phala help` for the list)",
			required: false,
			target: "topic",
		},
	],
	examples: buildExamples(),
};

export const helpCommandSchema = z.object({
	topic: z.string().optional(),
});

export type HelpCommandInput = z.infer<typeof helpCommandSchema>;
