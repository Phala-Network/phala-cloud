import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { resolveAuthForContext } from "@/src/lib/client";
import { applyJqFilter, formatJqOutput } from "./jq-filter";
import { apiCommandMeta, apiCommandSchema, HTTP_METHODS } from "./command";
import type { ApiCommandInput } from "./command";

// Get CLI version for User-Agent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "../../../package.json");
let CLI_VERSION = "unknown";
try {
	const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
	CLI_VERSION = packageJson.version || "unknown";
} catch {
	// Ignore errors reading package.json
}

/**
 * Read content from file or stdin.
 */
function readFileContent(path: string): string {
	if (path === "-") {
		return readFileSync(0, "utf-8");
	}
	return readFileSync(path, "utf-8");
}

/**
 * Parse a string value into its appropriate JSON type
 */
function parseJsonValue(value: string): unknown {
	if (value === "true") return true;
	if (value === "false") return false;
	if (value === "null") return null;

	if (/^-?\d+$/.test(value)) {
		return Number.parseInt(value, 10);
	}
	if (/^-?\d+\.\d+$/.test(value)) {
		return Number.parseFloat(value);
	}

	if (value.startsWith("[") || value.startsWith("{")) {
		try {
			return JSON.parse(value);
		} catch {
			// Not valid JSON, return as string
		}
	}

	return value;
}

/**
 * Parse -f query params into key=value pairs.
 * Supports @file syntax: key=@file.txt reads file content as value.
 */
type QueryParamValue = string | string[];

function parseQueryParams(
	fields: string[] | undefined,
): Record<string, QueryParamValue> {
	const result: Record<string, QueryParamValue> = {};
	for (const field of fields ?? []) {
		const eqIdx = field.indexOf("=");
		if (eqIdx > 0) {
			const key = field.slice(0, eqIdx);
			const rawValue = field.slice(eqIdx + 1);
			const value = rawValue.startsWith("@")
				? readFileContent(rawValue.slice(1))
				: rawValue;
			const existing = result[key];
			if (existing === undefined) {
				result[key] = value;
			} else if (Array.isArray(existing)) {
				existing.push(value);
			} else {
				result[key] = [existing, value];
			}
		}
	}
	return result;
}

/**
 * Parse -F body fields into an object.
 * Handles both key=value (string) and key:=value (typed JSON).
 * Supports @file syntax for both forms.
 */
function parseBodyFields(
	fields: string[] | undefined,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const field of fields ?? []) {
		// Try := first (typed JSON)
		const colonEqIdx = field.indexOf(":=");
		if (colonEqIdx > 0) {
			const key = field.slice(0, colonEqIdx);
			const value = field.slice(colonEqIdx + 2);
			if (value.startsWith("@")) {
				const path = value.slice(1);
				const content = readFileContent(path);
				try {
					result[key] = JSON.parse(content);
				} catch {
					throw new Error(
						`Failed to parse JSON from file "${path}" for field "${key}"`,
					);
				}
			} else {
				result[key] = parseJsonValue(value);
			}
			continue;
		}
		// Try = (string)
		const eqIdx = field.indexOf("=");
		if (eqIdx > 0) {
			const key = field.slice(0, eqIdx);
			const value = field.slice(eqIdx + 1);
			if (value.startsWith("@")) {
				result[key] = readFileContent(value.slice(1));
			} else {
				result[key] = value;
			}
		}
	}
	return result;
}

/**
 * Parse header strings into a headers object
 */
function parseHeaders(headers: string[] | undefined): Record<string, string> {
	const result: Record<string, string> = {};
	for (const header of headers ?? []) {
		const colonIdx = header.indexOf(":");
		if (colonIdx > 0) {
			const key = header.slice(0, colonIdx).trim();
			const value = header.slice(colonIdx + 1).trim();
			result[key] = value;
		}
	}
	return result;
}

function hasHeader(
	headers: Record<string, string>,
	headerName: string,
): boolean {
	const target = headerName.toLowerCase();
	return Object.keys(headers).some((k) => k.toLowerCase() === target);
}

/**
 * Check if HTTP method typically has a request body
 */
function methodHasBody(method: string): boolean {
	return !["GET", "HEAD", "OPTIONS"].includes(method);
}

