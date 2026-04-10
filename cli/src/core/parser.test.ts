import { describe, expect, test } from "bun:test";
import { parseCommandArguments } from "./parser";
import { buildCommandSchemaInput } from "./input-builder";
import type { CommandMeta } from "./types";

describe("parseCommandArguments", () => {
	describe("pass-through argument splitting (--)", () => {
		test("should return empty passThrough when no -- separator", () => {
			const result = parseCommandArguments(
				["--foo", "bar", "positional"],
				[{ name: "foo", type: "string" }],
			);
			expect(result.passThrough).toEqual([]);
			expect(result.flags["--foo"]).toBe("bar");
			expect(result.positionals).toEqual(["positional"]);
		});

		test("should split arguments at -- separator", () => {
			const result = parseCommandArguments(
				["--foo", "bar", "--", "-L", "8080:localhost:80"],
				[{ name: "foo", type: "string" }],
			);
			expect(result.flags["--foo"]).toBe("bar");
			expect(result.passThrough).toEqual(["-L", "8080:localhost:80"]);
			expect(result.positionals).toEqual([]);
		});

		test("should handle positional before -- and pass-through after", () => {
			const result = parseCommandArguments(
				["app_123", "--foo", "bar", "--", "-i", "~/.ssh/key", "ls", "-la"],
				[{ name: "foo", type: "string" }],
			);
			expect(result.positionals).toEqual(["app_123"]);
			expect(result.flags["--foo"]).toBe("bar");
			expect(result.passThrough).toEqual(["-i", "~/.ssh/key", "ls", "-la"]);
		});

		test("should handle -- at the beginning", () => {
			const result = parseCommandArguments(
				["--", "-L", "8080:localhost:80"],
				[{ name: "foo", type: "string" }],
			);
			expect(result.passThrough).toEqual(["-L", "8080:localhost:80"]);
			expect(result.positionals).toEqual([]);
		});

		test("should handle -- at the end with nothing after", () => {
			const result = parseCommandArguments(
				["--foo", "bar", "--"],
				[{ name: "foo", type: "string" }],
			);
			expect(result.flags["--foo"]).toBe("bar");
			expect(result.passThrough).toEqual([]);
		});

		test("should handle -- with only positionals before", () => {
			const result = parseCommandArguments(
				["app_123", "--", "ls", "-la", "/app"],
				[],
			);
			expect(result.positionals).toEqual(["app_123"]);
			expect(result.passThrough).toEqual(["ls", "-la", "/app"]);
		});

		test("should preserve options that look like flags in pass-through", () => {
			const result = parseCommandArguments(
				["--verbose", "--", "-v", "-o", "StrictHostKeyChecking=no"],
				[{ name: "verbose", type: "boolean" }],
			);
			expect(result.flags["--verbose"]).toBe(true);
			expect(result.passThrough).toEqual([
				"-v",
				"-o",
				"StrictHostKeyChecking=no",
			]);
		});

		test("should only split on first -- separator", () => {
			const result = parseCommandArguments(
				["--foo", "bar", "--", "echo", "--", "hello"],
				[{ name: "foo", type: "string" }],
			);
			expect(result.flags["--foo"]).toBe("bar");
			// Everything after first -- goes to passThrough, including the second --
			expect(result.passThrough).toEqual(["echo", "--", "hello"]);
		});
	});

	test("should parse newly supported global options", () => {
		const result = parseCommandArguments(
			[
				"--api-token",
				"tok",
				"--profile",
				"team",
				"--interactive",
				"--cvm-id",
				"app_123",
			],
			[],
		);
		expect(result.flags["--api-token"]).toBe("tok");
		expect(result.flags["--profile"]).toBe("team");
		expect(result.flags["--interactive"]).toBe(true);
		expect(result.flags["--cvm-id"]).toBe("app_123");
	});

	describe("boolean flags with negatedName", () => {
		const booleanOptions = [
			{
				name: "dev-os",
				type: "boolean" as const,
				target: "devOs",
				negatedName: "no-dev-os",
			},
			{
				name: "public-logs",
				type: "boolean" as const,
				target: "publicLogs",
				negatedName: "no-public-logs",
			},
		];

		test("should set flag to true when --flag is passed", () => {
			const result = parseCommandArguments(["--dev-os"], booleanOptions);
			expect(result.flags["--dev-os"]).toBe(true);
			expect(result.flags["--no-dev-os"]).toBeUndefined();
		});

		test("should set negated flag to true when --no-flag is passed", () => {
			const result = parseCommandArguments(["--no-dev-os"], booleanOptions);
			expect(result.flags["--dev-os"]).toBeUndefined();
			expect(result.flags["--no-dev-os"]).toBe(true);
		});

		test("should handle multiple boolean flags with negation", () => {
			const result = parseCommandArguments(
				["--dev-os", "--no-public-logs"],
				booleanOptions,
			);
			expect(result.flags["--dev-os"]).toBe(true);
			expect(result.flags["--no-public-logs"]).toBe(true);
		});

		test("should handle negated flag alone", () => {
			const result = parseCommandArguments(
				["--no-public-logs"],
				booleanOptions,
			);
			expect(result.flags["--public-logs"]).toBeUndefined();
			expect(result.flags["--no-public-logs"]).toBe(true);
		});
	});
});

describe("buildCommandSchemaInput with negatedName", () => {
	const mockMeta: CommandMeta = {
		name: "test",
		description: "Test command",
		stability: "stable",
		arguments: [],
		options: [
			{
				name: "dev-os",
				type: "boolean",
				target: "devOs",
				negatedName: "no-dev-os",
			},
			{
				name: "public-logs",
				type: "boolean",
				target: "publicLogs",
				negatedName: "no-public-logs",
			},
			{
				name: "listed",
				type: "boolean",
				target: "listed",
				negatedName: "no-listed",
			},
		],
	};

	test("should set target to true when --flag is passed", () => {
		const parsed = parseCommandArguments(["--dev-os"], mockMeta.options);
		const input = buildCommandSchemaInput(mockMeta, parsed);
		expect(input.options.devOs).toBe(true);
	});

	test("should set target to false when --no-flag is passed", () => {
		const parsed = parseCommandArguments(["--no-dev-os"], mockMeta.options);
		const input = buildCommandSchemaInput(mockMeta, parsed);
		expect(input.options.devOs).toBe(false);
	});

	test("should leave target undefined when neither flag nor negated flag is passed", () => {
		const parsed = parseCommandArguments([], mockMeta.options);
		const input = buildCommandSchemaInput(mockMeta, parsed);
		expect(input.options.devOs).toBeUndefined();
	});

	test("should handle multiple flags with mixed positive and negative", () => {
		const parsed = parseCommandArguments(
			["--dev-os", "--no-public-logs", "--listed"],
			mockMeta.options,
		);
		const input = buildCommandSchemaInput(mockMeta, parsed);
		expect(input.options.devOs).toBe(true);
		expect(input.options.publicLogs).toBe(false);
		expect(input.options.listed).toBe(true);
	});

	test("negated flag should override positive flag when both are passed (last wins in parsing)", () => {
		// When both are passed, the negated lookup processes after positive
		// So --no-flag will set target to false
		const parsed = parseCommandArguments(
			["--dev-os", "--no-dev-os"],
			mockMeta.options,
		);
		const input = buildCommandSchemaInput(mockMeta, parsed);
		// negatedLookup is processed after descriptors, so false wins
		expect(input.options.devOs).toBe(false);
	});
});
