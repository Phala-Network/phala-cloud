import { afterEach, expect, it, vi } from "vitest";
import { createBaseClient, watchCvmState } from "../../index";

afterEach(() => vi.unstubAllGlobals());

it("sends resolved bearer, workspace and version headers over the SSE transport", async () => {
	let headers = new Headers();
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
			headers = new Headers(init?.headers);
			return new Response(
				'event: state\ndata: {"status":"running","derived_status":"running"}\n\nevent: complete\ndata: {"status":"running","elapsed":1,"target":"running"}\n\n',
			);
		}),
	);
	const client = createBaseClient({
		baseURL: "https://example.test",
		bearerToken: "token",
		workspace: " workspace ",
		version: "2025-10-28",
	});
	await watchCvmState(client, {
		id: "cvm-123",
		target: "running",
		maxRetries: 1,
	});
	expect(headers.get("authorization")).toBe("Bearer token");
	expect(headers.get("x-phala-workspace")).toBe("workspace");
	expect(headers.get("x-phala-version")).toBe("2025-10-28");
});

it("performs the initial attempt and one retry on timeout", async () => {
	let attempts = 0;
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => {
			attempts++;
			return new Response(
				attempts === 1
					? 'event: timeout\ndata: {"error":"timeout","elapsed":10,"target":"running"}\n\n'
					: 'event: state\ndata: {"status":"running","derived_status":"running"}\n\nevent: complete\ndata: {"status":"running","elapsed":1,"target":"running"}\n\n',
			);
		}),
	);
	const client = createBaseClient({ baseURL: "https://example.test" });
	const state = await watchCvmState(client, {
		id: "cvm-123",
		target: "running",
		maxRetries: 1,
		retryDelay: 0,
	});
	expect(state.derived_status).toBe("running");
	expect(attempts).toBe(2);
});

it("does not report a non-target state as success on EOF", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(
					'event: state\ndata: {"status":"starting","derived_status":"starting"}\n\n',
				),
		),
	);
	const client = createBaseClient({ baseURL: "https://example.test" });
	await expect(
		watchCvmState(client, { id: "cvm-123", target: "running", maxRetries: 0 }),
	).rejects.toThrow();
});

it("does not retry permanent HTTP failures", async () => {
	let attempts = 0;
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => {
			attempts++;
			return new Response("denied", { status: 403 });
		}),
	);
	const client = createBaseClient({ baseURL: "https://example.test" });
	await expect(
		watchCvmState(client, {
			id: "cvm-123",
			target: "running",
			maxRetries: 2,
			retryDelay: 0,
		}),
	).rejects.toThrow("403");
	expect(attempts).toBe(1);
});

it("rejects a complete event that reports the wrong target status", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(
					'event: state\ndata: {"status":"starting","derived_status":"starting"}\n\nevent: complete\ndata: {"status":"starting","target":"running","elapsed":1}\n\n',
				),
		),
	);
	const client = createBaseClient({ baseURL: "https://example.test" });
	await expect(
		watchCvmState(client, { id: "cvm-123", target: "running", maxRetries: 0 }),
	).rejects.toThrow();
});

it("cancels a pending stream read when aborted", async () => {
	let cancelled = false;
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(
					new ReadableStream({
						cancel() {
							cancelled = true;
						},
					}),
				),
		),
	);
	const client = createBaseClient({ baseURL: "https://example.test" });
	const controller = new AbortController();
	const result = watchCvmState(
		client,
		{ id: "cvm-123", target: "running", maxRetries: 0 },
		{ signal: controller.signal },
	);
	setTimeout(() => controller.abort(), 10);
	await expect(
		Promise.race([
			result,
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error("abort hung")), 100),
			),
		]),
	).rejects.toThrow("aborted");
	expect(cancelled).toBe(true);
});

it("continues after a nonterminal SSE error and resolves on a later complete event", async () => {
	const events: string[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(
					'event: state\ndata: {"name":"example","status":"starting","derived_status":"starting"}\n\n' +
						'event: error\ndata: {"error":"status temporarily unavailable","elapsed":5}\n\n' +
						'event: state\ndata: {"name":"example","status":"running","derived_status":"running"}\n\n' +
						'event: complete\ndata: {"status":"running","elapsed":10,"target":"running"}\n\n',
				),
		),
	);
	const client = createBaseClient({ baseURL: "https://example.test" });
	const state = await watchCvmState(
		client,
		{ id: "cvm-123", target: "running", maxRetries: 0 },
		{ onEvent: (event) => events.push(event.type) },
	);
	expect(state.status).toBe("running");
	expect(events).toEqual(["state", "error", "state", "complete"]);
});

it("does not succeed when a stream ends after a nonterminal SSE error", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(
					'event: state\ndata: {"name":"example","status":"starting","derived_status":"starting"}\n\n' +
						'event: error\ndata: {"error":"status temporarily unavailable","elapsed":5}\n\n' +
						'event: state\ndata: {"name":"example","status":"starting","derived_status":"starting"}\n\n',
				),
		),
	);
	const client = createBaseClient({ baseURL: "https://example.test" });
	await expect(
		watchCvmState(client, { id: "cvm-123", target: "running", maxRetries: 0 }),
	).rejects.toThrow();
});

it("does not follow redirects during watch", async () => {
  let redirect: RequestRedirect | undefined;
  let attempts = 0;
  vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    attempts++;
    redirect = init?.redirect;
    return new Response(null, { status: 302, headers: { location: "https://other.test/" } });
  }));
  const client = createBaseClient({ baseURL: "https://example.test", apiKey: "secret" });
  await expect(watchCvmState(client, { id: "cvm-123", target: "running", maxRetries: 1, retryDelay: 0 })).rejects.toThrow("302");
  expect(redirect).toBe("manual");
  expect(attempts).toBe(1);
});

it("uses the API key rather than the bearer token when both are configured", async () => {
  let headers = new Headers();
  vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    headers = new Headers(init?.headers);
    return new Response('event: state\ndata: {"status":"running","derived_status":"running"}\n\nevent: complete\ndata: {"status":"running","elapsed":1,"target":"running"}\n\n');
  }));
  const client = createBaseClient({ baseURL: "https://example.test", apiKey: "key", bearerToken: "token" });
  await watchCvmState(client, { id: "cvm-123", target: "running", maxRetries: 0 });
  expect(headers.get("x-api-key")).toBe("key");
  expect(headers.get("authorization")).toBeNull();
});

it("accepts the backend derived completion status when raw status differs", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(
    'event: state\ndata: {"id":"cvm-123","name":"example","status":"running","boot_progress":"booting"}\n\n' +
    'event: complete\ndata: {"status":"starting","target":"starting","elapsed":0}\n\n'
  )));
  const client = createBaseClient({ baseURL: "https://example.test" });
  const state = await watchCvmState(client, { id: "cvm-123", target: "starting", maxRetries: 0 });
  expect(state.status).toBe("running");
  expect(state.boot_progress).toBe("booting");
});
