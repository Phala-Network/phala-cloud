import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	normalizeDocPath,
	resolveDocsMcpUrl,
	runDocsFsCommand,
	shellQuote,
} from "@/src/lib/docs-mcp";
import {
	type DocsGrepCommandInput,
	docsGrepCommandMeta,
	docsGrepCommandSchema,
} from "./command";

async function runDocsGrepCommand(
	input: DocsGrepCommandInput,
	context: CommandContext,
): Promise<number> {
	const path = input.path ? normalizeDocPath(input.path) : "/";
	const flags = input.files ? "-Sl" : "-Sn";
	try {
		const result = await runDocsFsCommand(
			`rg ${flags} ${shellQuote(input.pattern)} ${shellQuote(path)}`,
			{ url: resolveDocsMcpUrl(context.env) },
		);
		// rg exits 1 on "no matches" with empty stderr
		if (result.exit !== 0 && result.stderr.trim()) {
			context.fail(result.stderr.trim());
			return 1;
		}
		const matches = result.stdout;
		if (input.json) {
			context.success({ pattern: input.pattern, path, matches });
			return 0;
		}
		if (!matches.trim()) {
			context.stdout.write(
				`No matches for "${input.pattern}". Try \`phala docs search\` for relevance-ranked results.\n`,
			);
			return 0;
		}
		context.stdout.write(matches.endsWith("\n") ? matches : `${matches}\n`);
		return 0;
	} catch (error) {
		context.fail(error instanceof Error ? error.message : String(error));
		return 1;
	}
}

export const docsGrepCommand = defineCommand({
	path: ["docs", "grep"],
	meta: docsGrepCommandMeta,
	schema: docsGrepCommandSchema,
	handler: runDocsGrepCommand,
});

export default docsGrepCommand;
