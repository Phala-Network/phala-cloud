import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	type DocsFsResult,
	type DocsToolOptions,
	normalizeDocPath,
	resolveDocsMcpUrl,
	runDocsFsCommand,
	shellQuote,
} from "@/src/lib/docs-mcp";
import {
	type DocsReadCommandInput,
	docsReadCommandMeta,
	docsReadCommandSchema,
} from "./command";

interface PageResult {
	readonly page: string;
	readonly resolvedPath: string;
	readonly content: string | null;
	readonly error: string | null;
}

/** Pages are stored as .mdx files; directories index as <dir>/index.mdx. */
function candidatePaths(path: string): string[] {
	if (/\.[a-z0-9]+$/i.test(path)) {
		return [path];
	}
	return [`${path}.mdx`, path, `${path}/index.mdx`];
}

async function readPage(
	page: string,
	options: DocsToolOptions,
): Promise<PageResult> {
	const normalized = normalizeDocPath(page);
	const candidates = candidatePaths(normalized);
	let lastFailure: DocsFsResult | null = null;
	for (const candidate of candidates) {
		const result = await runDocsFsCommand(
			`cat ${shellQuote(candidate)}`,
			options,
		);
		if (result.exit === 0) {
			return {
				page,
				resolvedPath: candidate,
				content: result.stdout,
				error: null,
			};
		}
		lastFailure = result;
	}
	const detail =
		candidates.length === 1 ? lastFailure?.stderr.trim() : undefined;
	return {
		page,
		resolvedPath: normalized,
		content: null,
		error:
			detail ||
			`Page not found: ${normalized}. Find pages with \`phala docs search <query>\` or \`phala docs tree\`.`,
	};
}

async function runDocsReadCommand(
	input: DocsReadCommandInput,
	context: CommandContext,
): Promise<number> {
	const options = { url: resolveDocsMcpUrl(context.env) };
	try {
		const results: PageResult[] = [];
		for (const page of input.pages) {
			results.push(await readPage(page, options));
		}

		const failed = results.filter((result) => result.error !== null);
		if (input.json) {
			if (failed.length === results.length) {
				context.fail(failed[0].error ?? "Failed to read docs", { results });
				return 1;
			}
			context.success({ pages: results });
			return 0;
		}

		for (const result of results) {
			if (results.length > 1) {
				context.stdout.write(`==> ${result.resolvedPath} <==\n`);
			}
			if (result.content !== null) {
				context.stdout.write(
					result.content.endsWith("\n")
						? result.content
						: `${result.content}\n`,
				);
			} else {
				context.stderr.write(`${result.error}\n`);
			}
			if (results.length > 1) {
				context.stdout.write("\n");
			}
		}
		return failed.length > 0 ? 1 : 0;
	} catch (error) {
		context.fail(error instanceof Error ? error.message : String(error));
		return 1;
	}
}

export const docsReadCommand = defineCommand({
	path: ["docs", "read"],
	meta: docsReadCommandMeta,
	schema: docsReadCommandSchema,
	handler: runDocsReadCommand,
});

export default docsReadCommand;
