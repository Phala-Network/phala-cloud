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
const { waitForCvmCreated, waitForCvmOperation, waitForCvmReady } =
	await import("./cvms");
const { getClient } = await import("@/src/lib/client");

const CVM_ID = "0123456789abcdef0123456789abcdef";

interface QueuedResponse {
	readonly status?: number;
	readonly headers?: Record<string, string>;
	readonly delayMs?: number;
	readonly body: unknown;
}

let server: ReturnType<typeof Bun.serve>;
let statuses: string[] = [];
let responses: QueuedResponse[] = [];
let reads = 0;

function cvmInfo(
	status: string,
	extra: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		id: CVM_ID,
		vm_uuid: CVM_ID,
		name: "my-app",
		app_id: "abc",
		status,
		in_progress: false,
		resource: { memory_in_mb: 4096 },
		gateway: {},
		...extra,
	};
}

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		async fetch() {
			const queued = responses[Math.min(reads, responses.length - 1)];
			if (queued) {
				reads += 1;
				if (queued.delayMs) {
					await new Promise((resolve) => setTimeout(resolve, queued.delayMs));
				}
				return Response.json(queued.body, {
					status: queued.status,
					headers: queued.headers,
				});
			}
			const status = statuses[Math.min(reads++, statuses.length - 1)];
			return Response.json(cvmInfo(status));
		},
	});
});

afterAll(() => {
	server.stop(true);
});

afterEach(() => {
	statuses = [];
	responses = [];
	reads = 0;
});

const context = () =>
	({
		env: {
			PHALA_CLOUD_API_KEY: "test-key",
			PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}/api/v1`,
			PHALA_CLOUD_REQUESTS_PER_MINUTE: "60000",
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

	test("keeps polling after a rate limit response", async () => {
		responses = [
			{
				status: 429,
				headers: { "Retry-After": "0" },
				body: { detail: "Rate limit exceeded" },
			},
			{
				status: 429,
				headers: { "Retry-After": "0" },
				body: { detail: "Rate limit exceeded" },
			},
			{ body: cvmInfo("running") },
		];

		await waitForCvmReady(CVM_ID, 5000, context());

		expect(reads).toBe(3);
	});
});

describe("waitForCvmOperation", () => {
	test.each(["completed", "failed", "cancelled"])(
		"ignores an unknown status and only stops at %s",
		async (status) => {
			responses = [
				{
					body: {
						items: [
							{ correlation_id: "other-operation", status: "completed" },
							{ correlation_id: "correlation-id", status: "next_stage" },
						],
					},
				},
				{
					body: {
						items: [
							{
								correlation_id: "correlation-id",
								status,
								error_message: "terminal operation",
							},
						],
					},
				},
			];
			const client = await getClient(context());
			const result = waitForCvmOperation(
				client,
				CVM_ID,
				"correlation-id",
				5000,
			);
			if (status === "completed") await expect(result).resolves.toBeUndefined();
			else
				await expect(result).rejects.toThrow(
					`Update ${status}: terminal operation`,
				);
			expect(reads).toBe(2);
		},
	);

	test("stops an in-flight poll when the overall timeout expires", async () => {
		responses = [
			{
				delayMs: 200,
				body: { items: [{ status: "completed" }] },
			},
		];
		const client = await getClient(context());
		const startedAt = Date.now();

		await expect(
			waitForCvmOperation(client, CVM_ID, "correlation-id", 20),
		).rejects.toThrow("Timeout waiting for the update operation to finish");

		expect(Date.now() - startedAt).toBeLessThan(150);
	});

	test("keeps polling after a rate limit response", async () => {
		responses = [
			{
				status: 429,
				headers: { "Retry-After": "0" },
				body: { detail: "Rate limit exceeded" },
			},
			{
				status: 429,
				headers: { "Retry-After": "0" },
				body: { detail: "Rate limit exceeded" },
			},
			{ body: { items: [{ status: "completed" }] } },
		];
		const client = await getClient(context());

		await waitForCvmOperation(client, CVM_ID, "correlation-id", 5000);

		expect(reads).toBe(3);
	});
});

describe("waitForCvmCreated", () => {
	test("retries the initial operation lookup after a rate limit response", async () => {
		responses = [
			{
				status: 429,
				headers: { "Retry-After": "0" },
				body: { detail: "Rate limit exceeded" },
			},
			{
				status: 429,
				headers: { "Retry-After": "0" },
				body: { detail: "Rate limit exceeded" },
			},
			{
				body: cvmInfo("starting", {
					progress: { correlation_id: "correlation-id" },
				}),
			},
			{ body: { items: [{ status: "completed" }] } },
			{ body: cvmInfo("running") },
		];
		const client = await getClient(context());

		await waitForCvmCreated(client, CVM_ID, context(), 5000);

		expect(reads).toBe(5);
	});
});
