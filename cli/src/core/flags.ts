import arg from "arg";
import { ensureArray, toCamelCase } from "./utils";
import type { CommandOption, CommandOptionValueType } from "./types";

export interface CommandOptionDescriptor {
	readonly option: CommandOption;
	readonly canonicalKey: string;
	readonly target: string;
	readonly negatedKey?: string;
}

export interface PreparedFlagConfig {
	readonly spec: arg.Spec;
	readonly descriptors: Map<string, CommandOptionDescriptor>;
	readonly negatedLookup: Map<string, CommandOptionDescriptor>;
}

export function prepareFlagConfig(
	options: readonly CommandOption[] | undefined,
): PreparedFlagConfig {
	const spec: arg.Spec = {};
	const descriptors = new Map<string, CommandOptionDescriptor>();
	const negatedLookup = new Map<string, CommandOptionDescriptor>();

	if (!options) {
		return { spec, descriptors, negatedLookup };
	}

	for (const option of options) {
		const canonicalKey = `--${option.name}`;
		const target = option.target ?? toCamelCase(option.name);
		const handler = getHandlerForType(option.type);

		descriptors.set(canonicalKey, {
			option,
			canonicalKey,
			target,
			negatedKey: option.negatedName ? `--${option.negatedName}` : undefined,
		});

		spec[canonicalKey] = handler;

		if (option.shorthand) {
			spec[`-${option.shorthand}`] = canonicalKey;
		}

		for (const alias of ensureArray(option.aliases)) {
			spec[`--${alias}`] = canonicalKey;
		}

		if (option.negatedName) {
			const negatedKey = `--${option.negatedName}`;
			if (option.type !== "boolean") {
				throw new Error(
					`Negated option is only supported for boolean types: ${option.name}`,
				);
			}
			spec[negatedKey] = arg.flag(() => true);
			negatedLookup.set(negatedKey, {
				option,
				canonicalKey,
				target,
				negatedKey,
			});
		}
	}

	return { spec, descriptors, negatedLookup };
}

function getHandlerForType(type: CommandOptionValueType): arg.Handler {
	switch (type) {
		case "string":
			return (value = "") => value;
		case "number":
			return (value, name) => {
				const parsed = Number(value);
				if (Number.isNaN(parsed)) {
					throw new Error(`Invalid value for ${name}: expected a number.`);
				}
				return parsed;
			};
		case "boolean":
			return arg.flag(() => true);
		case "string[]":
			return (value, name, previous) => {
				const next = Array.isArray(previous) ? [...previous] : [];
				if (value === "") {
					throw new Error(`Option ${name} expects a value.`);
				}
				next.push(value);
				return next;
			};
		case "number[]":
			return (value, name, previous) => {
				const next = Array.isArray(previous) ? [...previous] : [];
				const parsed = Number(value);
				if (Number.isNaN(parsed)) {
					throw new Error(`Invalid value for ${name}: expected a number.`);
				}
				next.push(parsed);
				return next;
			};
		default:
			throw new Error(`Unsupported option type: ${type}`);
	}
}
