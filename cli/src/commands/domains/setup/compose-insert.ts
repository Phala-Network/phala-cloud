/**
 * Text-level edits of a docker compose file for `phala domains setup`.
 *
 * The file is never re-serialized as a whole: the sidecar service and the
 * missing top-level volumes are inserted as text at the end of their sections,
 * so comments, anchors and the user's formatting survive.
 *
 * The line helpers mirror the ones `phala deploy --dev-os` uses to add its
 * service (see commands/deploy/dev-box.ts), and `unifiedDiff` / `writeFileAtomic`
 * overlap with the deploy compose write-back. They are kept local on purpose
 * and can be merged into one shared module later.
 */

import { chmodSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { parse, stringify } from "yaml";

const DEFAULT_INDENT_STEP = 2;
const TOP_LEVEL_KEY = /^["']?([A-Za-z0-9_.-]+)["']?:(.*)$/;
const PROPERTY = /^["']?([A-Za-z0-9_.-]+)["']?\s*:\s*(.*)$/;

type YamlMapping = Record<string, unknown>;

interface BlockSpan {
	readonly keyIndex: number;
	/** Exclusive index of the block's last line. */
	readonly endIndex: number;
	/** Indentation of the block's direct children; undefined when it has none. */
	readonly childIndent: number | undefined;
}

export interface IngressInsertion {
	readonly serviceName: string;
	readonly service: Record<string, unknown>;
	readonly volumes: Record<string, unknown>;
}

function asMapping(value: unknown): YamlMapping | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return undefined;
	}
	return value as YamlMapping;
}

/** Parse the way the backend does, so merge keys and aliases resolve. */
function parseCompose(composeYaml: string): YamlMapping | undefined {
	return asMapping(
		parse(composeYaml, { version: "1.1", merge: true, uniqueKeys: false }),
	);
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
			`Cannot edit this docker compose file: its "${key}" section is written inline. Rewrite that section in block style, or add the service by hand.`,
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
 * Return the compose with the ingress service added under `services` and each
 * missing volume added under the top-level `volumes`. Volumes already declared
 * (directly or through a merge key) are left alone.
 */
export function insertIngressService(
	composeYaml: string,
	insertion: IngressInsertion,
): string {
	const root = parseCompose(composeYaml);
	const services = asMapping(root?.services);
	if (!services) {
		throw new Error(
			"Cannot edit this docker compose file: it has no top-level services section.",
		);
	}
	if (insertion.serviceName in services) {
		throw new Error(
			`The compose already has a service named "${insertion.serviceName}" that does not match the expected dstack-ingress setup. Rename or remove it, then run this command again.`,
		);
	}
	const volumesValue = root?.volumes;
	if (
		volumesValue !== undefined &&
		volumesValue !== null &&
		!asMapping(volumesValue)
	) {
		throw new Error(
			'Cannot edit this docker compose file: its "volumes" section is not a mapping.',
		);
	}
	const declared = Object.keys(asMapping(volumesValue) ?? {});

	const eol = composeYaml.includes("\r\n") ? "\r\n" : "\n";
	const original = composeYaml.split(/\r?\n/);
	const servicesBlock = findTopLevelBlock(original, "services");
	if (!servicesBlock) {
		throw new Error(
			"Cannot edit this docker compose file: it has no top-level services section.",
		);
	}
	const step = indentStep(original, servicesBlock);

	const withVolumes = addVolumes(original, declared, insertion.volumes, step);
	const section = findTopLevelBlock(withVolumes, "services");
	if (!section) throw new Error("Lost the services section while editing.");
	const pad = " ".repeat(section.childIndent ?? DEFAULT_INDENT_STEP);
	const block = yamlLines(
		{ [insertion.serviceName]: insertion.service },
		step,
	).map((line) => `${pad}${line}`);
	const insertAt =
		lastContentIndex(withVolumes, section.keyIndex + 1, section.endIndex) + 1;
	return insertLines(withVolumes, insertAt, block).join(eol);
}

interface DiffOp {
	readonly kind: " " | "-" | "+";
	readonly line: string;
}

function diffOps(before: string[], after: string[]): DiffOp[] {
	const n = before.length;
	const m = after.length;
	const width = m + 1;
	const lcs = new Uint32Array((n + 1) * width);
	for (let i = n - 1; i >= 0; i -= 1) {
		for (let j = m - 1; j >= 0; j -= 1) {
			lcs[i * width + j] =
				before[i] === after[j]
					? lcs[(i + 1) * width + j + 1] + 1
					: Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
		}
	}
	const ops: DiffOp[] = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (before[i] === after[j]) {
			ops.push({ kind: " ", line: before[i] });
			i += 1;
			j += 1;
		} else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
			ops.push({ kind: "-", line: before[i] });
			i += 1;
		} else {
			ops.push({ kind: "+", line: after[j] });
			j += 1;
		}
	}
	for (; i < n; i += 1) ops.push({ kind: "-", line: before[i] });
	for (; j < m; j += 1) ops.push({ kind: "+", line: after[j] });
	return ops;
}

/** Lines of a text, without the empty element a final newline leaves behind. */
function splitText(text: string): string[] {
	const lines = text.split("\n");
	if (lines[lines.length - 1] === "") lines.pop();
	return lines;
}

/** Unified diff of two texts, with three lines of context. Empty when equal. */
export function unifiedDiff(
	label: string,
	before: string,
	after: string,
	context = 3,
): string {
	if (before === after) return "";
	const ops = diffOps(splitText(before), splitText(after));

	const changed = ops.flatMap((op, index) => (op.kind === " " ? [] : [index]));
	const ranges: Array<[number, number]> = [];
	for (const index of changed) {
		const start = Math.max(0, index - context);
		const end = Math.min(ops.length, index + context + 1);
		const last = ranges[ranges.length - 1];
		if (last && start <= last[1]) last[1] = end;
		else ranges.push([start, end]);
	}

	const out = [`--- a/${label}`, `+++ b/${label}`];
	for (const [start, end] of ranges) {
		const slice = ops.slice(start, end);
		const beforeStart = ops
			.slice(0, start)
			.filter((o) => o.kind !== "+").length;
		const afterStart = ops.slice(0, start).filter((o) => o.kind !== "-").length;
		const beforeCount = slice.filter((o) => o.kind !== "+").length;
		const afterCount = slice.filter((o) => o.kind !== "-").length;
		out.push(
			`@@ -${beforeStart + 1},${beforeCount} +${afterStart + 1},${afterCount} @@`,
		);
		for (const op of slice) out.push(`${op.kind}${op.line}`);
	}
	return `${out.join("\n")}\n`;
}

/** Write through a temp file in the same directory, then rename over the target. */
export function writeFileAtomic(path: string, text: string): void {
	const temp = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
	const { mode } = statSync(path);
	writeFileSync(temp, text);
	chmodSync(temp, mode);
	renameSync(temp, path);
}
