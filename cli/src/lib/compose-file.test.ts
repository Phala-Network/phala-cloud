/**
 * Compose file I/O: atomic write-back and the unified diff shown for it.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import {
	resolveWritableComposeFile,
	unifiedDiff,
	writeFileAtomic,
} from "./compose-file";

let dir: string;

beforeAll(async () => {
	dir = await fs.mkdtemp(path.join(os.tmpdir(), "phala-write-back-"));
});

afterAll(async () => {
	await fs.remove(dir);
});

describe("unifiedDiff", () => {
	test("is empty for equal text", () => {
		expect(unifiedDiff("f.yml", "a\nb\n", "a\nb\n")).toBe("");
	});

	test("shows an appended block with context", () => {
		const before = "services:\n  web:\n    image: nginx\n";
		const after = `${before}  dev-box:\n    image: box\n`;
		expect(unifiedDiff("f.yml", before, after)).toBe(
			[
				"--- f.yml",
				"+++ f.yml",
				"@@ -1,3 +1,5 @@",
				" services:",
				"   web:",
				"     image: nginx",
				"+  dev-box:",
				"+    image: box",
				"",
			].join("\n"),
		);
	});

	test("splits distant changes into separate hunks and counts lines", () => {
		const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`);
		const edited = [...lines];
		edited.splice(1, 1, "changed2");
		edited.splice(18, 1);
		const diff = unifiedDiff(
			"f",
			`${lines.join("\n")}\n`,
			`${edited.join("\n")}\n`,
		);
		const hunks = diff.split("\n").filter((l) => l.startsWith("@@"));
		expect(hunks).toEqual(["@@ -1,5 +1,5 @@", "@@ -16,5 +16,4 @@"]);
		expect(diff).toContain("-line2\n+changed2");
		expect(diff).toContain("-line19\n");
	});
});

describe("writeFileAtomic", () => {
	test("replaces the content and keeps the permission bits", async () => {
		const file = path.join(dir, "mode.yml");
		await fs.writeFile(file, "old", { mode: 0o640 });
		await fs.chmod(file, 0o640);

		writeFileAtomic(file, "new");

		expect(await fs.readFile(file, "utf8")).toBe("new");
		expect((await fs.stat(file)).mode & 0o777).toBe(0o640);
		expect((await fs.readdir(dir)).filter((n) => n.endsWith(".tmp"))).toEqual(
			[],
		);
	});

	test("leaves the original alone and cleans up when the write fails", async () => {
		const file = path.join(dir, "fail.yml");
		await fs.writeFile(file, "keep");
		// A directory in the temporary file's place makes the write fail.
		const temp = path.join(dir, `.fail.yml.${process.pid}.tmp`);
		await fs.mkdir(temp);

		expect(() => writeFileAtomic(file, "new")).toThrow();

		expect(await fs.readFile(file, "utf8")).toBe("keep");
	});
});

describe("resolveWritableComposeFile", () => {
	test("resolves a symlink to its target and rejects non-files", async () => {
		const target = path.join(dir, "target.yml");
		const link = path.join(dir, "link.yml");
		await fs.writeFile(target, "x");
		await fs.symlink(target, link);

		expect(resolveWritableComposeFile(link)).toBe(await fs.realpath(target));
		expect(resolveWritableComposeFile(dir)).toBeUndefined();
		expect(
			resolveWritableComposeFile(path.join(dir, "missing")),
		).toBeUndefined();
	});
});
