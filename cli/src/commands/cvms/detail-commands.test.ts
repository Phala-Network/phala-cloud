import { afterAll, describe, expect, mock, spyOn, test } from "bun:test";
import type { CommandContext } from "@/src/core/types";
import { logger } from "@/src/utils/logger";

// mock.module registrations persist process-wide in bun and interleave with
// other test files' top-level awaits. Load real instances through unique
// specifiers, spread them into every mock so partial replacements from other
// files cannot win, and restore the real modules afterwards, as
// instances/add/index.test.ts does.
const realCloud = await import(
	`${require.resolve("@phala/cloud")}?detail-commands-real`
);
const realClient = await import(
	`${require.resolve("@/src/lib/client")}?detail-commands-real`
);
const realLogger = await import(
	`${require.resolve("@/src/utils/logger")}?detail-commands-real`
);

const getInfo = mock(async (_client: unknown, _request: unknown) => ({
	success: true as const,
	data: {
		name: "my-app",
		app_id: "abc",
		status: "running",
		resource: { vcpu: 2, memory_in_mb: 1536, disk_in_gb: 20 },
	},
}));
const gpuStatus = mock(async (_client: unknown, _request: unknown) => ({
	observed: [{ slot: "0000:01:00.0", cc_mode: "on" }],
}));
mock.module("@phala/cloud", () => ({
	...realCloud,
	safeGetCvmInfo: getInfo,
	getCvmGpuStatus: gpuStatus,
}));
mock.module("@/src/lib/client", () => ({
	...realClient,
	getClient: async () => ({}),
}));
mock.module("@/src/utils/logger", () => ({ ...realLogger }));

afterAll(() => {
	mock.module("@phala/cloud", () => ({ ...realCloud }));
	mock.module("@/src/lib/client", () => ({ ...realClient }));
	mock.module("@/src/utils/logger", () => ({ ...realLogger }));
});

const { cvmsGetCommand } = await import("./get");
const { cvmsGpuStatusCommand } = await import("./gpu-status");

function context() {
	const success = mock(() => {});
	const failWithError = mock(() => {});
	return {
		context: {
			cvmId: { id: "my-app" },
			success,
			failWithError,
			fail: mock(() => {}),
		} as unknown as CommandContext,
		success,
		failWithError,
	};
}

describe("CVM detail commands", () => {
	test("get only requests compose when explicitly selected", async () => {
		const { context: ctx, success } = context();
		getInfo.mockClear();
		expect(
			await cvmsGetCommand.run(
				{ json: true, interactive: false, includeCompose: false },
				ctx,
			),
		).toBe(0);
		expect(getInfo.mock.calls[0]?.[1]).toEqual({ id: "my-app" });
		expect(success).toHaveBeenCalledWith(
			expect.objectContaining({
				resource: expect.objectContaining({ memory_in_mb: 1536 }),
			}),
		);
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
		expect(gpuStatus).not.toHaveBeenCalled();
	});

	test("get displays exact memory in MB", async () => {
		const table = spyOn(logger, "keyValueTable").mockImplementation(() => {});
		const { context: ctx } = context();
		expect(
			await cvmsGetCommand.run(
				{ json: false, interactive: false, includeCompose: false },
				ctx,
			),
		).toBe(0);
		expect(table).toHaveBeenCalledWith(
			expect.objectContaining({ Memory: "1536 MB" }),
		);
		table.mockRestore();
	});

	test("gpu-status returns observed data and normalizes identifiers", async () => {
		const { context: ctx, success } = context();
		expect(
			await cvmsGpuStatusCommand.run({ json: true, interactive: false }, ctx),
		).toBe(0);
		expect(gpuStatus.mock.calls.at(-1)?.[1]).toEqual({ cvmId: "my-app" });
		expect(success).toHaveBeenCalledWith({
			observed: [{ slot: "0000:01:00.0", cc_mode: "on" }],
		});
	});

	test("gpu-status reports API errors", async () => {
		const { context: ctx, failWithError } = context();
		const error = new Error("404");
		gpuStatus.mockImplementationOnce(async () => {
			throw error;
		});
		expect(
			await cvmsGpuStatusCommand.run({ json: true, interactive: false }, ctx),
		).toBe(1);
		expect(failWithError).toHaveBeenCalledWith(error, {
			operation: "Get GPU status",
		});
	});
});
