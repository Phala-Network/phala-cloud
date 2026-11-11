import { describe, expect, mock, test } from "bun:test";
import type { CommandContext } from "@/src/core/types";

const cloud = await import(`${require.resolve("@phala/cloud")}?detail-test`);
const getInfo = mock(async (_client: unknown, _request: unknown) => ({
	success: true as const,
	data: {
		name: "my-app",
		app_id: "abc",
		status: "running",
		resource: { vcpu: 2, memory_in_mb: 1536, disk_in_gb: 20 },
	},
}));
mock.module("@phala/cloud", () => ({ ...cloud, safeGetCvmInfo: getInfo }));
mock.module("@/src/lib/client", () => ({ getClient: async () => ({}) }));
const { cvmsGetCommand } = await import("./get");

describe("CVM detail commands", () => {
	test("get only requests compose when explicitly selected", async () => {
		const success = mock(() => {});
		const ctx = {
			cvmId: { id: "my-app" },
			success,
			failWithError: mock(() => {}),
			fail: mock(() => {}),
		} as unknown as CommandContext;
		expect(
			await cvmsGetCommand.run(
				{ json: true, interactive: false, includeCompose: false },
				ctx,
			),
		).toBe(0);
		expect(getInfo.mock.calls[0]?.[1]).toEqual({ id: "my-app" });
		expect(
			await cvmsGetCommand.run(
				{ json: true, interactive: false, includeCompose: true },
				ctx,
			),
		).toBe(0);
		expect(getInfo.mock.calls[1]?.[1]).toEqual({
			id: "my-app",
			include_compose: true,
		});
	});
});
