/**
 * Help Text Validation Tests
 *
 * Validates that help text is complete, accurate, and consistent.
 * Ensures help text contains all necessary information for users.
 */

import { describe, test, expect } from "bun:test";
import { getHelpText } from "./helpers/command-runner";
import { getAllCommands } from "./helpers/v1-0-40-baseline";

describe("CLI Interface Compatibility - Help Text (v1.0.40 baseline)", () => {
	describe("Basic help text requirements", () => {
		test("all commands have non-empty help with usage section", async () => {
			const allCommands = getAllCommands();

			for (const cmd of allCommands) {
				const helpText = await getHelpText(cmd);

				expect(helpText.length).toBeGreaterThan(0);
				expect(helpText.toLowerCase()).toMatch(/usage:/i);
				expect(helpText).not.toContain("undefined");
				expect(helpText).not.toContain("[object Object]");
			}
		}, 60000);
	});

	describe("Command-specific help content", () => {
		const criticalFlags = [
			{
				cmd: "deploy",
				flags: ["--name", "--compose", "--env-file", "--vcpu", "--memory", "--disk-size"],
			},
			{
				cmd: "cvms create",
				flags: ["--name", "--compose", "--teepod-id"],
			},
			{
				cmd: "cvms resize",
				flags: ["--vcpu", "--memory", "--disk-size", "--allow-restart", "--yes"],
			},
			{
				cmd: "docker build",
				flags: ["--image", "--tag"],
			},
		];

		for (const { cmd, flags } of criticalFlags) {
			test(`${cmd} documents critical flags`, async () => {
				const helpText = await getHelpText(cmd);

				for (const flag of flags) {
					expect(helpText).toContain(flag);
				}

				// Flag descriptions should be present (not just flag names)
				const lines = helpText.split("\n");
				const flagLines = lines.filter((line) =>
					flags.some((f) => line.includes(f)),
				);
				for (const line of flagLines) {
					expect(line.length).toBeGreaterThan(20);
				}
			});
		}
	});

	describe("Group help shows subcommands", () => {
		const groups = [
			{
				group: "cvms",
				subcommands: [
					"create",
					"list",
					"get",
					"delete",
					"start",
					"stop",
					"restart",
					"resize",
					"upgrade",
					"replicate",
					"attestation",
				],
			},
			{ group: "auth", subcommands: ["login", "logout", "status"] },
			{ group: "docker", subcommands: ["login", "build", "push", "generate"] },
		];

		for (const { group, subcommands } of groups) {
			test(`${group} help lists all subcommands`, async () => {
				const helpText = await getHelpText(group);

				for (const sub of subcommands) {
					expect(helpText).toContain(sub);
				}
			});
		}

		test("main help shows command groups", async () => {
			const helpText = await getHelpText("");

			expect(helpText.toLowerCase()).toMatch(/commands:|available commands:/i);
		});
	});
});
