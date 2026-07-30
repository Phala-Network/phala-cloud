import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { callDocsTool, resolveDocsMcpUrl } from "@/src/lib/docs-mcp";
import {
	type DocsSearchCommandInput,
	docsSearchCommandMeta,
	docsSearchCommandSchema,
} from "./command";

async function runDocsSearchCommand(
	input: DocsSearchCommandInput,
	context: CommandContext,
): Promise<number> {
	const query = input.query.join(" ");
	try {
		const results = await callDocsTool(
			"search_phala",
			{ query },
			{ url: resolveDocsMcpUrl(context.env) },
		);
		if (input.json) {
			context.success({ query, results });
			return 0;
		}
		if (!results.trim()) {
			context.stdout.write(
				`No results for "${query}". Try broader terms, or explore with \`phala docs tree\`.\n`,
			);
			return 0;
		}
		context.stdout.write(results.endsWith("\n") ? results : `${results}\n`);
		context.stdout.write(
			"\nTip: read a full page with `phala docs read <page path>`.\n",
		);
		return 0;
	} catch (error) {
		context.fail(error instanceof Error ? error.message : String(error));
		return 1;
	}
}

export const docsSearchCommand = defineCommand({
	path: ["docs", "search"],
	meta: docsSearchCommandMeta,
	schema: docsSearchCommandSchema,
	handler: runDocsSearchCommand,
});

export default docsSearchCommand;
