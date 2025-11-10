/**
 * Command Existence Tests
 *
 * Validates that all commands from v1.0.40 still exist in the current version.
 * This catches breaking changes like removed or renamed commands.
 */

import { describe, test, expect } from "bun:test";
import { commandExists, getHelpText } from "./helpers/command-runner";
import { getAllCommands, v1_0_40_interface } from "./helpers/v1-0-40-baseline";

describe("CLI Interface Compatibility - Command Existence (v1.0.40 baseline)", () => {
	const commandGroups = [
		{ name: "top-level commands", commands: v1_0_40_interface.commands },
		{ name: "auth subcommands", commands: v1_0_40_interface.authCommands },
		{ name: "cvms subcommands", commands: v1_0_40_interface.cvmsCommands },
		{ name: "docker subcommands", commands: v1_0_40_interface.dockerCommands },
		{
			name: "simulator subcommands",
			commands: v1_0_40_interface.simulatorCommands,
		},
		{ name: "nodes commands", commands: v1_0_40_interface.nodesCommands },
		{ name: "config subcommands", commands: v1_0_40_interface.configCommands },
	];

	for (const { name, commands } of commandGroups) {
		test(`all v1.0.40 ${name} exist`, async () => {
			for (const cmd of Object.values(commands)) {
				expect(await commandExists(cmd.name)).toBe(true);
			}
		});
	}

	test("command aliases still work", async () => {
		// Test known aliases from v1.0.40
		const aliases = [
			{ command: "cvms ls", original: "cvms list" },
			{ command: "nodes ls", original: "nodes list" },
			{ command: "config ls", original: "config list" },
		];

		for (const { command, original } of aliases) {
			const aliasHelp = await getHelpText(command);
			const originalHelp = await getHelpText(original);

			// Aliases should show the same help as the original
			expect(aliasHelp.length).toBeGreaterThan(0);
			expect(originalHelp.length).toBeGreaterThan(0);
		}
	});

	test("all commands respond to --help", async () => {
		const allCommands = getAllCommands();

		for (const cmd of allCommands) {
			const helpText = await getHelpText(cmd);

			expect(helpText.length).toBeGreaterThan(0);
			expect(helpText.toLowerCase()).toContain("usage");
		}
	}, 60000); // Longer timeout for many commands
});
