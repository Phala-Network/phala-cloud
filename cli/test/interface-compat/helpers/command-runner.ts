/**
 * Helper utilities for running CLI commands in tests
 * Provides both real execution and mocked execution modes
 */

import { execaCommand, type Options as ExecaOptions } from "execa";
import path from "node:path";

const CLI_PATH = path.join(__dirname, "../../../dist/index.js");
const CLI_CMD = `bun ${CLI_PATH}`;

export interface CommandResult {
	stdout: string;
	stderr: string;
	exitCode: number;
	success: boolean;
}

export interface RunOptions {
	expectError?: boolean;
	env?: Record<string, string>;
	timeout?: number;
	stdin?: string;
}

/**
 * Run a CLI command and return the result
 * @param command - Command string (e.g., "deploy --help")
 * @param options - Execution options
 */
export async function runCommand(
	command: string,
	options: RunOptions = {},
): Promise<CommandResult> {
	const { expectError = false, env = {}, timeout = 3000, stdin } = options;

	const execOptions: ExecaOptions = {
		reject: false, // Don't throw on non-zero exit
		timeout,
		env: {
			...process.env,
			...env,
		},
		input: stdin,
	};

	const fullCommand = `${CLI_CMD} ${command}`;

	try {
		const result = await execaCommand(fullCommand, execOptions);

		return {
			stdout: result.stdout,
			stderr: result.stderr,
			exitCode: result.exitCode ?? 0,
			success: result.exitCode === 0,
		};
	} catch (error) {
		// Handle timeouts and other errors
		if (error && typeof error === "object" && "isCanceled" in error) {
			// Timeout error
			return {
				stdout: "",
				stderr: "Command timed out",
				exitCode: 124, // Standard timeout exit code
				success: false,
			};
		}

		if (expectError) {
			// For other errors when we expect failure
			return {
				stdout: "",
				stderr: error instanceof Error ? error.message : String(error),
				exitCode: 1,
				success: false,
			};
		}
		throw error;
	}
}

/**
 * Run command help and return the output
 * @param command - Command to get help for (e.g., "deploy", "cvms list")
 */
export async function getHelpText(command: string): Promise<string> {
	const result = await runCommand(`${command} --help`);
	return result.stdout;
}

/**
 * Check if a command exists by running --help
 * @param command - Command to check
 */
export async function commandExists(command: string): Promise<boolean> {
	try {
		const help = await getHelpText(command);
		return !help.toLowerCase().includes("unknown command");
	} catch {
		return false;
	}
}

/**
 * Extract flags from help text
 * @param helpText - Help text output
 */
export function extractFlags(helpText: string): string[] {
	const flagPattern = /(-[a-z]|--[a-z-]+)/gi;
	const matches = helpText.match(flagPattern);
	return matches ? [...new Set(matches)] : [];
}

/**
 * Check if help text contains a specific flag
 * @param helpText - Help text output
 * @param flag - Flag to check for (e.g., "--compose" or "-c")
 */
export function hasFlag(helpText: string, flag: string): boolean {
	return helpText.includes(flag);
}

/**
 * Parse JSON output from a command
 * @param output - Command stdout
 */
export function parseJsonOutput<T = unknown>(output: string): T {
	try {
		return JSON.parse(output);
	} catch (error) {
		throw new Error(
			`Failed to parse JSON output: ${error instanceof Error ? error.message : String(error)}\nOutput: ${output}`,
		);
	}
}
