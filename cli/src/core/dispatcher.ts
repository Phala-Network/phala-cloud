import { ZodError } from "zod";
import chalk from "chalk";
import type { CvmIdInput } from "@phala/cloud";
import { buildCommandSchemaInput } from "./input-builder";
import { parseCommandArguments } from "./parser";
import type { CommandRegistry } from "./registry";
import { formatCommandHelp, formatGlobalHelp, formatGroupHelp } from "./help";
import type { CommandContext, CommandDefinition } from "./types";
import { isInJsonMode } from "./json-mode";
import { getProjectConfig } from "@/src/utils/project-config";
import { selectCvm } from "@/src/api/cvms";
import { checkForUpdates, getCachedUpdateNotice } from "./update-check";

export interface DispatchOptions {
	readonly registry: CommandRegistry;
	readonly argv: readonly string[];
	readonly executableName: string;
	readonly version: string;
	readonly packageName: string;
	readonly packageVersion: string;
	readonly runtime: "node" | "bun";
	readonly cwd: string;
	readonly env: NodeJS.ProcessEnv;
	readonly stdout: NodeJS.WriteStream;
	readonly stderr: NodeJS.WriteStream;
	readonly stdin: NodeJS.ReadStream;
}

export async function dispatchCommand(
	options: DispatchOptions,
): Promise<number> {
	const {
		registry,
		argv,
		executableName,
		version,
		packageName,
		packageVersion,
		runtime,
		stdout,
		stderr,
		stdin,
		env,
		cwd,
	} = options;

	const commandSegments = collectCommandSegments(argv);

	// Check if it's a group without subcommand first
	const groupNode =
		commandSegments.length > 0 ? registry.getNode(commandSegments) : null;

	if (groupNode?.group) {
		// Check if user wants help or provided no additional args after group name
		const remainingArgv = argv.slice(commandSegments.length);
		const parsed = parseCommandArguments(remainingArgv, undefined);

		if (parsed.flags["--help"] || parsed.positionals.length === 0) {
			return handleGroupRequest({
				registry,
				argv,
				executableName,
				version,
				packageName,
				packageVersion,
				runtime,
				env,
				stdout,
				stderr,
				groupPath: commandSegments,
			});
		}
	}

	const resolved = registry.resolveCommand(commandSegments);

	if (!resolved) {
		// Check if the first segment is a group but subsequent segments don't match
		if (commandSegments.length > 1) {
			const firstSegmentNode = registry.getNode([commandSegments[0]]);
			if (firstSegmentNode?.group) {
				// This is a group with unknown subcommand
				return handleGroupRequest({
					registry,
					argv,
					executableName,
					version,
					packageName,
					packageVersion,
					runtime,
					env,
					stdout,
					stderr,
					groupPath: [commandSegments[0]],
				});
			}
		}

		return handleGlobalRequest({
			registry,
			argv,
			executableName,
			version,
			packageName,
			packageVersion,
			runtime,
			env,
			stdout,
			stderr,
		});
	}

	const { definition, consumed } = resolved;
	const commandArgv = argv.slice(consumed.length);

	try {
		const parsedArguments = parseCommandArguments(
			commandArgv,
			definition.meta.options,
		);

		if (parsedArguments.flags["--version"]) {
			stdout.write(`${version}\n`);
			return 0;
		}

		if (parsedArguments.flags["--help"]) {
			stdout.write(
				`${formatCommandHelp({ executableName, definition, registry })}\n`,
			);
			return 0;
		}

		const shouldRunUpdateCheck = !(
			definition.path[0] === "self" && definition.path[1] === "update"
		);
		const updateNoticePromise = shouldRunUpdateCheck
			? checkForUpdates({
					executableName,
					packageName,
					currentVersion: packageVersion,
					runtime,
					env,
					isJson: parsedArguments.flags["--json"] === true,
					stderrIsTTY: stderr.isTTY === true,
				})
			: Promise.resolve(null);

		if (definition.meta.stability === "deprecated") {
			stderr.write(
				chalk.yellow(
					"Warning: This command is deprecated and may be removed in a future version.\n",
				),
			);
		}

		const schemaInput = buildCommandSchemaInput(
			definition.meta,
			parsedArguments,
		);

		const mergedInput = {
			...schemaInput.options,
			...schemaInput.positionals,
			options: schemaInput.options,
			positionals: schemaInput.positionals,
			raw: schemaInput.raw,
		};

		// Parse CVM ID with priority: interactive > --cvm-id > phala.toml
		let cvmId: CvmIdInput | undefined;

		// Always check for cvmId, even if not explicitly in mergedInput
		const rawCvmId = "cvmId" in mergedInput ? mergedInput.cvmId : undefined;
		const isInteractive =
			"interactive" in mergedInput && mergedInput.interactive === true;

		// DEBUG
		if (parsedArguments.flags["--debug"]) {
			console.log(
				"[DISPATCHER DEBUG] 'cvmId' in mergedInput:",
				"cvmId" in mergedInput,
			);
			console.log("[DISPATCHER DEBUG] rawCvmId:", rawCvmId);
			console.log(
				"[DISPATCHER DEBUG] mergedInput keys:",
				Object.keys(mergedInput),
			);
		}

		// Priority 1: Interactive mode (if enabled)
		if (isInteractive) {
			const selected = await selectCvm();
			if (selected) {
				cvmId = { app_id: selected };
			}
		}

		// Priority 2: User-specified --cvm-id (if not in interactive or no selection)
		if (!cvmId && rawCvmId && typeof rawCvmId === "string") {
			cvmId = { id: rawCvmId };
		}

		// Priority 3: phala.toml configuration (if nothing specified above)
		if (!cvmId) {
			const projectCvmId = getProjectConfig().cvm_id;
			if (projectCvmId) {
				cvmId = { id: projectCvmId };
			}
		}

		// DEBUG
		if (parsedArguments.flags["--debug"]) {
			console.log("[DISPATCHER DEBUG] final cvmId:", JSON.stringify(cvmId));
			console.log("[DISPATCHER DEBUG] cvmId type:", typeof cvmId);
			console.log(
				"[DISPATCHER DEBUG] cvmId is undefined:",
				cvmId === undefined,
			);
		}

		const context: CommandContext = {
			argv: commandArgv,
			rawFlags: parsedArguments.flags,
			rawPositionals: parsedArguments.positionals,
			cwd,
			env,
			stdout,
			stderr,
			stdin,
			projectConfig: getProjectConfig(),
			cvmId,
			cli: {
				executableName,
				packageName,
				packageVersion,
				runtime,
			},

			success(data: unknown): void {
				if (isInJsonMode()) {
					const output =
						typeof data === "string"
							? { success: true, message: data }
							: {
									success: true,
									...(typeof data === "object" && data !== null
										? data
										: { data }),
								};
					stdout.write(`${JSON.stringify(output, null, 2)}\n`);
				} else {
					// Human-readable to stdout
					if (typeof data === "string") {
						stdout.write(`${chalk.green("✓")} ${chalk.green(data)}\n`);
					} else {
						stdout.write(`${chalk.green("✓")} Success\n`);
						stdout.write(`${JSON.stringify(data, null, 2)}\n`);
					}
				}
			},

			fail(message: string, details?: unknown): void {
				if (isInJsonMode()) {
					stdout.write(
						`${JSON.stringify(
							{
								success: false,
								error: message,
								...(details && { details }),
							},
							null,
							2,
						)}\n`,
					);
				} else {
					// Human-readable to stderr
					stderr.write(`${chalk.red("✗")} ${chalk.red(message)}\n`);
					if (details) {
						stderr.write(`${JSON.stringify(details, null, 2)}\n`);
					}
				}
			},
		};

		// DEBUG: Check context.cvmId right after creation
		if (parsedArguments.flags["--debug"]) {
			console.log(
				"[DISPATCHER DEBUG] context.cvmId after creation:",
				JSON.stringify(context.cvmId),
			);
		}

		const parsedInput = definition.schema.parse(mergedInput);

		// DEBUG: Check context.cvmId before calling handler
		if (parsedArguments.flags["--debug"]) {
			console.log(
				"[DISPATCHER DEBUG] context.cvmId before handler:",
				JSON.stringify(context.cvmId),
			);
		}

		const result = await definition.run(parsedInput, context);
		const updateNotice = await updateNoticePromise;
		if (typeof result === "number") {
			if (result === 0 && updateNotice && !isInJsonMode()) {
				stderr.write(updateNotice.message);
			}
			return result;
		}
		if (updateNotice && !isInJsonMode()) {
			stderr.write(updateNotice.message);
		}
		return 0;
	} catch (error) {
		if (error instanceof ZodError) {
			stderr.write(formatValidationError(error));
			return 1;
		}
		if (isArgError(error)) {
			stderr.write(`${error.message}\n`);
			return 1;
		}
		throw error;
	}
}

