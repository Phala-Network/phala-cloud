import { describe, expect, mock, spyOn, test } from "bun:test";
import { CommandRegistry } from "@/src/core/registry";
import type { CommandContext } from "@/src/core/types";

const getWorkspaceNodes = mock(async () => ({
	success: true as const,
	data: {
		items: [
			{ id: 42, name: "teepod-display", node: "usw5", region: "us-west" },
		],
		page: 1,
		pages: 1,
		total: 1,
	},
}));

mock.module("@phala/cloud", () => ({
	safeGetCurrentUser: async () => ({
		success: true as const,
		data: { workspace: { slug: "test-workspace" } },
	}),
	safeGetWorkspaceNodes: getWorkspaceNodes,
}));
mock.module("@/src/lib/client", () => ({ getClient: async () => ({}) }));
mock.module("@/src/utils/logger", () => ({ logger: { info: () => {} } }));

const { nodesCommand, nodesListCommand } = await import("./index");

const context = {
	fail: (message: string) => {
		throw new Error(message);
	},
	failWithError: (error: unknown) => {
		throw error;
	},
} as unknown as CommandContext;

describe("nodes list output", () => {
	test("list and ls render the physical name without an ID column", async () => {
		const registry = new CommandRegistry();
		registry.registerCommand(nodesCommand);
		registry.registerCommand(nodesListCommand);
		const list = registry.resolveCommand(["nodes", "list"]);
		const ls = registry.resolveCommand(["nodes", "ls"]);
		expect(ls?.definition).toBe(list?.definition);

		const output: string[] = [];
		const consoleSpy = spyOn(console, "log").mockImplementation(
			(line: string) => {
				output.push(line);
			},
		);
		try {
			for (const resolved of [list, ls]) {
				expect(resolved).toBeTruthy();
				expect(
					await resolved?.definition.run(
						{ page: 1, pageSize: 30, json: false },
						context,
					),
				).toBe(0);
			}
		} finally {
			consoleSpy.mockRestore();
		}
		expect(output).toHaveLength(4);
		for (const index of [0, 2]) {
			const headers = output[index].trim().split(/\s{2,}/);
			const cells = output[index + 1].trim().split(/\s{2,}/);
			expect(headers).not.toContain("ID");
			expect(cells[headers.indexOf("NAME")]).toBe("usw5");
			expect(cells).not.toContain("teepod-display");
		}
		expect(output.slice(0, 2)).toEqual(output.slice(2, 4));
		expect(getWorkspaceNodes).toHaveBeenCalledTimes(2);
	});
});
