/**
 * Writing an edited compose back to the file it was read from.
 *
 * `phala deploy --dev-os` adds the dev-box service to the compose it sends. The
 * edit is saved to the user's own file first and that saved content is what
 * gets deployed, so the file the user reviews, commits or registers on-chain
 * is the file that runs.
 */

import path from "node:path";
import fs from "fs-extra";

const DIFF_CONTEXT_LINES = 3;

/**
 * The real path of `filePath` when it is a regular file the CLI can replace.
 *
 * Symlinks resolve to their target, so the link survives the write. Anything
 * that is not a regular file (a pipe, `/dev/stdin`, a device) has nothing to
 * write back to, and returns `undefined`.
 */
export function resolveWritableComposeFile(
	filePath: string,
): string | undefined {
	try {
		const realPath = fs.realpathSync(filePath);
		return fs.statSync(realPath).isFile() ? realPath : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Replace `filePath` with `content` atomically: write a temporary file in the
 * same directory, then rename it over the original. The original's permission
 * bits are kept. A failed write leaves the original untouched.
 */
export function writeFileAtomic(filePath: string, content: string): void {
	const mode = fs.statSync(filePath).mode & 0o777;
	const tempPath = path.join(
		path.dirname(filePath),
		`.${path.basename(filePath)}.${process.pid}.tmp`,
	);
	try {
		fs.writeFileSync(tempPath, content, { encoding: "utf8", mode });
		fs.chmodSync(tempPath, mode);
		fs.renameSync(tempPath, filePath);
	} catch (error) {
		fs.rmSync(tempPath, { force: true });
		throw error;
	}
}

type DiffOp = { kind: " " | "-" | "+"; line: string };

function splitLines(text: string): string[] {
	if (text === "") return [];
	const lines = text.split(/\r?\n/);
	if (lines[lines.length - 1] === "") lines.pop();
	return lines;
}

/** Shortest edit script between two line lists (Myers, O(ND)). */
function diffLines(a: string[], b: string[]): DiffOp[] {
	const n = a.length;
	const m = b.length;
	const max = n + m;
	const offset = max + 1;
	const v = new Int32Array(2 * max + 3);
	const trace: Int32Array[] = [];

	let finalDepth = -1;
	for (let d = 0; d <= max && finalDepth < 0; d++) {
		trace.push(v.slice());
		for (let k = -d; k <= d; k += 2) {
			let x =
				k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])
					? v[offset + k + 1]
					: v[offset + k - 1] + 1;
			let y = x - k;
			while (x < n && y < m && a[x] === b[y]) {
				x++;
				y++;
			}
			v[offset + k] = x;
			if (x >= n && y >= m) {
				finalDepth = d;
				break;
			}
		}
	}

	const ops: DiffOp[] = [];
	let x = n;
	let y = m;
	for (let d = finalDepth; d >= 0; d--) {
		const before = trace[d];
		const k = x - y;
		const prevK =
			k === -d || (k !== d && before[offset + k - 1] < before[offset + k + 1])
				? k + 1
				: k - 1;
		const prevX = before[offset + prevK];
		const prevY = prevX - prevK;
		while (x > prevX && y > prevY) {
			ops.push({ kind: " ", line: a[x - 1] });
			x--;
			y--;
		}
		if (d > 0) {
			if (x === prevX) {
				ops.push({ kind: "+", line: b[y - 1] });
				y--;
			} else {
				ops.push({ kind: "-", line: a[x - 1] });
				x--;
			}
		}
	}
	return ops.reverse();
}

/**
 * A unified diff of `before` to `after`, or an empty string when they are
 * equal. Line endings are not part of the comparison.
 */
export function unifiedDiff(
	label: string,
	before: string,
	after: string,
): string {
	const ops = diffLines(splitLines(before), splitLines(after));
	const changed = ops.flatMap((op, index) => (op.kind === " " ? [] : [index]));
	if (changed.length === 0) return "";

	// Group changes whose context windows touch into one hunk.
	const ranges: Array<[number, number]> = [];
	for (const index of changed) {
		const start = Math.max(0, index - DIFF_CONTEXT_LINES);
		const end = Math.min(ops.length, index + DIFF_CONTEXT_LINES + 1);
		const last = ranges[ranges.length - 1];
		if (last && start <= last[1]) last[1] = end;
		else ranges.push([start, end]);
	}

	// Line numbers (1-based) at the start of each op in the old and new file.
	const oldStart: number[] = [];
	const newStart: number[] = [];
	let oldLine = 1;
	let newLine = 1;
	for (const op of ops) {
		oldStart.push(oldLine);
		newStart.push(newLine);
		if (op.kind !== "+") oldLine++;
		if (op.kind !== "-") newLine++;
	}

	const out = [`--- ${label}`, `+++ ${label}`];
	for (const [start, end] of ranges) {
		const hunk = ops.slice(start, end);
		const oldCount = hunk.filter((op) => op.kind !== "+").length;
		const newCount = hunk.filter((op) => op.kind !== "-").length;
		// An empty side is numbered by the line before it.
		const oldFrom = oldCount === 0 ? oldStart[start] - 1 : oldStart[start];
		const newFrom = newCount === 0 ? newStart[start] - 1 : newStart[start];
		out.push(`@@ -${oldFrom},${oldCount} +${newFrom},${newCount} @@`);
		for (const op of hunk) out.push(`${op.kind}${op.line}`);
	}
	return `${out.join("\n")}\n`;
}
