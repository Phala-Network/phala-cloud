import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLI_PACKAGE_VERSION, CLI_USER_AGENT } from "./cli-version";

describe("cli-version", () => {
	test("reads version from cli package.json", () => {
		const pkgPath = join(
			dirname(fileURLToPath(import.meta.url)),
			"../../package.json",
		);
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
			version: string;
		};
		expect(CLI_PACKAGE_VERSION).toBe(pkg.version);
		expect(CLI_USER_AGENT).toBe(`phala-cli/${pkg.version}`);
	});

	test("user-agent uses phala-cli product token", () => {
		expect(CLI_USER_AGENT.startsWith("phala-cli/")).toBe(true);
		expect(CLI_USER_AGENT.includes(" ")).toBe(false);
	});
});
