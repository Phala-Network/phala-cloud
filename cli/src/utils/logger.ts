import chalk from "chalk";
import ora, { type Ora } from "ora";
import {
	PhalaCloudError,
	RequestError,
	ResourceError,
	type SafeResult,
} from "@phala/cloud";
import type { ZodError } from "zod";
import { isInJsonMode } from "@/src/core/json-mode";

// Re-export setJsonMode for convenience
export { setJsonMode } from "@/src/core/json-mode";

export interface CliErrorRequest {
	readonly method?: string;
	readonly url: string;
}

export interface CliErrorLink {
	readonly label: string;
	readonly url: string;
}

export interface CliErrorEnvelope {
	readonly message: string;
	readonly errorCode?: string;
	readonly requestId?: string;
	readonly httpStatus?: number;
	readonly statusText?: string;
	readonly request?: CliErrorRequest;
	readonly details?: unknown;
	readonly suggestions?: readonly string[];
	readonly links?: readonly CliErrorLink[];
	readonly response?: unknown;
	readonly stack?: string;
}

export interface CliErrorPresentationOptions {
	readonly operation?: string;
	readonly debug?: boolean;
	/** Human-mode only guidance appended after the normalized fields. */
	readonly guidance?: string;
}

export type HumanErrorRenderOptions = CliErrorPresentationOptions;
export type JsonErrorRenderOptions = Pick<
	CliErrorPresentationOptions,
	"operation" | "debug"
>;

export interface JsonCliError {
	readonly success: false;
	readonly error: string;
	readonly operation?: string;
	readonly error_code?: string;
	readonly request_id?: string;
	readonly http_status?: number;
	readonly status_text?: string;
	readonly request?: CliErrorRequest;
	readonly details?: unknown;
	readonly suggestions?: readonly string[];
	readonly links?: readonly CliErrorLink[];
	readonly response?: unknown;
	readonly stack?: string;
}

interface ResultErrorLike {
	readonly message?: unknown;
	readonly cause?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object";
}

function isResultErrorLike(value: unknown): value is ResultErrorLike {
	return isRecord(value) && "cause" in value;
}

function asNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): readonly string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const items = value.filter((item): item is string => typeof item === "string");
	return items.length > 0 ? items : undefined;
}

function asCliErrorLinks(value: unknown): readonly CliErrorLink[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const links: CliErrorLink[] = [];
	for (const item of value) {
		if (!isRecord(item)) continue;
		const label = asNonEmptyString(item.label);
		const url = asNonEmptyString(item.url);
		if (label && url) {
			links.push({ label, url });
		}
	}
	return links.length > 0 ? links : undefined;
}

function formatRequestUrl(request: unknown): string | undefined {
	if (typeof request === "string") {
		const trimmed = request.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}
	if (request instanceof URL) {
		return request.toString();
	}
	if (typeof Request !== "undefined" && request instanceof Request) {
		return request.url;
	}
	if (isRecord(request)) {
		const url = asNonEmptyString(request.url);
		if (url) return url;
		const href = asNonEmptyString(request.href);
		if (href) return href;
	}
	return undefined;
}

function formatRequestMethod(
	request: unknown,
	requestMethod: unknown,
): string | undefined {
	const explicit = asNonEmptyString(requestMethod)?.toUpperCase();
	if (explicit) return explicit;
	if (typeof Request !== "undefined" && request instanceof Request) {
		const method = asNonEmptyString(request.method)?.toUpperCase();
		if (method) return method;
	}
	if (isRecord(request)) {
		const method = asNonEmptyString(request.method)?.toUpperCase();
		if (method) return method;
	}
	return undefined;
}

function buildRequest(
	request: unknown,
	requestMethod: unknown,
): CliErrorRequest | undefined {
	const url = formatRequestUrl(request);
	if (!url) return undefined;
	const method = formatRequestMethod(request, requestMethod);
	return method ? { method, url } : { url };
}

