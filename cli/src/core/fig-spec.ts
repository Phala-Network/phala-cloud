/**
 * Generate Fig (now Amazon Q) completion spec
 * https://fig.io/docs
 */

import { globalCommandOptions } from "./common-flags";
import type { CommandRegistry } from "./registry";
import type { CommandOption, CommandPath } from "./types";

interface FigSpec {
	name: string;
	description?: string;
	subcommands?: FigSpec[];
	options?: FigOption[];
	args?: FigArg[];
}

interface FigOption {
	name: string | string[];
	description?: string;
	args?: FigArg;
	isRequired?: boolean;
	hidden?: boolean;
}

interface FigArg {
	name?: string;
	description?: string;
	isOptional?: boolean;
	isVariadic?: boolean;
	suggestions?: string[];
}

/**
 * Generate Fig completion spec from CommandRegistry
 */
export function generateFigSpec(
	registry: CommandRegistry,
	executableName: string,
): FigSpec {
	const rootChildren = registry.getChildren([]);

	const spec: FigSpec = {
		name: executableName,
		description: "CLI for Managing Phala Cloud Services",
		subcommands: [],
		options: globalCommandOptions.map(toFigOption),
	};

	// Generate subcommands recursively
	for (const child of rootChildren) {
		if (child.name) {
			const subcommand = generateSubcommandSpec(registry, [child.name]);
			if (subcommand) {
				spec.subcommands?.push(subcommand);
			}
		}
	}

	return spec;
}

function generateSubcommandSpec(
	registry: CommandRegistry,
	path: CommandPath,
): FigSpec | null {
	const node = registry.getNode(path);
	if (!node) {
		return null;
	}

	const name = path[path.length - 1];
	const description =
		node.command?.meta.description ?? node.group?.meta.description ?? "";

	const spec: FigSpec = {
		name,
		description,
		options: [],
		subcommands: [],
	};

	const options = [
		...globalCommandOptions,
		...(node.command?.meta.options ?? []),
	];
	const uniqueOptions = Array.from(
		new Map(
			options
				.filter((option) => !option.hidden)
				.map((option) => [option.name, option]),
		).values(),
	);
	if (uniqueOptions.length > 0) {
		spec.options = uniqueOptions.map(toFigOption);
	}

	// Add arguments
	if (node.command?.meta.arguments) {
		spec.args = node.command.meta.arguments.map((arg) => ({
			name: arg.name,
			description: arg.description,
			isOptional: !arg.required,
			isVariadic: arg.variadic,
		}));
	}

	// Recursively add subcommands
	const children = registry.getChildren(path);
	for (const child of children) {
		if (child.name) {
			const subcommand = generateSubcommandSpec(registry, [
				...path,
				child.name,
			]);
			if (subcommand) {
				spec.subcommands?.push(subcommand);
			}
		}
	}

	return spec;
}

function toFigOption(option: CommandOption): FigOption {
	const names = [`--${option.name}`];
	if (option.shorthand) {
		names.unshift(`-${option.shorthand}`);
	}
	for (const alias of option.aliases ?? []) {
		names.push(`--${alias}`);
	}
	if (option.type === "boolean" && option.negatedName) {
		names.push(`--${option.negatedName}`);
	}

	return {
		name: names,
		description: option.description,
		args:
			option.type !== "boolean"
				? {
						name: option.argumentName || "value",
					}
				: undefined,
		hidden: option.hidden,
	};
}

/**
 * Export Fig spec as TypeScript module
 */
export function exportFigSpecAsModule(spec: FigSpec): string {
	return `const completionSpec: Fig.Spec = ${JSON.stringify(spec, null, 2)};

export default completionSpec;
`;
}
