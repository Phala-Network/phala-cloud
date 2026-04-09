import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { formatCommandHelp } from "./help";
import type { CommandDefinition } from "./types";
import { CommandRegistry } from "./registry";

describe("formatCommandHelp", () => {
	test("should group options by basic/advanced/deprecated", () => {
		const definition: CommandDefinition = {
			path: ["demo"],
			meta: {
				name: "demo",
				description: "Demo command",
				stability: "stable",
				options: [
					{ name: "basic", type: "string", group: "basic" },
					{ name: "advanced", type: "string", group: "advanced" },
					{
						name: "legacy",
						type: "string",
						description: "[DEPRECATED] legacy option",
					},
				],
			},
			schema: z.object({}),
			run: () => undefined,
		};

		const registry = new CommandRegistry();
		registry.registerCommand(definition);
		const text = formatCommandHelp({
			executableName: "phala",
			definition,
			registry,
		});

		expect(text).toContain("Basic options:");
		expect(text).toContain("--basic <value>");

		expect(text).toContain("Advanced options:");
		expect(text).toContain("--advanced <value>");

		expect(text).toContain("Deprecated options:");
		expect(text).toContain("--legacy <value>");
	});

	test("should render a shared global option only once using command signature", () => {
		const definition: CommandDefinition = {
			path: ["demo-interactive"],
			meta: {
				name: "demo-interactive",
				description: "Demo command (shared global option)",
				stability: "stable",
				options: [{ name: "interactive", shorthand: "i", type: "boolean" }],
			},
			schema: z.object({}),
			run: () => undefined,
		};

		const registry = new CommandRegistry();
		registry.registerCommand(definition);
		const text = formatCommandHelp({
			executableName: "phala",
			definition,
			registry,
		});

		expect(text).toContain("Global options:");
		expect(text).toContain("-i, --interactive");
		expect(text).not.toContain("Basic options:\n  -i, --interactive");
	});

	test("should hide global profile option for login and api commands", () => {
		const registry = new CommandRegistry();

		const loginDefinition: CommandDefinition = {
			path: ["login"],
			meta: {
				name: "login",
				description: "Login command",
				stability: "stable",
				options: [{ name: "profile", type: "string" }],
			},
			schema: z.object({}),
			run: () => undefined,
		};
		registry.registerCommand(loginDefinition);
		const loginText = formatCommandHelp({
			executableName: "phala",
			definition: loginDefinition,
			registry,
		});
		expect(loginText).toContain("Basic options:");
		expect(loginText).toContain("--profile <value>");
		expect(loginText).not.toContain(
			"Temporarily use a different auth profile for this command",
		);

		const apiDefinition: CommandDefinition = {
			path: ["api"],
			meta: {
				name: "api",
				description: "API command",
				stability: "stable",
				options: [],
			},
			schema: z.object({}),
			run: () => undefined,
		};
		registry.registerCommand(apiDefinition);
		const apiText = formatCommandHelp({
			executableName: "phala",
			definition: apiDefinition,
			registry,
		});
		expect(apiText).not.toContain(
			"Temporarily use a different auth profile for this command",
		);
	});

	test("should omit global shorthand when it conflicts with command option shorthand", () => {
		const definition: CommandDefinition = {
			path: ["demo-conflict"],
			meta: {
				name: "demo-conflict",
				description: "Demo command (shorthand conflict)",
				stability: "stable",
				options: [{ name: "jot", shorthand: "j", type: "boolean" }],
			},
			schema: z.object({}),
			run: () => undefined,
		};

		const registry = new CommandRegistry();
		registry.registerCommand(definition);
		const text = formatCommandHelp({
			executableName: "phala",
			definition,
			registry,
		});

		expect(text).toContain("Global options:");
		expect(text).toContain("--json");
		expect(text).not.toContain("-j, --json");

		expect(text).toContain("Basic options:");
		expect(text).toContain("-j, --jot");
	});
});
