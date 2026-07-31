/**
 * Minimal client for the hosted Phala docs MCP server (https://docs.phala.com/mcp).
 *
 * The server is a stateless streamable-HTTP MCP endpoint: each tools/call is a
 * single JSON-RPC POST, answered either as plain JSON or as an SSE frame.
 * No session handshake is required, so we speak the wire format directly
 * instead of pulling in an MCP client library.
 */

const DEFAULT_DOCS_MCP_URL = "https://docs.phala.com/mcp";

export function resolveDocsMcpUrl(
	env: NodeJS.ProcessEnv = process.env,
): string {
	return env.PHALA_DOCS_MCP_URL || DEFAULT_DOCS_MCP_URL;
}

export interface DocsToolOptions {
	readonly url?: string;
}

interface JsonRpcMessage {
	result?: {
		isError?: boolean;
		content?: Array<{ type?: string; text?: string }>;
	};
	error?: { code?: number; message?: string };
}

function parseJsonRpcResponse(body: string): JsonRpcMessage {
	const trimmed = body.trim();
	if (trimmed.startsWith("{")) {
		return JSON.parse(trimmed) as JsonRpcMessage;
	}
	// SSE framing: keep the last `data:` line that parses as JSON
	let last: JsonRpcMessage | undefined;
	for (const line of trimmed.split("\n")) {
		if (!line.startsWith("data:")) continue;
		try {
			last = JSON.parse(line.slice(5).trim()) as JsonRpcMessage;
		} catch {
			// ignore non-JSON data lines (e.g. keep-alives)
		}
	}
	if (!last) {
		throw new Error("Unexpected response from the docs server");
	}
	return last;
}

export async function callDocsTool(
	name: string,
	args: Record<string, unknown>,
	options: DocsToolOptions = {},
): Promise<string> {
	const url = options.url ?? resolveDocsMcpUrl();
	let response: Response;
	try {
		response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "tools/call",
				params: { name, arguments: args },
			}),
		});
	} catch (error) {
		throw new Error(
			`Could not reach the Phala docs server at ${url}. Check your network connection, or browse https://docs.phala.com directly. (${
				error instanceof Error ? error.message : String(error)
			})`,
		);
	}
	if (!response.ok) {
		throw new Error(
			`Phala docs server returned HTTP ${response.status}. Try again shortly, or browse https://docs.phala.com directly.`,
		);
	}
	const message = parseJsonRpcResponse(await response.text());
	if (message.error) {
		throw new Error(
			`Docs server error: ${message.error.message ?? JSON.stringify(message.error)}`,
		);
	}
	const content = message.result?.content;
	const text = Array.isArray(content)
		? content
				.filter(
					(item) => item?.type === "text" && typeof item.text === "string",
				)
				.map((item) => item.text)
				.join("\n")
		: "";
	if (message.result?.isError) {
		throw new Error(text || "Docs tool call failed");
	}
	return text;
}

export interface DocsFsResult {
	readonly exit: number;
	readonly stdout: string;
	readonly stderr: string;
}

/**
 * The filesystem tool wraps command output as:
 *
 *   exit: 0
 *   --- stdout ---
 *   ...
 *   --- stderr ---
 *   ...
 *
 * Either section may be absent.
 */
export function parseDocsFsOutput(text: string): DocsFsResult {
	let exit = 0;
	let rest = text;
	const exitMatch = text.match(/^exit:\s*(-?\d+)\r?\n?/);
	if (exitMatch) {
		exit = Number(exitMatch[1]);
		rest = text.slice(exitMatch[0].length);
	}

	let section: "stdout" | "stderr" | null = null;
	const out: string[] = [];
	const err: string[] = [];
	for (const line of rest.split("\n")) {
		if (line === "--- stdout ---") {
			section = "stdout";
			continue;
		}
		if (line === "--- stderr ---") {
			section = "stderr";
			continue;
		}
		if (section === "stderr") {
			err.push(line);
		} else if (section === "stdout") {
			out.push(line);
		}
	}
	if (section === null) {
		return { exit, stdout: rest, stderr: "" };
	}
	return { exit, stdout: out.join("\n"), stderr: err.join("\n") };
}

export async function runDocsFsCommand(
	command: string,
	options: DocsToolOptions = {},
): Promise<DocsFsResult> {
	const text = await callDocsTool(
		"query_docs_filesystem_phala",
		{ command },
		options,
	);
	return parseDocsFsOutput(text);
}

/** Single-quote a value for the docs virtual filesystem shell. */
export function shellQuote(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Normalize a docs page reference to a virtual filesystem path.
 * Accepts full docs.phala.com URLs, paths with or without a leading slash,
 * and strips anchors/query strings.
 */
export function normalizeDocPath(input: string): string {
	let path = input.trim();
	path = path.replace(/^https?:\/\/docs\.phala\.com/i, "");
	path = path.split("#")[0].split("?")[0];
	if (!path.startsWith("/")) {
		path = `/${path}`;
	}
	return path;
}