type BuiltRequestBody = {
	body: Record<string, unknown> | string | undefined;
	defaultContentType?: string;
};

/**
 * Build request body from -F, -d, and --input options.
 * These three are mutually exclusive.
 * Note: -f (query params) is handled separately in resolveRequest.
 */
export function buildApiRequestBody(input: ApiCommandInput): BuiltRequestBody {
	const hasFields = input.field && input.field.length > 0;

	if (input.input && input.data && input.data.length > 0) {
		throw new Error('"-d/--data" cannot be used with "--input"');
	}
	if (hasFields && input.data && input.data.length > 0) {
		throw new Error('"-d/--data" cannot be used with "-F/--field"');
	}
	if (hasFields && input.input) {
		throw new Error('"--input" cannot be used with "-F/--field"');
	}

	// --input takes precedence
	if (input.input) {
		const content = readFileContent(input.input);
		try {
			return { body: JSON.parse(content) };
		} catch {
			return { body: content };
		}
	}

	// -d/--data: cURL-style raw body data
	if (input.data && input.data.length > 0) {
		const combined =
			input.data.length === 1 ? input.data[0] : input.data.join("&");

		const trimmed = combined.trim();
		if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
			try {
				return { body: JSON.parse(trimmed) };
			} catch {
				// fall through to raw string
			}
		}

		return {
			body: combined,
			defaultContentType: "application/x-www-form-urlencoded",
		};
	}

	// -F body fields
	if (hasFields) {
		const bodyFields = parseBodyFields(input.field);
		if (Object.keys(bodyFields).length === 0) {
			return { body: undefined };
		}
		return { body: bodyFields };
	}

	return { body: undefined };
}

type ResolvedRequest = {
	method: string;
	endpoint: string;
	body: Record<string, unknown> | string | undefined;
};

const HTTP_METHOD_SET = new Set<string>(HTTP_METHODS);

function isHttpMethodToken(value: string): boolean {
	return HTTP_METHOD_SET.has(value.toUpperCase());
}

export function getApiMethodPositionUsageError(
	positionals: readonly string[],
	executableName = "phala",
): string | undefined {
	const [first, second] = positionals;
	if (!first || !second || !isHttpMethodToken(first)) {
		return undefined;
	}

	const method = first.toUpperCase();
	const endpoint = second.startsWith("/") ? second : `/${second}`;
	return [
		`Error: Invalid API command usage. "${first}" looks like an HTTP method, but methods must be passed with -X/--method.`,
		"",
		"Correct examples:",
		`  ${executableName} api ${endpoint}`,
		`  ${executableName} api ${endpoint} -X ${method}`,
	].join("\n");
}

/**
 * Resolve the final HTTP method, endpoint, and body for an API request.
 *
 * -f fields are always appended as query parameters.
 * -F/-d/--input are always used as request body.
 */
export function resolveRequest(
	input: ApiCommandInput,
	endpoint: string,
): ResolvedRequest {
	const { body } = buildApiRequestBody(input);

	// -f → query params (always appended to URL)
	const queryParams = parseQueryParams(input.query);
	let finalEndpoint = endpoint;
	if (Object.keys(queryParams).length > 0) {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(queryParams)) {
			for (const item of Array.isArray(value) ? value : [value]) {
				params.append(key, item);
			}
		}
		const separator = finalEndpoint.includes("?") ? "&" : "?";
		finalEndpoint = `${finalEndpoint}${separator}${params.toString()}`;
	}

	return { method: input.method, endpoint: finalEndpoint, body };
}

