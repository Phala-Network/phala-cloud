import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const requests: Array<{ path: string; query: string; version: string | null }> =
	[];
let server: ReturnType<typeof Bun.serve>;
beforeAll(() => {
	server = Bun.serve({
		port: 0,
		fetch(request) {
			const url = new URL(request.url);
			requests.push({
				path: url.pathname,
				query: url.search,
				version: request.headers.get("X-Phala-Version"),
			});
			return Response.json({
				id: "cvm-123",
				name: "my-app",
				app_id: "abc",
				status: "running",
				resource: {
					vcpu: 2,
					memory_in_mb: 1536,
					memory_in_gb: 2,
					disk_in_gb: 20,
				},
				gateway: {},
				gpu: { product_id: null, gpus: 1, cc_mode: { expected: "on" } },
				...(url.searchParams.has("include_compose")
					? {
							compose_file: url.pathname.endsWith("/string-compose")
								? "services:\n  app:\n    image: example/image:latest"
								: { services: { app: { image: "example/image:latest" } } },
						}
					: {}),
			});
		},
	});
});
afterAll(() => server.stop(true));

async function run(...args: string[]) {
	const proc = Bun.spawn(["bun", "src/index.ts", ...args], {
		cwd: process.cwd(),
		env: {
			...process.env,
			PHALA_CLOUD_API_KEY: "test-key",
			PHALA_CLOUD_API_PREFIX: `http://127.0.0.1:${server.port}/api/v1`,
		},
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exit] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { stdout, stderr, exit };
}

describe("CVM detail HTTP requests", () => {
	test("default version and explicit compose opt-in", async () => {
		requests.length = 0;
		const old = await run("cvms", "get", "my-app", "--json");
		expect(old.exit).toBe(0);
		expect(requests[0]).toEqual({
			path: "/api/v1/cvms/my-app",
			query: "",
			version: "2026-06-23",
		});
		const detail = await run(
			"cvms",
			"get",
			"my-app",
			"--api-version",
			"2026-11-11",
			"--json",
		);
		expect(detail.exit).toBe(0);
		expect(requests[1]).toEqual({
			path: "/api/v1/cvms/my-app",
			query: "",
			version: "2026-11-11",
		});
		expect(JSON.parse(detail.stdout).resource.memory_in_mb).toBe(1536);
		expect(JSON.parse(detail.stdout)).not.toHaveProperty("compose_file");
		const compose = await run(
			"cvms",
			"get",
			"my-app",
			"--api-version",
			"2026-11-11",
			"--include-compose",
			"--json",
		);
		expect(compose.exit).toBe(0);
		expect(requests[2]?.query).toBe("?include_compose=true");
		expect(JSON.parse(compose.stdout).compose_file).toEqual({
			services: { app: { image: "example/image:latest" } },
		});
		expect(requests).toHaveLength(3);
	});
	test("text output displays requested compose objects and strings", async () => {
		for (const id of ["my-app", "string-compose"]) {
			const result = await run(
				"cvms",
				"get",
				id,
				"--api-version",
				"2026-11-11",
				"--include-compose",
			);
			expect(result.exit).toBe(0);
			expect(result.stdout).toContain("Compose:");
			expect(result.stdout).toContain("example/image:latest");
		}
	});
});
