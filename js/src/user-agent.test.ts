import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { defaultUserAgent, type UserAgentRuntime } from "./user-agent";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};

const product = `phala-cloud-sdk-js/${pkg.version}`;

function expectNotLegacy(ua: string): void {
  expect(ua).not.toBe("node");
  expect(ua).not.toBe("undici");
  expect(ua.startsWith("Bun/")).toBe(false);
  expect(ua.startsWith("phala-cli/")).toBe(false);
}

describe("defaultUserAgent", () => {
  test("uses package.json version, not a hand-copied constant", () => {
    const ua = defaultUserAgent({ process: { versions: { node: "20.11.0" } } });
    expect(ua).toBe(`${product} node/20.11.0`);
    expectNotLegacy(ua as string);
  });

  test("detects Deno before Node and Bun", () => {
    const runtime: UserAgentRuntime = {
      Deno: { version: { deno: "2.1.0" } },
      Bun: { version: "1.2.3" },
      process: { versions: { node: "22.0.0" } },
    };
    expect(defaultUserAgent(runtime)).toBe(`${product} deno/2.1.0`);
  });

  test("detects Bun before Node", () => {
    const ua = defaultUserAgent({
      Bun: { version: "1.2.3" },
      process: { versions: { node: "22.0.0" } },
    });
    expect(ua).toBe(`${product} bun/1.2.3`);
    expectNotLegacy(ua as string);
  });

  test("detects Node", () => {
    expect(defaultUserAgent({ process: { versions: { node: "22.14.0" } } })).toBe(
      `${product} node/22.14.0`,
    );
  });

  test("detects Cloudflare Workers as workerd", () => {
    expect(
      defaultUserAgent({ navigator: { userAgent: "Cloudflare-Workers" } }),
    ).toBe(`${product} workerd`);
  });

  test("omits the runtime token when the runtime is unknown", () => {
    expect(defaultUserAgent({})).toBe(product);
    expectNotLegacy(product);
  });

  test("does not set a User-Agent in browsers", () => {
    expect(
      defaultUserAgent({
        window: {},
        document: {},
        process: { versions: { node: "20.0.0" } },
      }),
    ).toBeUndefined();
  });
});
