/**
 * Default Behavior Tests
 *
 * Validates behavioral defaults that aren't flags or help text.
 */

import { describe, test, expect } from "bun:test";
import { runCommand } from "./helpers/command-runner";

describe("CLI Interface Compatibility - Default Values (v1.0.40 baseline)", () => {
	test("cvms create is removed", async () => {
		const result = await runCommand("cvms create --help");
		expect(result.stdout).not.toContain("create");
	});
});
