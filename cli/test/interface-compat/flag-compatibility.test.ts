/**
 * Flag Compatibility Tests
 *
 * Validates that all flags from v1.0.40 are still supported.
 * Tests both long-form (--flag) and short-form (-f) variations.
 */

import { describe, test, expect } from "bun:test";
import { getHelpText, hasFlag } from "./helpers/command-runner";
import { v1_0_40_interface } from "./helpers/v1-0-40-baseline";

/**
 * Test a single command's flags against v1.0.40 baseline
 */
async function testCommandFlags(
	commandPath: string,
	spec: { flags: Record<string, { long: string; short?: string }> },
) {
	const helpText = await getHelpText(commandPath);

	for (const flag of Object.values(spec.flags)) {
		// Handle special cases
		if (flag.long === "--api-key") {
			// --api-key is an alias for --api-token (works but shows as --api-token in help)
			expect(hasFlag(helpText, "--api-token")).toBe(true);
			continue;
		}

		expect(hasFlag(helpText, flag.long)).toBe(true);
		if (flag.short) {
			expect(hasFlag(helpText, flag.short)).toBe(true);
		}
	}
}

describe("CLI Interface Compatibility - Flag Support (v1.0.40 baseline)", () => {
	describe("Top-level commands", () => {
		const commands = [
			{ path: "status", spec: v1_0_40_interface.commands.status },
			{ path: "deploy", spec: v1_0_40_interface.commands.deploy },
		];

		for (const { path, spec } of commands) {
			test(`${path} supports all v1.0.40 flags`, async () => {
				await testCommandFlags(path, spec);
			});
		}

		// NOTE: 'login' and 'completion' commands did NOT exist in v1.0.40
		// They were added in v1.1.0, so we don't test them here
		// NOTE: --no-json flag is now supported (was non-functional, now fixed)
	});

	describe("Auth subcommands", () => {
		const commands = [
			{ path: "auth status", spec: v1_0_40_interface.authCommands.status },
			{ path: "auth login", spec: v1_0_40_interface.authCommands.login },
			{ path: "auth logout", spec: v1_0_40_interface.authCommands.logout },
		];

		for (const { path, spec } of commands) {
			test(`${path} supports all v1.0.40 flags`, async () => {
				await testCommandFlags(path, spec);
			});
		}
	});

	describe("CVMs subcommands", () => {
		const commands = [
			{ path: "cvms create", spec: v1_0_40_interface.cvmsCommands.create },
			{ path: "cvms list", spec: v1_0_40_interface.cvmsCommands.list },
			{ path: "cvms get", spec: v1_0_40_interface.cvmsCommands.get },
			{ path: "cvms delete", spec: v1_0_40_interface.cvmsCommands.delete },
			{ path: "cvms resize", spec: v1_0_40_interface.cvmsCommands.resize },
			{ path: "cvms upgrade", spec: v1_0_40_interface.cvmsCommands.upgrade },
			{
				path: "cvms replicate",
				spec: v1_0_40_interface.cvmsCommands.replicate,
			},
			{
				path: "cvms attestation",
				spec: v1_0_40_interface.cvmsCommands.attestation,
			},
		];

		for (const { path, spec } of commands) {
			test(`${path} supports all v1.0.40 flags`, async () => {
				await testCommandFlags(path, spec);
			});
		}
	});

	describe("Docker subcommands", () => {
		const commands = [
			{ path: "docker login", spec: v1_0_40_interface.dockerCommands.login },
			{ path: "docker build", spec: v1_0_40_interface.dockerCommands.build },
			{ path: "docker push", spec: v1_0_40_interface.dockerCommands.push },
			{
				path: "docker generate",
				spec: v1_0_40_interface.dockerCommands.generate,
			},
		];

		for (const { path, spec } of commands) {
			test(`${path} supports all v1.0.40 flags`, async () => {
				await testCommandFlags(path, spec);
			});
		}
	});

	describe("Nodes commands", () => {
		test("nodes list supports all v1.0.40 flags", async () => {
			await testCommandFlags("nodes list", v1_0_40_interface.nodesCommands.list);
		});
	});

	describe("Config subcommands", () => {
		test("config list supports all v1.0.40 flags", async () => {
			await testCommandFlags(
				"config list",
				v1_0_40_interface.configCommands.list,
			);
		});
	});

	describe("Critical flag variations", () => {
		test("deploy supports both -c and --compose (v1.0.40 regression)", async () => {
			// This was a bug found in E2E tests - ensure it stays fixed
			const helpText = await getHelpText("deploy");

			expect(hasFlag(helpText, "--compose")).toBe(true);
			expect(hasFlag(helpText, "-c")).toBe(true);
		});

		test("cvms resize supports --json flag (new in v1.1.0)", async () => {
			const helpText = await getHelpText("cvms resize");

			expect(hasFlag(helpText, "--json")).toBe(true);
			expect(hasFlag(helpText, "-j")).toBe(true);
		});

		test("all JSON-capable commands support both -j and --json", async () => {
			const jsonCommands = [
				"status",
				"cvms list",
				"cvms get",
				"cvms attestation",
				"cvms resize",
				"nodes list",
				"config list",
			];

			for (const cmd of jsonCommands) {
				const helpText = await getHelpText(cmd);

				expect(hasFlag(helpText, "--json")).toBe(true);
				expect(hasFlag(helpText, "-j")).toBe(true);
			}
		});
	});
});