function extractStructuredFields(source: unknown): {
	message?: string;
	errorCode?: string;
	requestId?: string;
	details?: unknown;
	suggestions?: readonly string[];
	links?: readonly CliErrorLink[];
} {
	if (!isRecord(source)) return {};

	const errorCodeRaw = asNonEmptyString(source.error_code);
	const errorCode =
		errorCodeRaw && !/^\d+$/.test(errorCodeRaw) ? errorCodeRaw : undefined;

	return {
		message: asNonEmptyString(source.message) ?? asNonEmptyString(source.error),
		errorCode,
		requestId: asNonEmptyString(source.request_id),
		details: source.details,
		suggestions: asStringArray(source.suggestions),
		links: asCliErrorLinks(source.links),
	};
}

function extractMessageFromDetail(detail: unknown): string | undefined {
	if (typeof detail === "string") {
		return asNonEmptyString(detail);
	}
	if (isRecord(detail)) {
		return (
			asNonEmptyString(detail.message) ?? asNonEmptyString(detail.error)
		);
	}
	return undefined;
}

function semanticErrorCode(code: unknown): string | undefined {
	const value = asNonEmptyString(code);
	if (!value) return undefined;
	if (/^\d+$/.test(value)) return undefined;
	return value;
}

function normalizeSdkError(
	error: PhalaCloudError,
	fallbackMessage?: string,
): CliErrorEnvelope {
	const dataFields = extractStructuredFields(error.data);
	const detailFields = extractStructuredFields(error.detail);
	const resource =
		error instanceof ResourceError
			? {
					errorCode: error.errorCode,
					details: error.structuredDetails,
					suggestions: error.suggestions,
					links: error.links?.map((link) => ({
						label: link.label,
						url: link.url,
					})),
				}
			: undefined;

	const message =
		asNonEmptyString(resource ? error.message : undefined) ??
		dataFields.message ??
		detailFields.message ??
		extractMessageFromDetail(error.detail) ??
		asNonEmptyString(error.message) ??
		fallbackMessage ??
		"Unknown error";

	const errorCode =
		resource?.errorCode ??
		dataFields.errorCode ??
		detailFields.errorCode ??
		semanticErrorCode((error as { code?: unknown }).code);

	const requestId =
		asNonEmptyString(error.requestId) ??
		dataFields.requestId ??
		detailFields.requestId;

	const httpStatus =
		typeof error.status === "number" && error.status > 0
			? error.status
			: undefined;
	const statusText =
		httpStatus !== undefined
			? asNonEmptyString(error.statusText)
			: undefined;

	const details =
		resource?.details ?? dataFields.details ?? detailFields.details;
	const suggestions =
		resource?.suggestions ??
		dataFields.suggestions ??
		detailFields.suggestions;
	const links = resource?.links ?? dataFields.links ?? detailFields.links;

	const response = error.data !== undefined ? error.data : undefined;
	const request = buildRequest(error.request, error.requestMethod);

	return {
		message,
		...(errorCode ? { errorCode } : {}),
		...(requestId ? { requestId } : {}),
		...(httpStatus !== undefined ? { httpStatus } : {}),
		...(statusText ? { statusText } : {}),
		...(request ? { request } : {}),
		...(details !== undefined ? { details } : {}),
		...(suggestions ? { suggestions } : {}),
		...(links ? { links } : {}),
		...(response !== undefined ? { response } : {}),
		...(error.stack ? { stack: error.stack } : {}),
	};
}

/**
 * Normalize any thrown/returned CLI or SDK failure into a shared envelope.
 */
export function normalizeCliError(error: unknown): CliErrorEnvelope {
	if (isResultErrorLike(error) && error.cause !== undefined) {
		const nested = normalizeCliError(error.cause);
		const outerMessage = asNonEmptyString(error.message);
		if (nested.message && nested.message !== "Unknown error") {
			return nested;
		}
		if (outerMessage) {
			return { ...nested, message: outerMessage };
		}
		return nested;
	}

	if (error instanceof ResourceError || error instanceof RequestError) {
		return normalizeSdkError(error);
	}

	if (error instanceof PhalaCloudError) {
		return normalizeSdkError(error);
	}

	if (error instanceof Error) {
		return {
			message: asNonEmptyString(error.message) ?? "Unknown error",
			...(error.stack ? { stack: error.stack } : {}),
		};
	}

	const text = String(error || "Unknown error");
	return { message: text.length > 0 ? text : "Unknown error" };
}

