/**
 * waitForCvmReady against a local HTTP server and the real SDK client.
 */

import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	mock,
	test,
} from "bun:test";
import type { CommandContext } from "@/src/core/types";

// Other test files replace @phala/cloud and @/src/lib/client with
// mock.module; load fresh real instances, as deploy/create.test.ts does.
const realCloud = await import(`${require.resolve("@phala/cloud")}?real`);
mock.module("@phala/cloud", () => ({ ...realCloud }));
const previousClient = { ...(await import("@/src/lib/client")) };
const realClient = await import(`${require.resolve("@/src/lib/client")}?real`);
mock.module("@/src/lib/client", () => ({ ...realClient }));
afterAll(() => {
	mock.module("@/src/lib/client", () => previousClient);
});
const { waitForCvmReady } = await import("./cvms");

const CVM_ID = "0123456789abcdef0123456789abcdef";

let server: ReturnType<typeof Bun.serve>;
let statuses: string[] = [];
let reads = 0;

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		fetch() {
			const status = statuses[Math.min(reads++, statuses.length - 1)];
			return Response.json({
				id: CVM_ID,
				vm_uuid: CVM_ID,
				name: "my-app",
				app_id: "abc",
				status,
				in_progress: false,
				resource: {},
				gateway: {},
			});
		},
	});
});

afterAll(() => {
	server.stop(true);
});

afterEach(() => {
	statuses = [];
	reads = 0;
});

const context = () =>
	({
		env: {
			PHALA_CLOUD_API_KEY: "test-key",
			PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}/api/v1`,
		},
		projectConfig: {},
	}) as unknown as CommandContext;

describe("waitForCvmReady", () => {
	test("keeps waiting for running when the CVM starts from error (cvms restart)", async () => {
		// The first poll still sees the status from before the restart.
		statuses = ["error", "error", "running"];

		await waitForCvmReady(CVM_ID, 20000, context());

		expect(reads).toBe(3);
	}, 25000);

	test("rejects at once on error when failOnError is set", async () => {
		statuses = ["error", "running"];

		await expect(
			waitForCvmReady(CVM_ID, 20000, context(), "running", true),
		).rejects.toThrow("CVM is in error state");
		expect(reads).toBe(1);
	});

	test("polls once when the budget is already spent", async () => {
		// The operation wait can use up the shared deadline before this starts.
		statuses = ["running"];

		await waitForCvmReady(CVM_ID, -1000, context());

		expect(reads).toBe(1);
	});
});
