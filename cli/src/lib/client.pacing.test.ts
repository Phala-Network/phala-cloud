import { afterAll, describe, expect, test } from "bun:test";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "./client";

const API_KEY = "test-key";
let releaseRequests: (() => void) | undefined;
const requestsReleased = new Promise<void>((resolve) => {
	releaseRequests = resolve;
});
const requestStarts: number[] = [];

const server = Bun.serve({
	port: 0,
	async fetch() {
		requestStarts.push(Date.now());
		if (requestStarts.length === 3) {
			releaseRequests?.();
		}
		await requestsReleased;
		return Response.json({ ok: true });
	},
});

afterAll(() => {
	server.stop(true);
});

function context(
	env: Record<string, string | undefined>,
): Pick<CommandContext, "env" | "projectConfig" | "globalOptions"> {
	return {
		env: {
			PHALA_CLOUD_API_KEY: API_KEY,
			PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}`,
			...env,
		},
		projectConfig: {},
	};
}

describe("CLI API request pacing", () => {
	test("shares one request-start budget across clients for the same credential", async () => {
		const env = { PHALA_CLOUD_REQUESTS_PER_MINUTE: "600" };
		const first = await getClient(context(env));
		const second = await getClient(context(env));

		await Promise.all([
			first.get("/first"),
			second.get("/second"),
			first.get("/third"),
		]);

		expect(requestStarts).toHaveLength(3);
		expect(requestStarts[1] - requestStarts[0]).toBeGreaterThanOrEqual(70);
		expect(requestStarts[2] - requestStarts[1]).toBeGreaterThanOrEqual(70);
	}, 5000);

	test.each(["", "0", "-1", "unlimited"])(
		"rejects invalid PHALA_CLOUD_REQUESTS_PER_MINUTE=%p",
		async (value) => {
			await expect(
				getClient(
					context({
						PHALA_CLOUD_API_KEY: `${API_KEY}-${JSON.stringify(value)}`,
						PHALA_CLOUD_REQUESTS_PER_MINUTE: value,
					}),
				),
			).rejects.toThrow(
				"PHALA_CLOUD_REQUESTS_PER_MINUTE must be a positive integer",
			);
		},
	);
});
