import { helpTopics } from "@/src/commands/help/topics.generated";
import { globalCommandOptions } from "./common-flags";
import type {
	CommandDefinition,
	CommandOption,
	CommandPath,
	CommandStability,
} from "./types";
import type { CommandRegistry } from "./registry";

function formatStabilityIndicator(stability: CommandStability): string {
	if (stability === "unstable") return " [UNSTABLE]";
	if (stability === "deprecated") return " [DEPRECATED]";
	return "";
}

function appendHelpTopicsBlock(lines: string[], executableName: string): void {
	const topics = Object.values(helpTopics);
	if (topics.length === 0) return;
	lines.push("Help topics:");
	for (const topic of topics) {
		lines.push(`  ${topic.name.padEnd(18)}${topic.description}`.trimEnd());
	}
	lines.push("");
	lines.push(`Use "${executableName} help <topic>" to read a topic.`);
	lines.push("");
}

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
	const nodes = registry.getChildren();

	const categoryTitle = (
		category:
			| "deploy"
			| "manage"
			| "cvm-ops"
			| "profile"
			| "advanced"
			| "deprecated",
	): string => {
		switch (category) {
			case "deploy":
				return "Deploy:";
			case "manage":
				return "Manage:";
			case "cvm-ops":
				return "CVM operations:";
			case "profile":
				return "Profile / auth:";
			case "advanced":
				return "Advanced:";
			case "deprecated":
				return "Deprecated:";
		}
	};

	const categories: readonly (
		| "deploy"
		| "manage"
		| "cvm-ops"
		| "profile"
		| "advanced"
		| "deprecated"
	)[] = ["deploy", "manage", "cvm-ops", "profile", "advanced", "deprecated"];

	const getCategory = (
		node: (typeof nodes)[number],
	):
		| "deploy"
		| "manage"
		| "cvm-ops"
		| "profile"
		| "advanced"
		| "deprecated" => {
		const meta = node.command?.meta ?? node.group?.meta;
		if (meta?.category) return meta.category;

		const name = node.name ?? "";

		// fallback: deprecated stability implies deprecated category
		if (meta?.stability === "deprecated") return "deprecated";

		// hard-coded defaults for uncategorized top-level commands
		if (name === "nodes" || name === "deploy") return "deploy";
		if (
			name === "apps" ||
			name === "cvms" ||
			name === "link" ||
			name === "simulator"
		)
			return "manage";
		if (name === "ssh" || name === "cp" || name === "ps" || name === "logs")
			return "cvm-ops";
		if (
			name === "login" ||
			name === "logout" ||
			name === "switch" ||
			name === "status"
		)
			return "profile";
		if (name === "api" || name === "self") return "advanced";
		if (name === "auth" || name === "config" || name === "docker")
			return "deprecated";

		// default bucket
		return "advanced";
	};

	for (const category of categories) {
		const groupNodes = nodes
			.filter((n) => getCategory(n) === category)
			.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
		if (groupNodes.length === 0) continue;

		lines.push(categoryTitle(category));
		for (const node of groupNodes) {
			const meta = node.command?.meta ?? node.group?.meta;
			const description = (meta?.description ?? "").split("\n")[0];
			const stability = meta?.stability;
			const indicator = stability ? formatStabilityIndicator(stability) : "";
			const name = node.name ?? "";
			const aliases = meta?.aliases;
			const displayName = aliases?.length
				? `${name} (${aliases.join(", ")})`
				: name;
			lines.push(
				`  ${displayName.padEnd(18)}${description}${indicator}`.trimEnd(),
			);
		}
		lines.push("");
	}

	appendHelpTopicsBlock(lines, executableName);

	lines.push("Global options:");
	for (const option of globalCommandOptions) {
		const sig = formatOptionSignature(option);
		const pad = Math.max(24, sig.length + 2);
		lines.push(`  ${sig.padEnd(pad)}${option.description ?? ""}`.trimEnd());
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
			const meta = child.command?.meta ?? child.group?.meta;
			const description = (meta?.description ?? "").split("\n")[0];
			const stability = meta?.stability;
			const indicator = stability ? formatStabilityIndicator(stability) : "";
			const name = child.name ?? "";
			const aliases = meta?.aliases;
			const displayName = aliases?.length
				? `${name} (${aliases.join(", ")})`
				: name;
			lines.push(
				`  ${displayName.padEnd(18)}${description}${indicator}`.trimEnd(),
			);
		}
		lines.push("");
	}

	lines.push("Global options:");
	for (const option of globalCommandOptions) {
		const sig = formatOptionSignature(option);
		const pad = Math.max(24, sig.length + 2);
		lines.push(`  ${sig.padEnd(pad)}${option.description ?? ""}`.trimEnd());
	}

	return lines.join("\n");
}

