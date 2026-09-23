import arg from "arg";
import { globalCommandOptions } from "./common-flags";
import { type PreparedFlagConfig, prepareFlagConfig } from "./flags";
import type { CommandOption } from "./types";

export interface ParserOptions {
	readonly permissive?: boolean;
	readonly stopAtPositional?: boolean;
}

export interface ParsedArguments {
	readonly positionals: readonly string[];
	readonly flags: Record<string, unknown>;
	readonly flagConfig: PreparedFlagConfig;
	/** Arguments after -- separator, for pass-through to subprocesses */
	readonly passThrough: readonly string[];
}

/**
 * Split argv at the -- separator
 * Returns [beforeDash, afterDash]
 */
function splitAtDoubleDash(argv: readonly string[]): [string[], string[]] {
	const dashIndex = argv.indexOf("--");
	if (dashIndex === -1) {
		return [[...argv], []];
	}
	return [argv.slice(0, dashIndex), argv.slice(dashIndex + 1)];
}

export function parseCommandArguments(
	argv: readonly string[],
	commandOptions: readonly CommandOption[] | undefined,
	options: ParserOptions = {},
): ParsedArguments {
	const mergedOptions: CommandOption[] = [
		...globalCommandOptions,
		...(commandOptions ? [...commandOptions] : []),
	];

	const flagConfig = prepareFlagConfig(mergedOptions);

	const { permissive = false, stopAtPositional = false } = options;

	// Split argv at -- to handle pass-through arguments
	const [mainArgv, passThrough] = splitAtDoubleDash(argv);

	const result = arg(flagConfig.spec, {
		argv: mainArgv,
		permissive,
		stopAtPositional,
	});

	const { _, ...flags } = result;

	return {
		positionals: (_ ?? []) as readonly string[],
		flags,
		flagConfig,
		passThrough,
	};
}

/**
 * Move global options written before the command path to right after it,
 * so `phala --profile dev api /me` resolves the same as
 * `phala api /me --profile dev`. Command resolution reads the leading
 * non-flag tokens, so a leading flag would otherwise hide the command.
 *
 * Only recognized global options (and their values) are moved; hoisting
 * stops at the first unknown flag and leaves the rest untouched.
 */
export function hoistLeadingGlobalOptions(
	argv: readonly string[],
): readonly string[] {
	const { spec, descriptors, negatedLookup } =
		prepareFlagConfig(globalCommandOptions);

	const leading: string[] = [];
	let index = 0;
	while (index < argv.length) {
		const token = argv[index];
		if (!token.startsWith("-") || token === "--") break;

		const [name, inlineValue] = token.split(/=(.*)/s, 2);
		if (negatedLookup.has(name) && inlineValue === undefined) {
			leading.push(token);
			index += 1;
			continue;
		}

		const specEntry = spec[name];
		const canonicalKey = typeof specEntry === "string" ? specEntry : name;
		const descriptor = descriptors.get(canonicalKey);
		if (!descriptor) break;

		const takesValue = descriptor.option.type !== "boolean";
		if (takesValue && inlineValue === undefined) {
			if (index + 1 >= argv.length) break;
			leading.push(token, argv[index + 1]);
			index += 2;
		} else {
			leading.push(token);
			index += 1;
		}
	}

	if (leading.length === 0) return argv;

	const rest = argv.slice(index);
	const commandEnd = rest.findIndex((token) => token.startsWith("-"));
	const splitAt = commandEnd === -1 ? rest.length : commandEnd;
	return [...rest.slice(0, splitAt), ...leading, ...rest.slice(splitAt)];
}