function formatDetailLines(details: unknown): string[] {
	if (!Array.isArray(details)) {
		if (details === undefined || details === null) return [];
		return [`  - ${typeof details === "string" ? details : JSON.stringify(details)}`];
	}

	const lines: string[] = [];
	for (const item of details) {
		if (typeof item === "string") {
			lines.push(`  - ${item}`);
			continue;
		}
		if (!isRecord(item)) {
			lines.push(`  - ${String(item)}`);
			continue;
		}
		const message = asNonEmptyString(item.message);
		if (message) {
			lines.push(`  - ${message}`);
			continue;
		}
		const field = asNonEmptyString(item.field);
		if (field && item.value !== undefined) {
			const value =
				typeof item.value === "string" ||
				typeof item.value === "number" ||
				typeof item.value === "boolean"
					? String(item.value)
					: JSON.stringify(item.value);
			lines.push(`  - ${field}: ${value}`);
			continue;
		}
		lines.push(`  - ${JSON.stringify(item)}`);
	}
	return lines;
}

/**
 * Render one human-readable failure block for stderr.
 */
export function renderHumanCliError(
	envelope: CliErrorEnvelope,
	options: HumanErrorRenderOptions = {},
): string {
	const lines: string[] = [];
	const operation = asNonEmptyString(options.operation);

	if (operation) {
		lines.push(`${operation} failed.`);
	}

	if (envelope.errorCode) {
		lines.push(`Error [${envelope.errorCode}]: ${envelope.message}`);
	} else {
		lines.push(`Message: ${envelope.message}`);
	}

	if (envelope.request) {
		const method = envelope.request.method
			? `${envelope.request.method} `
			: "";
		lines.push(`Request: ${method}${envelope.request.url}`);
	}

	if (envelope.httpStatus !== undefined) {
		const statusText = envelope.statusText ? ` ${envelope.statusText}` : "";
		lines.push(`HTTP: ${envelope.httpStatus}${statusText}`);
	}

	if (envelope.requestId) {
		lines.push(`Request ID: ${envelope.requestId}`);
	}

	const detailLines = formatDetailLines(envelope.details);
	if (detailLines.length > 0) {
		lines.push("");
		lines.push("Details:");
		lines.push(...detailLines);
	}

	if (envelope.suggestions && envelope.suggestions.length > 0) {
		lines.push("");
		lines.push("Suggestions:");
		for (const suggestion of envelope.suggestions) {
			lines.push(`  - ${suggestion}`);
		}
	}

	if (envelope.links && envelope.links.length > 0) {
		lines.push("");
		lines.push("Learn more:");
		for (const link of envelope.links) {
			lines.push(`  - ${link.label}: ${link.url}`);
		}
	}

	const guidance = asNonEmptyString(options.guidance);
	if (guidance) {
		lines.push("");
		lines.push(guidance);
	}

	if (options.debug) {
		if (envelope.response !== undefined) {
			lines.push("");
			lines.push("Response:");
			lines.push(JSON.stringify(envelope.response, null, 2));
		}
		if (envelope.stack) {
			lines.push("");
			lines.push("Stack:");
			lines.push(envelope.stack);
		}
	}

	return `${lines.join("\n")}\n`;
}

/**
 * Build one JSON failure envelope for stdout.
 */
export function buildJsonCliError(
	envelope: CliErrorEnvelope,
	options: JsonErrorRenderOptions = {},
): JsonCliError {
	const operation = asNonEmptyString(options.operation);

	return {
		success: false,
		error: envelope.message,
		...(operation ? { operation } : {}),
		...(envelope.errorCode ? { error_code: envelope.errorCode } : {}),
		...(envelope.requestId ? { request_id: envelope.requestId } : {}),
		...(envelope.httpStatus !== undefined
			? { http_status: envelope.httpStatus }
			: {}),
		...(envelope.statusText ? { status_text: envelope.statusText } : {}),
		...(envelope.request ? { request: envelope.request } : {}),
		...(envelope.details !== undefined ? { details: envelope.details } : {}),
		...(envelope.suggestions ? { suggestions: envelope.suggestions } : {}),
		...(envelope.links ? { links: envelope.links } : {}),
		...(envelope.response !== undefined ? { response: envelope.response } : {}),
		...(options.debug && envelope.stack ? { stack: envelope.stack } : {}),
	};
}