interface GlobalRequestOptions {
	readonly registry: CommandRegistry;
	readonly argv: readonly string[];
	readonly executableName: string;
	readonly version: string;
	readonly packageName: string;
	readonly packageVersion: string;
	readonly runtime: "node" | "bun";
	readonly env: NodeJS.ProcessEnv;
	readonly stdout: NodeJS.WriteStream;
	readonly stderr: NodeJS.WriteStream;
}

function handleGlobalRequest(options: GlobalRequestOptions): number {
	const {
		registry,
		argv,
		executableName,
		version,
		packageName,
		packageVersion,
		runtime,
		env,
		stdout,
		stderr,
	} = options;

	try {
		const parsed = parseCommandArguments(argv, undefined);

		if (parsed.flags["--version"]) {
			stdout.write(`${version}\n`);
			return 0;
		}

		if (parsed.flags["--help"]) {
			stdout.write(`${formatGlobalHelp({ registry, executableName })}\n`);
			return 0;
		}

		if (parsed.positionals.length === 0) {
			// Show help directly instead of error message
			stdout.write(`${formatGlobalHelp({ registry, executableName })}\n`);
			const cachedNotice = getCachedUpdateNotice({
				executableName,
				packageName,
				currentVersion: packageVersion,
				runtime,
				env,
				isJson: false,
				stderrIsTTY: stderr.isTTY === true,
			});
			if (cachedNotice) {
				stderr.write(cachedNotice.message);
			}
			return 0;
		}

		const unknown = parsed.positionals.join(" ");
		stderr.write(
			`Unknown command \"${unknown}\". Run \`${executableName} --help\` for a list of commands.\n`,
		);
		return 1;
	} catch (error) {
		if (isArgError(error)) {
			stderr.write(`${error.message}\n`);
			return 1;
		}
		throw error;
	}
}

