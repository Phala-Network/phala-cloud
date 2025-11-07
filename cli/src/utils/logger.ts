import chalk from "chalk";
import ora, { type Ora } from "ora";
import { isInJsonMode } from "@/src/core/json-mode";

// Re-export setJsonMode for convenience
export { setJsonMode } from "@/src/core/json-mode";

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
};
