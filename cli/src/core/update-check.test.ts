import { describe, expect, test } from "bun:test";
import { checkForUpdates, type ConfigValue } from "./update-check";

function createMemoryConfigStore(initial: Record<string, ConfigValue> = {}): {
	get(key: string): ConfigValue;
	save(values: Record<string, ConfigValue>): void;
	entries(): Record<string, ConfigValue>;
} {
	const store = new Map<string, ConfigValue>(Object.entries(initial));
	return {
		get(key) {
			return store.get(key);
		},
		save(values) {
			for (const [k, v] of Object.entries(values)) {
				store.set(k, v);
			}
		},
		entries() {
			return Object.fromEntries(store.entries()) as Record<string, ConfigValue>;
		},
	};
}

function createFakeResponse(
	body: unknown,
	{ ok = true, status = 200 }: { ok?: boolean; status?: number } = {},
): Response {
	const response = new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
	// ok is derived from status; allow overriding for tests.
	Object.defineProperty(response, "ok", { value: ok });
	return response;
}

describe("checkForUpdates", () => {
	test("skips in CI", async () => {
		let called = false;
		const configStore = createMemoryConfigStore();
		const result = await checkForUpdates({
			executableName: "phala",
			packageName: "phala",
			currentVersion: "1.0.0",
			runtime: "node",
			env: { CI: "1" },
			isJson: false,
			stderrIsTTY: true,
			configStore,
			fetchImpl: async () => {
				called = true;
				return createFakeResponse({ version: "9.9.9" });
			},
		});

		expect(result).toBeNull();
		expect(called).toBe(false);
	});

	test("skips when PHALA_DISABLE_UPDATE_CHECK=1", async () => {
		let called = false;
		const configStore = createMemoryConfigStore();
		const result = await checkForUpdates({
			executableName: "phala",
			packageName: "phala",
			currentVersion: "1.0.0",
			runtime: "node",
			env: { PHALA_DISABLE_UPDATE_CHECK: "1" },
			isJson: false,
			stderrIsTTY: true,
			configStore,
			fetchImpl: async () => {
				called = true;
				return createFakeResponse({ version: "9.9.9" });
			},
		});

		expect(result).toBeNull();
		expect(called).toBe(false);
	});

	test("skips when stderrIsTTY is false", async () => {
		let called = false;
		const configStore = createMemoryConfigStore();
		const result = await checkForUpdates({
			executableName: "phala",
			packageName: "phala",
			currentVersion: "1.0.0",
			runtime: "node",
			env: {},
			isJson: false,
			stderrIsTTY: false,
			configStore,
			fetchImpl: async () => {
				called = true;
				return createFakeResponse({ version: "9.9.9" });
			},
		});

		expect(result).toBeNull();
		expect(called).toBe(false);
	});

	test("skips when isJson is true", async () => {
		let called = false;
		const configStore = createMemoryConfigStore();
		const result = await checkForUpdates({
			executableName: "phala",
			packageName: "phala",
			currentVersion: "1.0.0",
			runtime: "node",
			env: {},
			isJson: true,
			stderrIsTTY: true,
			configStore,
			fetchImpl: async () => {
				called = true;
				return createFakeResponse({ version: "9.9.9" });
			},
		});

		expect(result).toBeNull();
		expect(called).toBe(false);
	});

	test("skips when disableUpdateNotice config is true", async () => {
		let called = false;
		const configStore = createMemoryConfigStore({ disableUpdateNotice: true });
		const result = await checkForUpdates({
			executableName: "phala",
			packageName: "phala",
			currentVersion: "1.0.0",
			runtime: "node",
			env: {},
			isJson: false,
			stderrIsTTY: true,
			configStore,
			fetchImpl: async () => {
				called = true;
				return createFakeResponse({ version: "9.9.9" });
			},
		});

		expect(result).toBeNull();
		expect(called).toBe(false);
	});

	test("returns notice when newer version exists", async () => {
		const now = Date.now();
		const configStore = createMemoryConfigStore();
		const result = await checkForUpdates({
			executableName: "phala",
			packageName: "phala",
			currentVersion: "1.0.0",
			runtime: "node",
			env: {},
			isJson: false,
			stderrIsTTY: true,
			now,
			ttlMs: 0,
			configStore,
			fetchImpl: async () =>
				createFakeResponse({ "dist-tags": { latest: "1.2.3" } }),
		});

		expect(result).not.toBeNull();
		expect(result?.latestVersion).toBe("1.2.3");
		expect(result?.currentVersion).toBe("1.0.0");
		expect(result?.message).toContain("Update available: v1.0.0 -> v1.2.3.");
		expect(configStore.entries().updateCheckLastAt).toBe(now);
		expect(configStore.entries().updateCheckLatest).toBe("1.2.3");
	});

	test("returns null when latest is not greater", async () => {
		const configStore = createMemoryConfigStore();
		const result = await checkForUpdates({
			executableName: "phala",
			packageName: "phala",
			currentVersion: "1.2.3",
			runtime: "node",
			env: {},
			isJson: false,
			stderrIsTTY: true,
			ttlMs: 0,
			configStore,
			fetchImpl: async () =>
				createFakeResponse({ "dist-tags": { latest: "1.2.3" } }),
		});

		expect(result).toBeNull();
	});

	test("uses cached latest for notice without network", async () => {
		let called = false;
		const configStore = createMemoryConfigStore({
			updateCheckLastAt: Date.now(),
			updateCheckLatest: "9.9.9",
			updateCheckLatest_latest: "9.9.9",
		});
		const result = await checkForUpdates({
			executableName: "phala",
			packageName: "phala",
			currentVersion: "1.0.0",
			runtime: "node",
			env: {},
			isJson: false,
			stderrIsTTY: true,
			ttlMs: 24 * 60 * 60 * 1000,
			configStore,
			fetchImpl: async () => {
				called = true;
				return createFakeResponse({ "dist-tags": { latest: "9.9.9" } });
			},
		});

		expect(called).toBe(false);
		expect(result?.latestVersion).toBe("9.9.9");
	});

	test("encodes scoped package names for registry URL", async () => {
		let requestedUrl: string | null = null;
		const configStore = createMemoryConfigStore();
		const result = await checkForUpdates({
			executableName: "phala",
			packageName: "@phala/cli",
			currentVersion: "1.0.0",
			runtime: "node",
			env: {},
			isJson: false,
			stderrIsTTY: true,
			ttlMs: 0,
			configStore,
			fetchImpl: async (url) => {
				requestedUrl = url;
				return createFakeResponse({ "dist-tags": { latest: "1.0.1" } });
			},
		});

		expect(requestedUrl).toContain("registry.npmjs.org/@phala%2Fcli");
		expect(result?.message).toContain("self update");
	});

	test("returns null when response.ok is false (and still records attempt time)", async () => {
		const now = 123456;
		const configStore = createMemoryConfigStore();
		const result = await checkForUpdates({
			executableName: "phala",
			packageName: "phala",
			currentVersion: "1.0.0",
			runtime: "node",
			env: {},
			isJson: false,
			stderrIsTTY: true,
			now,
			ttlMs: 0,
			configStore,
			fetchImpl: async () => createFakeResponse({}, { ok: false, status: 500 }),
		});

		expect(result).toBeNull();
		expect(configStore.entries().updateCheckLastAt).toBe(now);
	});

	test("times out and returns null", async () => {
		const configStore = createMemoryConfigStore();
		const start = Date.now();
		const result = await checkForUpdates({
			executableName: "phala",
			packageName: "phala",
			currentVersion: "1.0.0",
			runtime: "node",
			env: {},
			isJson: false,
			stderrIsTTY: true,
			ttlMs: 0,
			timeoutMs: 20,
			configStore,
			fetchImpl: async (_url, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(new DOMException("Aborted", "AbortError"));
					});
				}),
		});

		expect(result).toBeNull();
		expect(Date.now() - start).toBeLessThan(500);
	});

	test("uses prerelease channel tag when current is prerelease", async () => {
		const configStore = createMemoryConfigStore();
		const result = await checkForUpdates({
			executableName: "phala",
			packageName: "phala",
			currentVersion: "1.2.0-beta.1",
			runtime: "node",
			env: {},
			isJson: false,
			stderrIsTTY: true,
			ttlMs: 0,
			configStore,
			fetchImpl: async () =>
				createFakeResponse({
					"dist-tags": { latest: "1.2.0", beta: "1.2.0-beta.3" },
				}),
		});

		expect(result).not.toBeNull();
		expect(result?.latestVersion).toBe("1.2.0-beta.3");
		expect(result?.message).toContain("(beta)");
		expect(configStore.entries().updateCheckLatest_beta).toBe("1.2.0-beta.3");
	});
});