/**
 * Wraps text at the specified width by splitting on spaces.
 * If a word is longer than maxWidth, it's kept on its own line.
 */
function wrapText(text: string, maxWidth: number): string[] {
	const words = text.split(/\s+/);
	const lines: string[] = [];
	let currentLine = "";

	for (const word of words) {
		const testLine = currentLine.length === 0 ? word : `${currentLine} ${word}`;

		if (testLine.length <= maxWidth) {
			currentLine = testLine;
		} else {
			if (currentLine.length > 0) {
				lines.push(currentLine);
			}
			currentLine = word;
		}
	}

	if (currentLine.length > 0) {
		lines.push(currentLine);
	}

	return lines;
}

/**
 * Splits a string into chunks of size maxChunkSize or less.
 * If the string is shorter than maxChunkSize, it's returned as-is.
 */
function splitIntoChunks(text: string, maxChunkSize: number): string[] {
	if (text.length <= maxChunkSize) {
		return [text];
	}

	const chunks: string[] = [];
	let start = 0;

	while (start < text.length) {
		chunks.push(text.slice(start, start + maxChunkSize));
		start += maxChunkSize;
	}

	return chunks;
}

/**
 * Wraps text lines at the specified width by splitting on word boundaries.
 * Lines that are already split by newline characters are preserved.
 */
export function wrapLines(text: string, maxWidth: number): string[] {
	const lines: string[] = [];

	for (const line of text.split("\n")) {
		// If the line is short enough, keep it as is
		if (line.length <= maxWidth) {
			lines.push(line);
			continue;
		}

		// If the line contains no spaces (e.g., a long URL or identifier),
		// split it into chunks
		if (line.indexOf(" ") === -1) {
			lines.push(...splitIntoChunks(line, maxWidth));
			continue;
		}

		// Otherwise, wrap the line by word boundaries
		const wrappedLines = wrapText(line, maxWidth);
		lines.push(...wrappedLines);
	}

	// Handle edge case of empty input
	if (lines.length === 0) {
		const currentLine = text.trim();
		lines.push(currentLine);
	}

	return lines;
}

