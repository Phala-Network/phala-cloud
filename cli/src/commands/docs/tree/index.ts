import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	normalizeDocPath,
	resolveDocsToolOptions,
	runDocsFsCommand,
	shellQuote,
} from "@/src/lib/docs-mcp";
import {
	type DocsTreeCommandInput,
	docsTreeCommandMeta,
	docsTreeCommandSchema,
} from "./command";

async function runDocsTreeCommand(
	input: DocsTreeCommandInput,
	context: CommandContext,
): Promise<number> {
	const path = input.path ? normalizeDocPath(input.path) : "/";
	try {
		const result = await runDocsFsCommand(
			`tree ${shellQuote(path)} -L ${input.depth}`,
			resolveDocsToolOptions(context),
		);
		if (result.exit !== 0) {
			context.fail(result.stderr.trim() || `Failed to list ${path}`);
			return 1;
		}
		if (input.json) {
			context.success({ path, depth: input.depth, tree: result.stdout });
			return 0;
		}
		context.stdout.write(
			result.stdout.endsWith("\n") ? result.stdout : `${result.stdout}\n`,
		);
		context.stdout.write(
			"\nTip: read a page with `phala docs read <path>`; search with `phala docs search <query>`.\n",
		);
		return 0;
	} catch (error) {
		context.fail(error instanceof Error ? error.message : String(error));
		return 1;
	}
}

export const docsTreeCommand = defineCommand({
	path: ["docs", "tree"],
	meta: docsTreeCommandMeta,
	schema: docsTreeCommandSchema,
	handler: runDocsTreeCommand,
});

export default docsTreeCommand;
