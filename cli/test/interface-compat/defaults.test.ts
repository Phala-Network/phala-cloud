/**
 * Default Behavior Tests
 *
 * Validates behavioral defaults that aren't flags or help text.
 */

import { describe, test, expect } from "bun:test";
import { getHelpText } from "./helpers/command-runner";

describe("CLI Interface Compatibility - Default Values (v1.0.40 baseline)", () => {
	test("cvms create exists but is deprecated", async () => {
		const helpText = await getHelpText("cvms create");
		expect(helpText.toLowerCase()).toContain("deprecated");
	});
});