export const logger = {
	error: (message: string, ...args: unknown[]) => {
		if (isInJsonMode()) return;
		process.stderr.write(`${chalk.red("✗")} ${chalk.red(message)}`);
		if (args.length > 0) {
			process.stderr.write(` ${args.map(String).join(" ")}`);
		}
		process.stderr.write("\n");
	},
	warn: (message: string, ...args: unknown[]) => {
		if (isInJsonMode()) return;
		process.stderr.write(`${chalk.yellow("⚠")} ${chalk.yellow(message)}`);
		if (args.length > 0) {
			process.stderr.write(` ${args.map(String).join(" ")}`);
		}
		process.stderr.write("\n");
	},
	info: (message: string, ...args: unknown[]) => {
		if (isInJsonMode()) return;
		process.stderr.write(`${chalk.blue("ℹ")} ${chalk.blue(message)}`);
		if (args.length > 0) {
			process.stderr.write(` ${args.map(String).join(" ")}`);
		}
		process.stderr.write("\n");
	},
	success: (message: string, ...args: unknown[]) => {
		if (isInJsonMode()) return;
		process.stderr.write(`${chalk.green("✓")} ${chalk.green(message)}`);
		if (args.length > 0) {
			process.stderr.write(` ${args.map(String).join(" ")}`);
		}
		process.stderr.write("\n");
	},
	debug: (message: string, ...args: unknown[]) => {
		if (isInJsonMode()) return;
		if (process.env.DEBUG) {
			process.stderr.write(`${chalk.gray("🔍")} ${chalk.gray(message)}`);
			if (args.length > 0) {
				process.stderr.write(` ${args.map(String).join(" ")}`);
			}
			process.stderr.write("\n");
		}
	},
	table: <T>(
		data: T[],
		columns?:
			| Array<string>
			| Array<{ key: keyof T | string; header?: string }>
			| Array<{ key: string; header?: string }>,
	) => {
		if (isInJsonMode()) return;
		if (data.length === 0) {
			console.log(chalk.yellow("No data to display"));
			return;
		}

		// Support for old API with just column names
		if (columns) {
			let columnConfigs: Array<{ key: keyof T | string; header?: string }>;
			if (typeof columns[0] === "string") {
				// Convert simple string array to column config
				columnConfigs = (columns as string[]).map((col) => ({
					key: col,
					header: col,
				}));
			} else {
				// Now columns is an array of objects with key and optional header
				columnConfigs = columns as Array<{
					key: keyof T | string;
					header?: string;
				}>;
			}

			// Calculate column widths
			const columnWidths: { [key: string]: number } = {};
			for (const col of columnConfigs) {
				const header = col.header || String(col.key);
				columnWidths[String(col.key)] = header.length;
			}

			// Find max width for each column
			for (const row of data) {
				for (const col of columnConfigs) {
					const value = String(
						typeof col.key === "string" && !(col.key in (row as object))
							? ""
							: ((row as Record<string, unknown>)[String(col.key)] ?? ""),
					);
					columnWidths[String(col.key)] = Math.max(
						columnWidths[String(col.key)],
						value.length,
					);
				}
			}

			// Print header
			const headerParts: string[] = [];
			for (const col of columnConfigs) {
				const header = col.header || String(col.key);
				headerParts.push(
					chalk.bold(header.padEnd(columnWidths[String(col.key)])),
				);
			}
			console.log(headerParts.join("  "));

			// Print separator
			const separatorParts: string[] = [];
			for (const col of columnConfigs) {
				separatorParts.push("-".repeat(columnWidths[String(col.key)]));
			}
			console.log(separatorParts.join("  "));

			// Print rows
			for (const row of data) {
				const rowParts: string[] = [];
				for (const col of columnConfigs) {
					const value = String(
						typeof col.key === "string" && !(col.key in (row as object))
							? ""
							: ((row as Record<string, unknown>)[String(col.key)] ?? ""),
					);
					rowParts.push(value.padEnd(columnWidths[String(col.key)]));
				}
				console.log(rowParts.join("  "));
			}
		} else {
			// Default: use all keys from first object
			const firstRow = data[0] as Record<string, unknown>;
			const keys = Object.keys(firstRow);

			// Calculate column widths
			const columnWidths: { [key: string]: number } = {};
			for (const key of keys) {
				columnWidths[key] = key.length;
			}

			// Find max width for each column
			for (const row of data) {
				for (const key of keys) {
					const value = String((row as Record<string, unknown>)[key] ?? "");
					columnWidths[key] = Math.max(columnWidths[key], value.length);
				}
			}

			// Print header
			const headerParts: string[] = [];
			for (const key of keys) {
				headerParts.push(chalk.bold(key.padEnd(columnWidths[key])));
			}
			console.log(headerParts.join("  "));

			// Print separator
			const separatorParts: string[] = [];
			for (const key of keys) {
				separatorParts.push("-".repeat(columnWidths[key]));
			}
			console.log(separatorParts.join("  "));

			// Print rows
			for (const row of data) {
				const rowParts: string[] = [];
				for (const key of keys) {
					const value = String((row as Record<string, unknown>)[key] ?? "");
					rowParts.push(value.padEnd(columnWidths[key]));
				}
				console.log(rowParts.join("  "));
			}
		}
	},
	keyValueTable: (
		data: Record<string, string | number | boolean | null | undefined>,
		options?: {
			borderStyle?: "single" | "double" | "rounded" | "bold" | "none";
			keyColor?: typeof chalk.blue;
			valueColor?: typeof chalk.white;
			maxWidth?: number;
		},
	) => {
		if (isInJsonMode()) return;
		const {
			borderStyle = "single",
			keyColor = chalk.blue,
			valueColor = chalk.white,
			maxWidth = process.stdout.columns || 80,
		} = options || {};

		// Border characters
		const borders = {
			single: {
				topLeft: "┌",
				topRight: "┐",
				bottomLeft: "└",
				bottomRight: "┘",
				horizontal: "─",
				vertical: "│",
				cross: "┼",
				leftT: "├",
				rightT: "┤",
			},
			double: {
				topLeft: "╔",
				topRight: "╗",
				bottomLeft: "╚",
				bottomRight: "╝",
				horizontal: "═",
				vertical: "║",
				cross: "╬",
				leftT: "╠",
				rightT: "╣",
			},
			rounded: {
				topLeft: "╭",
				topRight: "╮",
				bottomLeft: "╰",
				bottomRight: "╯",
				horizontal: "─",
				vertical: "│",
				cross: "┼",
				leftT: "├",
				rightT: "┤",
			},
			bold: {
				topLeft: "┏",
				topRight: "┓",
				bottomLeft: "┗",
				bottomRight: "┛",
				horizontal: "━",
				vertical: "┃",
				cross: "╋",
				leftT: "┣",
				rightT: "┫",
			},
			none: {
				topLeft: "",
				topRight: "",
				bottomLeft: "",
				bottomRight: "",
				horizontal: "",
				vertical: "",
				cross: "",
				leftT: "",
				rightT: "",
			},
		};

		const border = borders[borderStyle];

		// Calculate column widths
		let maxKeyLength = 0;
		let maxValueLength = 0;

		for (const [key, value] of Object.entries(data)) {
			maxKeyLength = Math.max(maxKeyLength, key.length);
			const valueStr = String(value ?? "");
			maxValueLength = Math.max(maxValueLength, valueStr.length);
		}

		// Calculate total width available for content
		const padding = 4; // 2 spaces on each side of the separator
		const separatorWidth = 1; // " │ "
		const totalContentWidth = maxWidth - padding - separatorWidth;

		// If we need to wrap, reduce max lengths proportionally
		if (maxKeyLength + maxValueLength > totalContentWidth) {
			const ratio = maxKeyLength / (maxKeyLength + maxValueLength);
			maxKeyLength = Math.floor(totalContentWidth * ratio);
			maxValueLength = totalContentWidth - maxKeyLength;
		}

		const totalWidth = maxKeyLength + maxValueLength + padding + separatorWidth;

		// Print top border
		if (borderStyle !== "none") {
			console.log(
				border.topLeft +
					border.horizontal.repeat(totalWidth - 2) +
					border.topRight,
			);
		}

		// Print rows
		for (const [key, value] of Object.entries(data)) {
			const keyStr = key;
			const valueStr = String(value ?? "");

			// Wrap key and value if needed
			const keyLines = wrapLines(keyStr, maxKeyLength);
			const valueLines = wrapLines(valueStr, maxValueLength);

			// Ensure both have same number of lines
			const maxLines = Math.max(keyLines.length, valueLines.length);
			while (keyLines.length < maxLines) keyLines.push("");
			while (valueLines.length < maxLines) valueLines.push("");

			// Print each line
			for (let i = 0; i < maxLines; i++) {
				const keyPart = keyLines[i].padEnd(maxKeyLength);
				const valuePart = valueLines[i].padEnd(maxValueLength);

				if (borderStyle !== "none") {
					console.log(
						`${border.vertical} ${keyColor(keyPart)} ${border.vertical} ${valueColor(valuePart)} ${border.vertical}`,
					);
				} else {
					console.log(`${keyColor(keyPart)} : ${valueColor(valuePart)}`);
				}
			}
		}

		// Print bottom border
		if (borderStyle !== "none") {
			console.log(
				border.bottomLeft +
					border.horizontal.repeat(totalWidth - 2) +
					border.bottomRight,
			);
		}
	},
	/**
	 * Prints a line break (empty line)
	 */
	break: () => {
		if (isInJsonMode()) return;
		process.stderr.write("\n");
	},
	/**
	 * Starts a spinner with the given message.
	 * In JSON mode, returns a dummy spinner that does nothing.
	 */
	startSpinner: (message: string) => {
		if (isInJsonMode()) {
			// Return dummy spinner in JSON mode
			return {
				stop: () => {
					// no-op
				},
			};
		}
		const spinner = ora(message).start();
		return {
			stop: (success = true, text?: string) => {
				if (text) {
					spinner.text = text;
				}
				if (success) {
					spinner.succeed();
				} else {
					spinner.fail();
				}
			},
		};
	},

	/**
	 * Logs detailed error information from any error type.
	 * Handles SafeResult errors, RequestError, ZodError, and regular errors.
	 * Automatically exposes HTTP status codes and response bodies when available.
	 * Automatically suppressed in JSON mode.
	 *
	 * @param error - Error from SafeResult, RequestError, or any other error
	 * @param context - Optional context string to help identify where the error occurred
	 */
	logDetailedError(
		error: SafeResult<never>["error"] | unknown,
		context?: string,
	): void {
		// In JSON mode, suppress detailed error logging (final output handles errors)
		if (isInJsonMode()) return;

		const prefix = context ? `[${context}] ` : "";

		const formatRequest = (
			request: unknown,
			requestMethod: unknown,
		): string | undefined => {
			let target: string | undefined;
			let method =
				typeof requestMethod === "string" ? requestMethod : undefined;
			if (typeof request === "string") target = request;
			if (request instanceof URL) target = request.toString();
			if (typeof Request !== "undefined" && request instanceof Request) {
				target = request.url;
				method ??= request.method;
			}
			if (!target) return undefined;
			const normalizedMethod = method?.trim().toUpperCase();
			return normalizedMethod ? `${normalizedMethod} ${target}` : target;
		};

		// SDK errors (RequestError and its PhalaCloudError subclasses share
		// `status` / `statusText` / `detail` / `data` / `requestId` fields).
		const isSdkError = (
			err: unknown,
		): err is {
			status?: number;
			statusText?: string;
			data?: unknown;
			detail?: unknown;
			request?: unknown;
			requestMethod?: unknown;
			requestId?: string;
		} => {
			return (
				err !== null &&
				typeof err === "object" &&
				("status" in err || "detail" in err || "requestId" in err)
			);
		};

		// Type guard for validation errors
		const isValidationError = (err: unknown): err is ZodError => {
			return (
				err !== null &&
				typeof err === "object" &&
				"issues" in err &&
				Array.isArray((err as { issues: unknown }).issues)
			);
		};

		// Validation errors: surface the structured issues.
		if (isValidationError(error)) {
			process.stderr.write(
				`${prefix}Validation error: ${JSON.stringify(error.issues)}\n`,
			);
			return;
		}

		// SDK errors: print only the supplementary info that complements
		// whatever message the caller already showed (typically via context.fail).
		// Avoids duplicating the primary error line.
		if (isSdkError(error)) {
			const lines: string[] = [];
			const request = formatRequest(error.request, error.requestMethod);
			if (request) {
				lines.push(`${prefix}Request: ${request}`);
			}
			if (typeof error.status === "number" && error.status > 0) {
				const statusText = error.statusText ?? "";
				lines.push(
					`${prefix}HTTP ${error.status}${statusText ? ` ${statusText}` : ""}`,
				);
			}
			if (typeof error.requestId === "string" && error.requestId.length > 0) {
				lines.push(`${prefix}Request ID: ${error.requestId}`);
			}
			if (error.data !== undefined && error.data !== null) {
				lines.push(JSON.stringify(error.data, null, 2));
			}
			if (lines.length > 0) {
				process.stderr.write(`${lines.join("\n")}\n`);
			}
			return;
		}

		// Regular error: only print if it adds something beyond the caller's message.
		if (error instanceof Error) {
			process.stderr.write(`${prefix}${error.message}\n`);
		} else {
			process.stderr.write(`${prefix}${String(error)}\n`);
		}
	},
};