export function formatCommandHelp(options: CommandHelpOptions): string {
	const { executableName, definition, registry } = options;
	const usage = buildUsageLine({ executableName, definition });
	const indicator = formatStabilityIndicator(definition.meta.stability);
	const lines: string[] = [
		usage,
		"",
		`${definition.meta.description}${indicator}`,
	];

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

	const allOptions = [...(definition.meta.options ?? [])];
	const hiddenGlobalOptionNames = new Set<string>();
	if (
		(definition.path.length === 1 &&
			(definition.path[0] === "login" || definition.path[0] === "api")) ||
		(definition.path.length === 2 &&
			definition.path[0] === "auth" &&
			definition.path[1] === "login")
	) {
		hiddenGlobalOptionNames.add("profile");
	}

	const visibleCommandOptions = allOptions.filter((o) => !o.hidden);
	const commandOptionsByName = new Map(
		visibleCommandOptions.map((option) => [option.name, option]),
	);
	const visibleGlobalOptions = globalCommandOptions
		.filter((option) => !option.hidden)
		.filter((option) => !hiddenGlobalOptionNames.has(option.name))
		.map((option) => commandOptionsByName.get(option.name) ?? option);
	const globalOptionNames = new Set(visibleGlobalOptions.map((o) => o.name));
	const visibleNonGlobalCommandOptions = visibleCommandOptions.filter(
		(option) => !globalOptionNames.has(option.name),
	);

	if (visibleGlobalOptions.length > 0) {
		const commandShorthands = new Set(
			visibleNonGlobalCommandOptions
				.map((o) => o.shorthand)
				.filter((s): s is string => typeof s === "string" && s.length > 0),
		);

		lines.push("");
		lines.push("Global options:");
		for (const option of visibleGlobalOptions) {
			const includeShorthand =
				!option.shorthand || !commandShorthands.has(option.shorthand);
			const sig = formatOptionSignature(option, { includeShorthand });
			const pad = Math.max(24, sig.length + 2);
			lines.push(`  ${sig.padEnd(pad)}${option.description ?? ""}`.trimEnd());
		}
	}

	if (visibleNonGlobalCommandOptions.length > 0) {
		const isDeprecatedOption = (option: CommandOption): boolean => {
			if (option.group === "deprecated") return true;
			if (option.deprecated) return true;
			const description = option.description ?? "";
			return description.includes("[DEPRECATED]");
		};

		const groupName = (
			option: CommandOption,
		): "basic" | "advanced" | "deprecated" => {
			if (option.group) return option.group;
			if (isDeprecatedOption(option)) return "deprecated";
			return "basic";
		};

		const groups: Record<"basic" | "advanced" | "deprecated", CommandOption[]> =
			{
				basic: [],
				advanced: [],
				deprecated: [],
			};

		for (const option of visibleNonGlobalCommandOptions) {
			groups[groupName(option)].push(option);
		}

		const emitGroup = (title: string, options: CommandOption[]): void => {
			if (options.length === 0) return;
			lines.push("");
			lines.push(title);
			for (const option of options) {
				const sig = formatOptionSignature(option);
				const pad = Math.max(24, sig.length + 2);
				lines.push(`  ${sig.padEnd(pad)}${option.description ?? ""}`.trimEnd());
			}
		};

		emitGroup("Basic options:", groups.basic);
		emitGroup("Advanced options:", groups.advanced);
		emitGroup("Deprecated options:", groups.deprecated);
	}

	// Pass-through arguments section
	if (definition.meta.passThrough) {
		lines.push("");
		lines.push("Pass-through (after --):");
		lines.push(`  ${definition.meta.passThrough.description}`);
		if (
			definition.meta.passThrough.examples &&
			definition.meta.passThrough.examples.length > 0
		) {
			lines.push("");
			lines.push("  Examples:");
			for (const example of definition.meta.passThrough.examples) {
				lines.push(`    ${example}`);
			}
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
			const meta = child.command?.meta ?? child.group?.meta;
			const description = (meta?.description ?? "").split("\n")[0];
			const stability = meta?.stability;
			const childIndicator = stability
				? formatStabilityIndicator(stability)
				: "";
			const name = child.name ?? "";
			const aliases = meta?.aliases;
			const displayName = aliases?.length
				? `${name} (${aliases.join(", ")})`
				: name;
			lines.push(
				`  ${displayName.padEnd(18)}${description}${childIndicator}`.trimEnd(),
			);
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
	const passThroughPart = definition.meta.passThrough ? " [--] [...]" : "";
	return `Usage: ${segments.join(" ")}${optionsPart}${argsPart}${passThroughPart}`;
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

function formatOptionSignature(
	option: CommandOption,
	{ includeShorthand = true }: { includeShorthand?: boolean } = {},
): string {
	const parts: string[] = [];
	if (includeShorthand && option.shorthand) {
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
