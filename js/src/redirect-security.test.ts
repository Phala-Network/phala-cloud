import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "./client";
import { PhalaCloudError } from "./utils/errors";
import { watchCvmState } from "./actions/cvms/watch_cvm_state";

const key = "redirect-regression-secret";
const statuses = [301, 302, 303, 307, 308];
const methods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const cases = statuses.flatMap((status) => methods.map((method) => ({ status, method })));
let api: Server;
let attacker: Server;
let apiURL: string;
let attackerURL: string;
let streamStatus = 302;
const apiKeys: (string | undefined)[] = [];
const apiBodies: string[] = [];
const attackerKeys: (string | undefined)[] = [];

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

beforeAll(async () => {
  attacker = createServer((request, response) => {
    attackerKeys.push(request.headers["x-api-key"] as string | undefined);
    request.resume();
    response.setHeader("Content-Type", "application/json");
    response.end('{"ok":true}');
  });
  attackerURL = await listen(attacker);
  api = createServer(async (request, response) => {
    apiKeys.push(request.headers["x-api-key"] as string | undefined);
    let body = "";
    for await (const chunk of request) body += chunk.toString();
    apiBodies.push(body);
    if (!request.url?.startsWith("/ok")) {
      response.statusCode = request.url?.startsWith("/redirect/")
        ? Number(request.url.split("/").at(-1))
        : streamStatus;
      response.setHeader("Location", `${attackerURL}/stolen`);
    }
    if (request.headers.accept === "text/event-stream") {
      response.setHeader("Content-Type", "text/event-stream");
      response.end(
        'event: state\ndata: {"status":"running"}\n\nevent: complete\ndata: {"status":"running","elapsed":0,"target":"running"}\n\n',
      );
    } else {
      response.setHeader("Content-Type", "application/json");
      response.end('{"ok":true}');
    }
  });
  apiURL = await listen(api);
});

afterAll(async () => {
  await close(api);
  await close(attacker);
});

beforeEach(() => {
  apiKeys.length = 0;
  apiBodies.length = 0;
  attackerKeys.length = 0;
});

