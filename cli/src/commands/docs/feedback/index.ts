import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	callDocsTool,
	normalizeDocPath,
	resolveDocsMcpUrl,
} from "@/src/lib/docs-mcp";
import {
	type DocsFeedbackCommandInput,
	docsFeedbackCommandMeta,
	docsFeedbackCommandSchema,
} from "./command";

async function runDocsFeedbackCommand(
	input: DocsFeedbackCommandInput,
	context: CommandContext,
): Promise<number> {
	const path = normalizeDocPath(input.page).replace(/\.mdx$/, "");
	const feedback = input.message.join(" ");
	try {
		const response = await callDocsTool(
			"submit_feedback",
			{ path, feedback },
			{ url: resolveDocsMcpUrl(context.env) },
		);
		if (input.json) {
			context.success({ path, feedback, response });
			return 0;
		}
		context.stdout.write(
			`${response.trim() || "Feedback submitted. Thanks for helping improve the docs."}\n`,
		);
		return 0;
	} catch (error) {
		context.fail(error instanceof Error ? error.message : String(error));
		return 1;
	}
}

export const docsFeedbackCommand = defineCommand({
	path: ["docs", "feedback"],
	meta: docsFeedbackCommandMeta,
	schema: docsFeedbackCommandSchema,
	handler: runDocsFeedbackCommand,
});

export default docsFeedbackCommand;
