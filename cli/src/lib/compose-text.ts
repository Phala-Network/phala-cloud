/**
 * Text-level edits of a docker compose file.
 *
 * The file is never re-serialized as a whole: a service and the missing
 * top-level volumes are inserted as text at the end of their sections, so
 * comments, anchors and the user's formatting survive. Reading goes through the
 * parsed document instead, so merge keys, aliases and flow mappings are
 * understood the way the backend understands them.
 *
 * Used by `phala deploy --dev-os` (the dev box) and `phala domains setup` (the
 * ingress service).
 */

import { parse, stringify } from "yaml";

const DEFAULT_INDENT_STEP = 2;
const TOP_LEVEL_KEY = /^["']?([A-Za-z0-9_.-]+)["']?:(.*)$/;

export type YamlMapping = Record<string, unknown>;

interface BlockSpan {
	readonly keyIndex: number;
	/** Exclusive index of the block's last line. */
	readonly endIndex: number;
	/** Indentation of the block's direct children; undefined when it has none. */
	readonly childIndent: number | undefined;
}

/** A service to add, with the top-level volumes it mounts. */
export interface ComposeServiceInsertion {
	readonly name: string;
	readonly service: Record<string, unknown>;
	/** Top-level volumes to declare; names the compose already declares are skipped. */
	readonly volumes: Record<string, unknown>;
}

export function asMapping(value: unknown): YamlMapping | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return undefined;
	}
	return value as YamlMapping;
}

/**
 * Parse a compose file the way the backend does.
 *
 * `version: "1.1"` matches the PyYAML SafeLoader behind the backend, so `yes`
 * is a boolean here too. `merge: true` resolves `<<` keys and aliases.
 * `uniqueKeys: false` keeps a repeated key readable (the last one wins), as
 * PyYAML does. Throws on YAML the parser rejects.
 */
export function parseCompose(composeYaml: string): unknown {
	return parse(composeYaml, {
		version: "1.1",
		merge: true,
		uniqueKeys: false,
	});
}

function indentOf(line: string): number {
	let count = 0;
	while (line[count] === " ") count += 1;
	return count;
}

function isContentLine(line: string): boolean {
	const text = line.trim();
	return text !== "" && !text.startsWith("#");
}

function shallowestIndent(
	lines: string[],
	from: number,
	to: number,
): number | undefined {
	let indent: number | undefined;
	for (let i = from; i < to; i += 1) {
		if (!isContentLine(lines[i])) continue;
		const current = indentOf(lines[i]);
		if (indent === undefined || current < indent) indent = current;
	}
	return indent;
}

function findTopLevelBlock(
	lines: string[],
	key: string,
): BlockSpan | undefined {
	const keyIndex = lines.findIndex(
		(line) =>
			indentOf(line) === 0 &&
			isContentLine(line) &&
			TOP_LEVEL_KEY.exec(line)?.[1] === key,
	);
	if (keyIndex === -1) return undefined;

	// An anchor or tag may follow the key and still be block style; any other
	// value on the key's line means the section is written inline.
	const rest = (TOP_LEVEL_KEY.exec(lines[keyIndex])?.[2] ?? "")
		.trim()
		.replace(/^&\S*/, "")
		.replace(/^!\S*/, "")
		.trim();
	if (rest !== "" && !rest.startsWith("#")) {
		throw new Error(
			`Cannot edit this docker compose file: its "${key}" section is written inline. Rewrite that section in block style, or make the change by hand.`,
		);
	}

	let endIndex = lines.length;
	for (let i = keyIndex + 1; i < lines.length; i += 1) {
		if (indentOf(lines[i]) !== 0 || !isContentLine(lines[i])) continue;
		endIndex = i;
		break;
	}
	return {
		keyIndex,
		endIndex,
		childIndent: shallowestIndent(lines, keyIndex + 1, endIndex),
	};
}

/** Indentation step the file uses between a service name and its properties. */
function indentStep(lines: string[], services: BlockSpan): number {
	const serviceIndent = services.childIndent;
	if (serviceIndent === undefined) return DEFAULT_INDENT_STEP;
	for (let i = services.keyIndex + 1; i < services.endIndex; i += 1) {
		if (!isContentLine(lines[i]) || indentOf(lines[i]) !== serviceIndent) {
			continue;
		}
		const next = lines
			.slice(i + 1, services.endIndex)
			.find((line) => isContentLine(line));
		if (next !== undefined && indentOf(next) > serviceIndent) {
			return indentOf(next) - serviceIndent;
		}
	}
	return DEFAULT_INDENT_STEP;
}

