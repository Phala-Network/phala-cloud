import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { dispatchCommand } from "./dispatcher";
import { CommandRegistry } from "./registry";
import type { CommandDefinition } from "./types";

function makeOutput() {
	let text = "";
	const stream = {
		write: (chunk: string) => {
			text += chunk;
			return true;
		},
		isTTY: false,
	} as unknown as NodeJS.WriteStream;
	return { stream, read: () => text };
}

async function dispatch(definition: CommandDefinition, argv: string[]) {
	const registry = new CommandRegistry();
	registry.registerCommand(definition);
	const stdout = makeOutput();
	const stderr = makeOutput();
	const code = await dispatchCommand({
		registry,
		argv,
		executableName: "phala",
		version: "0.0.0",
		packageName: "phala",
		packageVersion: "0.0.0",
		runtime: "bun",
		cwd: process.cwd(),
		env: { ...process.env, PHALA_DISABLE_UPDATE_CHECK: "1" },
		stdout: stdout.stream,
		stderr: stderr.stream,
		stdin: process.stdin,
	});
	return { code, stdout: stdout.read(), stderr: stderr.read() };
}

function makeDefinition(schema: z.ZodType): CommandDefinition {
	return {
		path: ["demo"],
		meta: {
			name: "demo",
			description: "Demo command with a required argument",
			stability: "stable",
			arguments: [
				{ name: "target", required: true, target: "target", description: "x" },
			],
		},
		schema,
		run: () => 0,
	};
}

describe("dispatchCommand missing required argument", () => {
	test("prints command help and exits 0 when a required argument is absent", async () => {
		const result = await dispatch(
			makeDefinition(z.object({ target: z.string() })),
			["demo"],
		);
		expect(result.code).toBe(0);
		expect(result.stdout).toContain("Usage: phala demo");
		expect(result.stderr).toBe("");
	});

	test("still prints help when the schema uses a custom error message", async () => {
		const result = await dispatch(
			makeDefinition(
				z.object({ target: z.string({ error: "target is needed" }) }),
			),
			["demo"],
		);
		expect(result.code).toBe(0);
		expect(result.stdout).toContain("Usage: phala demo");
	});

	test("reports a validation error for an invalid value instead of help", async () => {
		const result = await dispatch(
			makeDefinition(z.object({ target: z.string().min(5) })),
			["demo", "abc"],
		);
		expect(result.code).toBe(1);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain('Invalid value for "target"');
	});
});
