import { globalCommandOptions } from "./common-flags";
import type { CommandDefinition, CommandOption, CommandPath } from "./types";
import type { CommandRegistry } from "./registry";

interface GlobalHelpOptions {
	readonly registry: CommandRegistry;
	readonly executableName: string;
}

interface CommandHelpOptions {
	readonly executableName: string;
	readonly definition: CommandDefinition;
	readonly registry: CommandRegistry;
}

interface GroupHelpOptions {
	readonly registry: CommandRegistry;
	readonly executableName: string;
	readonly groupPath: CommandPath;
}

export function formatGlobalHelp(options: GlobalHelpOptions): string {
	const { registry, executableName } = options;
	const lines: string[] = [];

	lines.push(`Usage: ${executableName} <command> [options]`);
	lines.push("");
	lines.push("Available commands:");

	for (const node of registry.getChildren()) {
		const description =
			node.command?.meta.description ?? node.group?.meta.description ?? "";
		const name = node.name ?? "";
		lines.push(`  ${name.padEnd(18)}${description}`.trimEnd());
	}

	lines.push("");
	lines.push("Global options:");
	for (const option of globalCommandOptions) {
		lines.push(
			`  ${formatOptionSignature(option).padEnd(24)}${option.description ?? ""}`.trimEnd(),
		);
	}

	return lines.join("\n");
}

export function formatGroupHelp(options: GroupHelpOptions): string {
	const { registry, executableName, groupPath } = options;
	const groupNode = registry.getNode(groupPath);

	if (!groupNode?.group) {
		return formatGlobalHelp({ registry, executableName });
	}

	const lines: string[] = [];
	const groupName = groupPath.join(" ");
	const fullCommand = `${executableName} ${groupName}`;

	lines.push(`Usage: ${fullCommand} <command> [options]`);
	lines.push("");

	if (groupNode.group.meta.description) {
		lines.push(groupNode.group.meta.description);
		lines.push("");
	}

	const children = registry.getChildren(groupPath);
	if (children.length > 0) {
		lines.push("Available commands:");
		for (const child of children) {
			const description =
				child.command?.meta.description ?? child.group?.meta.description ?? "";
			const name = child.name ?? "";
			lines.push(`  ${name.padEnd(18)}${description}`.trimEnd());
		}
		lines.push("");
	}

	lines.push("Global options:");
	for (const option of globalCommandOptions) {
		lines.push(
			`  ${formatOptionSignature(option).padEnd(24)}${option.description ?? ""}`.trimEnd(),
		);
	}

	return lines.join("\n");
}

export function formatCommandHelp(options: CommandHelpOptions): string {
	const { executableName, definition, registry } = options;
	const usage = buildUsageLine({ executableName, definition });
	const lines: string[] = [usage, "", definition.meta.description];

	const args = definition.meta.arguments ?? [];
	if (args.length > 0) {
		lines.push("");
		lines.push("Arguments:");
		for (const argument of args) {
			const signature = formatArgumentSignature(argument);
			lines.push(
				`  ${signature.padEnd(18)}${argument.description ?? ""}`.trimEnd(),
			);
		}
	}

	const allOptions = [
		...globalCommandOptions,
		...(definition.meta.options ?? []),
	];
	if (allOptions.length > 0) {
		lines.push("");
		lines.push("Options:");
		for (const option of allOptions) {
			if (option.hidden) {
				continue;
			}
			lines.push(
				`  ${formatOptionSignature(option).padEnd(24)}${option.description ?? ""}`.trimEnd(),
			);
		}
	}

	if (definition.meta.examples && definition.meta.examples.length > 0) {
		lines.push("");
		lines.push("Examples:");
		for (const example of definition.meta.examples) {
			lines.push(`  # ${example.name}`);
			lines.push(`  ${example.value}`);
		}
	}

	const children = registry.getChildren(definition.path);
	if (children.length > 0) {
		lines.push("");
		lines.push("Subcommands:");
		for (const child of children) {
			const description =
				child.command?.meta.description ?? child.group?.meta.description ?? "";
			const name = child.name ?? "";
			lines.push(`  ${name.padEnd(18)}${description}`.trimEnd());
		}
	}

	return lines.join("\n");
}

function buildUsageLine({
	executableName,
	definition,
}: {
	executableName: string;
	definition: CommandDefinition;
}): string {
	const segments = [executableName, ...definition.path];
	const args = definition.meta.arguments ?? [];
	const positionalSegment = args
		.map((argument) => formatArgumentUsage(argument))
		.join(" ");
	const hasOptions = (definition.meta.options?.length ?? 0) > 0;
	const optionsPart = hasOptions ? " [options]" : "";
	const argsPart = positionalSegment ? ` ${positionalSegment}` : "";
	return `Usage: ${segments.join(" ")}${optionsPart}${argsPart}`;
}

function formatArgumentUsage(argument: {
	name: string;
	required?: boolean;
	variadic?: boolean;
}): string {
	const base = `<${argument.name}>`;
	if (argument.variadic) {
		return `${base}...`;
	}
	if (argument.required === false) {
		return `[${base}]`;
	}
	return base;
}

function formatArgumentSignature(argument: {
	name: string;
	required?: boolean;
	variadic?: boolean;
}): string {
	if (argument.variadic) {
		return `<${argument.name}...>`;
	}
	if (argument.required === false) {
		return `<${argument.name}>?`;
	}
	return `<${argument.name}>`;
}

function formatOptionSignature(option: CommandOption): string {
	const parts: string[] = [];
	if (option.shorthand) {
		parts.push(`-${option.shorthand}`);
	}
	let signature = `--${option.name}`;
	if (option.argumentName) {
		signature += ` ${option.argumentName.toUpperCase()}`;
	} else if (option.type !== "boolean") {
		signature += " <value>";
	}
	parts.push(signature);

	// Add aliases
	if (option.aliases && option.aliases.length > 0) {
		for (const alias of option.aliases) {
			let aliasSignature = `--${alias}`;
			if (option.argumentName) {
				aliasSignature += ` ${option.argumentName.toUpperCase()}`;
			} else if (option.type !== "boolean") {
				aliasSignature += " <value>";
			}
			parts.push(aliasSignature);
		}
	}

	// Add negated form for boolean flags
	if (option.type === "boolean" && option.negatedName) {
		parts.push(`--${option.negatedName}`);
	}

	return parts.join(", ");
}