describe("cross-origin redirect credential isolation (real HTTP)", () => {
  it.each(cases)(
    "blocks $method $status, including caller overrides",
    async ({ status, method }) => {
      // Control: the pre-fix fetch default sends X-API-Key to the attacker origin.
      const unsafe = await fetch(`${apiURL}/redirect/${status}`, {
        method,
        headers: { "X-API-Key": key },
      });
      await unsafe.text();
      expect(attackerKeys).toEqual([key]);
      attackerKeys.length = 0;
      const client = createClient({ apiKey: key, baseURL: apiURL, redirect: "follow", retry: 0 });
      await expect(
        client.request(`/redirect/${status}`, { method, redirect: "follow" }),
      ).rejects.toBeInstanceOf(PhalaCloudError);
      const full = await client.requestFull(`/redirect/${status}`, { method, redirect: "follow" });
      expect(full.status).toBe(status);
      expect(full.ok).toBe(false);
      expect(full.headers.get("location")).toBe(`${attackerURL}/stolen`);
      expect(await client.get("/ok")).toEqual({ ok: true });
      expect(apiKeys.every((value) => value === key)).toBe(true);
      expect(attackerKeys).toEqual([]);
    },
  );

  it.each(statuses)("blocks native SSE %i", async (status) => {
    streamStatus = status;
    const client = createClient({ apiKey: key, baseURL: apiURL, redirect: "follow", retry: 0 });
    await expect(
      watchCvmState(client, { id: "cvm-test", target: "running", maxRetries: 1 }),
    ).rejects.toThrow();
    expect(apiKeys).toEqual([key]);
    expect(attackerKeys).toEqual([]);
    // native() bypasses ofetch hooks and must still enforce redirect policy.
    const response = await client.raw.native(`${apiURL}/redirect/${status}`, {
      headers: { "X-API-Key": key },
      redirect: "follow",
    });
    expect(response.status).toBe(status);
    expect(attackerKeys).toEqual([]);
  });

  it("retains authenticated body, safe errors, and successful SSE behavior", async () => {
    const client = createClient({ apiKey: key, baseURL: apiURL, retry: 0 });
    expect(await client.post("/ok", { hello: "world" })).toEqual({ ok: true });
    expect(JSON.parse(apiBodies.at(-1) || "")).toEqual({ hello: "world" });
    expect((await client.safeGet("/redirect/302")).success).toBe(false);
    const state = await watchCvmState(createClient({ apiKey: key, baseURL: `${apiURL}/ok` }), {
      id: "cvm-test",
      target: "running",
      maxRetries: 1,
    });
    expect(state.status).toBe("running");
    expect(apiKeys.every((value) => value === key)).toBe(true);
    expect(attackerKeys).toEqual([]);
  });

  it("rejects redirects outside replaceable response hooks", async () => {
    const client = createClient({
      apiKey: key,
      baseURL: apiURL,
      retry: 0,
      onResponse() {},
    });
    const options = { redirect: "follow" as const, onResponse() {} };
    const calls = [
      () => client.request("/redirect/302", options),
      () => client.get("/redirect/302", options),
      () => client.post("/redirect/302", {}, options),
      () => client.put("/redirect/302", {}, options),
      () => client.patch("/redirect/302", {}, options),
      () => client.delete("/redirect/302", options),
    ];
    for (const call of calls) await expect(call()).rejects.toBeInstanceOf(PhalaCloudError);
    expect((await client.safeGet("/redirect/302", options)).success).toBe(false);
    expect((await client.requestFull("/redirect/302", options)).status).toBe(302);
    expect((await client.raw.raw("/redirect/302", options)).status).toBe(302);
    expect(attackerKeys).toEqual([]);
  });

  it.each(["SSE", "GET-stream", "raw-stream", "full-stream"])(
    "closes %s redirect bodies, leaving raw/full stream inspection to the caller",
    async (mode) => {
      let resolveClosed: () => void = () => {};
      const closed = new Promise<void>((resolve) => {
        resolveClosed = resolve;
      });
      const source = createServer((request, response) => {
        expect(request.headers["x-api-key"]).toBe(key);
        response.on("close", resolveClosed);
        response.writeHead(302, { Location: `${attackerURL}/stolen` });
        response.write("redirect body that never ends");
      });
      const sourceURL = await listen(source);
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const client = createClient({ apiKey: key, baseURL: sourceURL });
        if (mode === "SSE") {
          await expect(
            watchCvmState(client, { id: "cvm-test", target: "running", maxRetries: 1 }),
          ).rejects.toThrow("HTTP 302");
        } else if (mode === "GET-stream") {
          await expect(client.get("/redirect", { responseType: "stream" })).rejects.toMatchObject({
            status: 302,
          });
        } else {
          let stream: ReadableStream<Uint8Array>;
          if (mode === "raw-stream") {
            const response = await client.raw.raw("/redirect", { responseType: "stream" });
            expect(response.status).toBe(302);
            if (!response.body) throw new Error("Missing raw response body");
            stream = response.body;
          } else {
            const response = await client.requestFull<ReadableStream<Uint8Array>>("/redirect", {
              responseType: "stream",
            });
            expect(response.status).toBe(302);
            expect(response.ok).toBe(false);
            stream = response.data;
          }
          // Raw/full callers can still read the redirect body and own its cleanup.
          const reader = stream.getReader();
          try {
            const chunk = await reader.read();
            expect(chunk.done).toBe(false);
            expect(new TextDecoder().decode(chunk.value)).toBe("redirect body that never ends");
          } finally {
            await reader.cancel();
            reader.releaseLock();
          }
        }
        await Promise.race([
          closed,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error("Redirect response remained open")), 1000);
          }),
        ]);
        expect(attackerKeys).toEqual([]);
      } finally {
        clearTimeout(timeout);
        await close(source);
      }
    },
  );

  it("rejects browser-filtered opaque redirects even with replaced response hooks", async () => {
    // Browser Fetch returns a filtered response: status 0, no headers or body.
    // A proxy preserves the native Response interface while modeling those fields.
    const filtered = new Proxy(new Response(null), {
      get(target, property) {
        if (property === "type") return "opaqueredirect";
        if (property === "status") return 0;
        if (property === "ok") return false;
        return Reflect.get(target, property, target);
      },
    });
    const transport = vi.spyOn(globalThis, "fetch").mockResolvedValue(filtered);
    try {
      const client = createClient({ apiKey: key, baseURL: apiURL, retry: 0 });
      const options = { onResponse() {} };
      await expect(client.get("/redirect/302", options)).rejects.toBeInstanceOf(PhalaCloudError);
      await expect(client.requestFull("/redirect/302", options)).rejects.toBeInstanceOf(
        PhalaCloudError,
      );
      expect((await client.safeGet("/redirect/302", options)).success).toBe(false);
    } finally {
      transport.mockRestore();
    }
  });

  it("blocks redirects even when request hooks replace the configured options", async () => {
    const client = createClient({ apiKey: key, baseURL: apiURL, retry: 0 });
    await client.raw.raw("/redirect/307", {
      redirect: "follow",
      ignoreResponseError: true,
      onRequest({ options }) {
        options.redirect = "follow";
      },
    });
    expect(apiKeys).toEqual([key]);
    expect(attackerKeys).toEqual([]);
  });
});
