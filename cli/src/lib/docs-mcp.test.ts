import { describe, expect, test } from "bun:test";
import { normalizeDocPath, parseDocsFsOutput, shellQuote } from "./docs-mcp";

describe("parseDocsFsOutput", () => {
	test("parses stdout-only output", () => {
		const result = parseDocsFsOutput("exit: 0\n--- stdout ---\nhello\nworld\n");
		expect(result.exit).toBe(0);
		expect(result.stdout).toBe("hello\nworld\n");
		expect(result.stderr).toBe("");
	});

	test("parses stderr-only output", () => {
		const result = parseDocsFsOutput(
			"exit: 1\n--- stderr ---\ncat: /x: No such file or directory\n",
		);
		expect(result.exit).toBe(1);
		expect(result.stdout).toBe("");
		expect(result.stderr).toBe("cat: /x: No such file or directory\n");
	});

	test("parses combined stdout and stderr", () => {
		const result = parseDocsFsOutput(
			"exit: 2\n--- stdout ---\npartial\n--- stderr ---\noops\n",
		);
		expect(result.exit).toBe(2);
		expect(result.stdout).toBe("partial");
		expect(result.stderr).toBe("oops\n");
	});

	test("passes through unmarked output", () => {
		const result = parseDocsFsOutput("just text");
		expect(result.exit).toBe(0);
		expect(result.stdout).toBe("just text");
	});
});

describe("shellQuote", () => {
	test("wraps in single quotes", () => {
		expect(shellQuote("hello world")).toBe("'hello world'");
	});

	test("escapes embedded single quotes", () => {
		expect(shellQuote("it's")).toBe(`'it'\\''s'`);
	});
});

describe("normalizeDocPath", () => {
	test("strips docs.phala.com URLs", () => {
		expect(
			normalizeDocPath("https://docs.phala.com/phala-cloud/getting-started"),
		).toBe("/phala-cloud/getting-started");
	});

	test("adds a leading slash", () => {
		expect(normalizeDocPath("dstack/overview")).toBe("/dstack/overview");
	});

	test("drops anchors and query strings", () => {
		expect(normalizeDocPath("/quickstart#step-2?x=1")).toBe("/quickstart");
	});
});