export async function runApiCommand(
	input: ApiCommandInput,
	context: CommandContext,
): Promise<number | undefined> {
	const usageError = getApiMethodPositionUsageError(
		context.rawPositionals,
		context.cli?.executableName,
	);
	if (usageError) {
		context.stderr.write(`${usageError}\n`);
		return 1;
	}

	const auth = resolveAuthForContext(context, { apiToken: input.apiToken });

	if (!auth.apiKey) {
		context.stderr.write(
			'Error: Not authenticated. Run "phala login" first.\n',
		);
		return 1;
	}

	// Create client with User-Agent header
	const client = createClient({
		apiKey: auth.apiKey,
		baseURL: auth.baseURL,
		headers: {
			"User-Agent": `phala-cli/${CLI_VERSION}`,
		},
	});

	const customHeaders = parseHeaders(input.header);

	// Normalize endpoint (ensure it starts with / and query params are encoded)
	const rawEndpoint = input.endpoint.startsWith("/")
		? input.endpoint
		: `/${input.endpoint}`;

	// Percent-encode query parameter values (e.g. @ → %40)
	const qIdx = rawEndpoint.indexOf("?");
	const endpoint =
		qIdx >= 0
			? `${rawEndpoint.slice(0, qIdx)}?${new URLSearchParams(rawEndpoint.slice(qIdx + 1)).toString()}`
			: rawEndpoint;

	try {
		const { defaultContentType } = buildApiRequestBody(input);

		if (defaultContentType && !hasHeader(customHeaders, "content-type")) {
			customHeaders["Content-Type"] = defaultContentType;
		}

		const resolved = resolveRequest(input, endpoint);

		if (resolved.body !== undefined && !methodHasBody(resolved.method)) {
			context.stderr.write(
				`Error: ${resolved.method} does not support a request body. Use -X POST (or PUT/PATCH) to send body data.\n`,
			);
			return 1;
		}

		// Always fetch as ArrayBuffer so binary exports (xlsx/zip/pdf) are preserved.
		// Default ofetch JSON parsing turns non-JSON bodies into empty objects ({}).
		const response = await client.requestFull<ArrayBuffer>(resolved.endpoint, {
			method: resolved.method,
			body: resolved.body,
			headers: customHeaders,
			responseType: "arrayBuffer",
		});

		// Output: status + headers (if -i/--include)
		if (input.include) {
			context.stdout.write(
				`HTTP/1.1 ${response.status} ${response.statusText}\n`,
			);
			response.headers.forEach((value, key) => {
				context.stdout.write(`${key}: ${value}\n`);
			});
			context.stdout.write("\n");
		}

		// Output: body (unless --silent)
		if (!input.silent && response.data !== undefined) {
			const contentType = (
				response.headers.get("content-type") || ""
			).toLowerCase();
			const contentDisposition = (
				response.headers.get("content-disposition") || ""
			).toLowerCase();
			const raw = Buffer.from(response.data);

			const looksJson =
				contentType.includes("application/json") ||
				contentType.includes("+json") ||
				contentType.includes("text/json");
			const looksText =
				contentType.startsWith("text/") ||
				contentType.includes("application/xml") ||
				contentType.includes("application/javascript");
			const looksBinaryAttachment =
				contentDisposition.includes("attachment") ||
				contentType.includes("application/octet-stream") ||
				contentType.includes("application/zip") ||
				contentType.includes("application/pdf") ||
				contentType.includes("application/vnd.") ||
				contentType.includes("spreadsheet") ||
				contentType.includes("application/x-");

			// Binary path: write raw bytes, no trailing newline, no jq.
			if (looksBinaryAttachment && !looksJson) {
				if (input.jq) {
					context.stderr.write(
						"Error: jq filter (-q) cannot be applied to binary responses.\n",
					);
					return 1;
				}
				context.stdout.write(raw);
				return response.ok ? 0 : 1;
			}

			const text = raw.toString("utf8");
			let output: unknown = text;
			if (looksJson || (!looksText && text.length > 0)) {
				try {
					output = JSON.parse(text);
				} catch {
					// Keep as text when body is not valid JSON.
					output = text;
				}
			}

			// Apply jq filter if provided
			if (input.jq) {
				try {
					output = applyJqFilter(output, input.jq);
				} catch (err) {
					context.stderr.write(
						`Error: jq filter failed: ${(err as Error).message}\n`,
					);
					return 1;
				}
			}

			// Format and print output
			const formatted = formatJqOutput(output);
			context.stdout.write(`${formatted}\n`);
		}

		// Return exit code based on HTTP status
		return response.ok ? 0 : 1;
	} catch (err) {
		const error = err as Error;
		context.stderr.write(`Error: ${error.message}\n`);
		return 1;
	}
}

export const apiCommand = defineCommand({
	path: ["api"],
	meta: apiCommandMeta,
	schema: apiCommandSchema,
	handler: runApiCommand,
});

export default apiCommand;
