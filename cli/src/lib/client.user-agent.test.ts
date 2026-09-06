import { beforeEach, describe, expect, mock, test } from "bun:test";

const createClientMock = mock((config: Record<string, unknown>) => config);

mock.module("@phala/cloud", () => ({
	createClient: createClientMock,
	safeRevokeCurrentApiToken: mock(() => Promise.resolve({ success: true })),
}));

mock.module("@/src/core/api-version", () => ({
	getApiVersionOverride: () => undefined,
}));

describe("CLI client User-Agent", () => {
	beforeEach(() => {
		createClientMock.mockClear();
	});

	test("getClient sets phala-cli User-Agent", async () => {
		const { getClient } = await import("./client");
		const { CLI_USER_AGENT } = await import("@/src/utils/cli-version");
		await getClient({
			env: {},
			projectConfig: {},
			globalOptions: { apiToken: "phak_test" },
		} as never);
		expect(createClientMock).toHaveBeenCalled();
		const config = createClientMock.mock.calls[0]?.[0] as {
			headers?: { "User-Agent"?: string };
		};
		expect(config.headers?.["User-Agent"]).toBe(CLI_USER_AGENT);
	});

	test("getClientWithKey sets phala-cli User-Agent", async () => {
		const { getClientWithKey } = await import("./client");
		const { CLI_USER_AGENT } = await import("@/src/utils/cli-version");
		await getClientWithKey("phak_other");
		const config = createClientMock.mock.calls.at(-1)?.[0] as {
			headers?: { "User-Agent"?: string };
		};
		expect(config.headers?.["User-Agent"]).toBe(CLI_USER_AGENT);
	});
});