interface GroupRequestOptions {
	readonly registry: CommandRegistry;
	readonly argv: readonly string[];
	readonly executableName: string;
	readonly version: string;
	readonly packageName: string;
	readonly packageVersion: string;
	readonly runtime: "node" | "bun";
	readonly env: NodeJS.ProcessEnv;
	readonly stdout: NodeJS.WriteStream;
	readonly stderr: NodeJS.WriteStream;
	readonly groupPath: readonly string[];
}

function handleGroupRequest(options: GroupRequestOptions): number {
	const {
		registry,
		argv,
		executableName,
		version,
		packageName,
		packageVersion,
		runtime,
		env,
		stdout,
		stderr,
		groupPath,
	} = options;

	try {
		const commandArgv = argv.slice(groupPath.length);
		const parsed = parseCommandArguments(commandArgv, undefined);

		if (parsed.flags["--version"]) {
			stdout.write(`${version}\n`);
			return 0;
		}

		if (parsed.flags["--help"] || parsed.positionals.length === 0) {
			// Show group help
			stdout.write(
				`${formatGroupHelp({ registry, executableName, groupPath })}\n`,
			);
			if (!parsed.flags["--help"]) {
				const cachedNotice = getCachedUpdateNotice({
					executableName,
					packageName,
					currentVersion: packageVersion,
					runtime,
					env,
					isJson: false,
					stderrIsTTY: stderr.isTTY === true,
				});
				if (cachedNotice) {
					stderr.write(cachedNotice.message);
				}
			}
			return 0;
		}

		// If there are positionals, it means unknown subcommand
		const unknown = parsed.positionals.join(" ");
		const groupName = groupPath.join(" ");
		stderr.write(
			`Unknown subcommand \"${unknown}\" for \"${groupName}\". Run \`${executableName} ${groupName} --help\` for a list of subcommands.\n`,
		);
		return 1;
	} catch (error) {
		if (isArgError(error)) {
			stderr.write(`${error.message}\n`);
			return 1;
		}
		throw error;
	}
}

function collectCommandSegments(argv: readonly string[]): string[] {
	const segments: string[] = [];
	for (const token of argv) {
		if (token.startsWith("-")) {
			break;
		}
		segments.push(token);
	}
	return segments;
}

function formatValidationError(error: ZodError): string {
	const firstIssue = error.issues[0];
	if (!firstIssue) {
		return `${error.message}\n`;
	}
	const path = firstIssue.path.length > 0 ? firstIssue.path.join(".") : "input";
	return `Invalid value for \"${path}\": ${firstIssue.message}\n`;
}

function isArgError(error: unknown): error is Error & { code?: string } {
	return (
		error instanceof Error &&
		Object.prototype.hasOwnProperty.call(error, "code") &&
		// @ts-ignore -- arg uses ERR_UNKNOWN_OPTION and friends
		// biome-ignore lint/suspicious/noExplicitAny: arg library error type
		typeof (error as any).code === "string"
	);
}
