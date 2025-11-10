/**
 * JSON Output Quality Tests
 *
 * Validates JSON output is clean and parseable.
 * Flag existence is tested in flag-compatibility.test.ts
 */

import { describe, test, expect } from "bun:test";
import { runCommand, parseJsonOutput } from "./helpers/command-runner";

describe("CLI Interface Compatibility - JSON Output (v1.0.40 baseline)", () => {
	describe("Output cleanliness", () => {
		test("no ANSI codes or spinner artifacts in output", async () => {
			const result = await runCommand("cvms --help");

			// No ANSI escape codes or Unicode spinner chars
			expect(result.stdout).not.toContain("\x1b[");
			expect(result.stdout).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
		});

		test("no formatting bugs in output", async () => {
			const result = await runCommand("cvms list --help");

			expect(result.stdout).not.toContain("undefined");
			expect(result.stdout).not.toContain('"null"');
			expect(result.stdout).not.toContain("[object Object]");
			expect(result.stdout).not.toContain("}{"); // No concatenated JSON
		});
	});

	describe("JSON error handling", () => {
		test("errors in JSON mode produce valid JSON when possible", async () => {
			const result = await runCommand("cvms delete --json", {
				expectError: true,
			});

			expect(result.exitCode).toBeGreaterThan(0);

			// If stdout starts with {, it should be valid JSON
			if (result.stdout.trim().startsWith("{")) {
				expect(() => parseJsonOutput(result.stdout)).not.toThrow();
			}
		});
	});
});
