import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	helpCommandMeta,
	helpCommandSchema,
	type HelpCommandInput,
} from "./command";
import { helpTopics } from "./topics.generated";

function listTopics(): string {
	const topics = Object.values(helpTopics);
	if (topics.length === 0) {
		return "This build contains no help topics.\n";
	}
	const lines: string[] = ["Available help topics:", ""];
	for (const topic of topics) {
		lines.push(`  ${topic.name.padEnd(18)}${topic.description}`.trimEnd());
	}
	lines.push("");
	lines.push('Use "phala help <topic>" to read a topic.');
	return `${lines.join("\n")}\n`;
}

async function runHelpCommand(
	input: HelpCommandInput,
	context: CommandContext,
): Promise<number> {
	if (!input.topic) {
		context.stdout.write(listTopics());
		return 0;
	}

	const name = input.topic.trim().toLowerCase();
	const topic = helpTopics[name];
	if (!topic) {
		const available = Object.keys(helpTopics).sort().join(", ");
		context.fail(
			available
				? `Unknown help topic "${input.topic}". Available: ${available}`
				: `Unknown help topic "${input.topic}". This build contains no help topics.`,
		);
		return 1;
	}

	const content = topic.content.endsWith("\n")
		? topic.content
		: `${topic.content}\n`;
	context.stdout.write(content);
	return 0;
}

export const helpCommand = defineCommand({
	path: ["help"],
	meta: helpCommandMeta,
	schema: helpCommandSchema,
	handler: runHelpCommand,
});

export default helpCommand;