function lastContentIndex(lines: string[], from: number, to: number): number {
	for (let i = to - 1; i >= from; i -= 1) {
		if (isContentLine(lines[i])) return i;
	}
	return from - 1;
}

function insertLines(
	lines: string[],
	index: number,
	block: string[],
): string[] {
	return [...lines.slice(0, index), ...block, ...lines.slice(index)];
}

function isEmptyValue(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	const mapping = asMapping(value);
	return mapping !== undefined && Object.keys(mapping).length === 0;
}

function yamlLines(value: unknown, step: number): string[] {
	return stringify(value, { indent: step, lineWidth: 0, version: "1.1" })
		.split("\n")
		.filter((line, index, all) => !(line === "" && index === all.length - 1));
}

function addVolumes(
	lines: string[],
	declared: readonly string[],
	volumes: Record<string, unknown>,
	step: number,
): string[] {
	const missing = Object.entries(volumes).filter(
		([name]) => !declared.includes(name),
	);
	if (missing.length === 0) return lines;

	const section = findTopLevelBlock(lines, "volumes");
	const pad = " ".repeat(section?.childIndent ?? step);
	const block = missing.flatMap(([name, value]) =>
		isEmptyValue(value)
			? [`${pad}${name}:`]
			: yamlLines({ [name]: value }, step).map((line) => `${pad}${line}`),
	);

	if (!section) {
		const insertAt = lastContentIndex(lines, 0, lines.length) + 1;
		return insertLines(lines, insertAt, ["volumes:", ...block]);
	}
	const insertAt =
		section.childIndent === undefined
			? section.keyIndex + 1
			: lastContentIndex(lines, section.keyIndex + 1, section.endIndex) + 1;
	return insertLines(lines, insertAt, block);
}

/**
 * The top-level volume names a compose declares, after merge keys and anchors
 * are resolved.
 *
 * Reading them from the parsed document rather than from the text keeps a
 * merge-inherited definition safe: `volumes: {<<: *storage}` owns every name
 * `storage` brings with it, and appending a bare entry beside the merge would
 * silently replace the operator's volume.
 */
export function declaredVolumeNames(composeYaml: string): string[] {
	const volumes = asMapping(parseCompose(composeYaml))?.volumes;
	if (volumes === undefined || volumes === null) return [];
	const mapping = asMapping(volumes);
	if (!mapping) {
		throw new Error(
			'Cannot edit this docker compose file: its "volumes" section is not a mapping.',
		);
	}
	return Object.keys(mapping);
}

/**
 * Return the compose with a service added at the end of the top-level
 * `services` mapping and each missing volume added under the top-level
 * `volumes`. Volumes already declared (directly or through a merge key) are
 * left alone. Throws when the compose cannot be edited without guessing, or
 * when a service of that name already exists.
 */
export function insertComposeService(
	composeYaml: string,
	insertion: ComposeServiceInsertion,
): string {
	let root: YamlMapping | undefined;
	try {
		root = asMapping(parseCompose(composeYaml));
	} catch (error) {
		throw new Error(
			`Cannot add the "${insertion.name}" service to this docker compose file: it is not valid YAML. ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	const services = asMapping(root?.services);
	if (!services) {
		throw new Error(
			`Cannot add the "${insertion.name}" service to this docker compose file: it has no top-level services section.`,
		);
	}
	if (insertion.name in services) {
		throw new Error(
			`The compose already has a service named "${insertion.name}". Rename or remove it, then run this command again.`,
		);
	}
	const declared = declaredVolumeNames(composeYaml);

	const eol = composeYaml.includes("\r\n") ? "\r\n" : "\n";
	const original = composeYaml.split(/\r?\n/);
	const servicesBlock = findTopLevelBlock(original, "services");
	if (!servicesBlock) {
		throw new Error(
			`Cannot add the "${insertion.name}" service to this docker compose file: it has no top-level services section.`,
		);
	}
	const step = indentStep(original, servicesBlock);

	const withVolumes = addVolumes(original, declared, insertion.volumes, step);
	const section = findTopLevelBlock(withVolumes, "services");
	if (!section) throw new Error("Lost the services section while editing.");
	const pad = " ".repeat(section.childIndent ?? DEFAULT_INDENT_STEP);
	const block = yamlLines({ [insertion.name]: insertion.service }, step).map(
		(line) => `${pad}${line}`,
	);
	const insertAt =
		lastContentIndex(withVolumes, section.keyIndex + 1, section.endIndex) + 1;
	return insertLines(withVolumes, insertAt, block).join(eol);
}
