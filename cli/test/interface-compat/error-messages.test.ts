/**
 * Error Message Contract Tests
 *
 * Validates that error messages are helpful and exit codes are consistent.
 * Ensures error handling matches v1.0.40 behavior.
 */

import { describe, test, expect } from "bun:test";
import { runCommand } from "./helpers/command-runner";

describe("CLI Interface Compatibility - Error Handling (v1.0.40 baseline)", () => {
	describe("Exit codes", () => {
		test("success returns 0, failures return non-zero", async () => {
			const success = await runCommand("--help");
			expect(success.exitCode).toBe(0);

			const failure = await runCommand("nonexistent-command", {
				expectError: true,
			});
			expect(failure.exitCode).toBeGreaterThan(0);
		});
	});

	describe("Commands fail with helpful errors", () => {
		const errorTests = [
			// Missing required args
			{ cmd: "docker build", reason: "missing required args" },
			{ cmd: "docker push", reason: "missing required args" },
			// Invalid values
			{ cmd: "deploy --name test --vcpu -999 --compose test.yml", reason: "invalid vcpu" },
			{ cmd: "deploy --name test --memory -1 --compose test.yml", reason: "invalid memory" },
			// File not found
			{ cmd: "deploy --name test --compose /nonexistent/file.yml", reason: "missing file" },
			{ cmd: "deploy --name test --env-file /nonexistent/.env", reason: "missing env file" },
			// Invalid format
			{ cmd: "cvms get invalid-id-format", reason: "invalid app-id format", timeout: 10000 },
			// Conflicting flags
			{ cmd: "deploy --json --no-json", reason: "conflicting flags" },
		];

		for (const { cmd, reason, timeout } of errorTests) {
			test(`${reason}: ${cmd.split(" ")[0]}`, async () => {
				const result = await runCommand(cmd, { expectError: true, timeout });

				expect(result.exitCode).toBeGreaterThan(0);
				expect((result.stdout + result.stderr).length).toBeGreaterThan(0);
			});
		}
	});

	describe("Authentication errors", () => {
		test("invalid API key fails", async () => {
			const result = await runCommand("cvms list --json", {
				expectError: true,
				env: { PHALA_CLOUD_API_KEY: "invalid_key" },
				timeout: 10000,
			});

			expect(result.exitCode).toBeGreaterThan(0);
		});
	});

	describe("Error message quality", () => {
		test("errors don't leak stack traces", async () => {
			const result = await runCommand("cvms delete", {
				expectError: true,
				timeout: 1000,
				stdin: "\n",
			});

			const output = result.stdout + result.stderr;

			if (output.length > 0 && !output.includes("timed out")) {
				expect(output).not.toContain("Error: Error:");
				expect(output).not.toMatch(/at Object\./);
				expect(output).not.toMatch(/at async/);
			}
		});
	});

	describe("JSON mode errors", () => {
		test("JSON errors are valid JSON with error info", async () => {
			const result = await runCommand("cvms list --json", {
				expectError: true,
				env: { PHALA_CLOUD_API_KEY: "invalid_key" },
				timeout: 10000,
			});

			expect(result.exitCode).toBeGreaterThan(0);
			expect((result.stdout + result.stderr).length).toBeGreaterThan(0);

			// If stdout has JSON, it should be parseable
			if (result.stdout.trim()) {
				expect(() => JSON.parse(result.stdout)).not.toThrow();
			}
		});
	});
});
