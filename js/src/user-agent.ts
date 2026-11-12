import { sdkVersion } from "./version";

/**
 * Runtime view used to build the default User-Agent. Tests pass a stub;
 * production uses globalThis.
 */
export interface UserAgentRuntime {
  Deno?: { version?: { deno?: string } };
  Bun?: { version?: string };
  process?: { versions?: { node?: string } };
  navigator?: { userAgent?: string };
  window?: unknown;
  document?: unknown;
}

function runtimeToken(runtime: UserAgentRuntime): string | undefined {
  // Deno first: Deno (and Supabase Edge) may also expose process / Bun shims.
  const deno = runtime.Deno?.version?.deno;
  if (typeof deno === "string" && deno.length > 0) {
    return `deno/${deno}`;
  }

  const bun = runtime.Bun?.version;
  if (typeof bun === "string" && bun.length > 0) {
    return `bun/${bun}`;
  }

  const node = runtime.process?.versions?.node;
  if (typeof node === "string" && node.length > 0) {
    return `node/${node}`;
  }

  if (runtime.navigator?.userAgent === "Cloudflare-Workers") {
    return "workerd";
  }

  return undefined;
}

/**
 * RFC 9110 product tokens for non-browser runtimes.
 * Browsers return undefined so the client omits User-Agent (a custom UA
 * would force a CORS preflight and the browser would ignore it anyway).
 */
export function defaultUserAgent(
  runtime: UserAgentRuntime = globalThis as UserAgentRuntime,
): string | undefined {
  if (runtime.window !== undefined && runtime.document !== undefined) {
    return undefined;
  }

  const product = "phala-cloud-sdk-js/" + sdkVersion;
  const token = runtimeToken(runtime);
  return token ? `${product} ${token}` : product;
}
