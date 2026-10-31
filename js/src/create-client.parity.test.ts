import { afterEach, expect, expectTypeOf, it, vi } from "vitest";
import type { Client as BaseClient } from "./client";
import type { GetAppInfoResponse, RefreshCvmInstanceIdResponse } from "./types/version-mappings";
import type { CvmSshKeysResponse } from "./actions/ssh_keys/get_cvm_ssh_keys";
import { z } from "zod";
import * as namedActions from "./actions";
import { createClient, createBaseClient, getCvmInfo, type ApiVersion } from "./index";

function checkGenericVersion<V extends ApiVersion>(version: V) {
  const base = createBaseClient({ version });
  const full = createClient({ version });
  const baseVersion: V = base.config.version;
  const fullVersion: V = full.config.version;
  const appInfo: (request: { appId: string }) => Promise<GetAppInfoResponse<V>> = full.getAppInfo;
  void [baseVersion, fullVersion, appInfo];
}
void checkGenericVersion;

const missingActions = [
  "getWorkspaceNodes", "safeGetWorkspaceNodes", "getWorkspaceQuotas", "safeGetWorkspaceQuotas",
  "replicateCvm", "safeReplicateCvm", "watchCvmState", "patchCvm", "safePatchCvm",
  "confirmCvmPatch", "safeConfirmCvmPatch", "commitCvmUpdate", "safeCommitCvmUpdate",
  "refreshCvmInstanceId", "safeRefreshCvmInstanceId", "refreshCvmInstanceIds", "safeRefreshCvmInstanceIds",
  "getCvmStatusBatch", "safeGetCvmStatusBatch", "getCvmUserConfig", "safeGetCvmUserConfig",
  "getCvmSshKeys", "safeGetCvmSshKeys", "updateCvmSshKeys", "safeUpdateCvmSshKeys",
  "revokeCurrentApiToken", "safeRevokeCurrentApiToken", "checkCvmIsAllowed", "safeCheckCvmIsAllowed",
  "checkAppIsAllowed", "safeCheckAppIsAllowed", "checkAppCvmsIsAllowed", "safeCheckAppCvmsIsAllowed",
  "getAppList", "safeGetAppList", "getAppInfo", "safeGetAppInfo", "getAppCvms", "safeGetAppCvms",
  "createAppInstance", "safeCreateAppInstance", "getAppDeviceAllowlist", "safeGetAppDeviceAllowlist",
  "getAppRevisions", "safeGetAppRevisions", "getAppRevisionDetail", "safeGetAppRevisionDetail",
  "getAppFilterOptions", "safeGetAppFilterOptions", "getAppAttestation", "safeGetAppAttestation",
  "addComposeHash", "safeAddComposeHash", "deployAppAuth", "safeDeployAppAuth", "addDevice", "safeAddDevice",
  "removeDevice", "safeRemoveDevice", "setAllowAnyDevice", "safeSetAllowAnyDevice", "getAllowedDevices",
  "safeGetAllowedDevices", "checkDeviceAllowed", "safeCheckDeviceAllowed", "checkComposeHashAllowed",
  "safeCheckComposeHashAllowed", "checkOnChainPrerequisites", "safeCheckOnChainPrerequisites",
] as const;

afterEach(() => vi.unstubAllGlobals());

it("exposes every missing named action on the default client and its version clone", () => {
  const client = createClient();
  const exportedFunctions = Object.entries(namedActions)
    .filter(([name, value]) => /^[a-z]/.test(name) && typeof value === "function")
    .map(([name]) => name);
  for (const instance of [client, client.withVersion("2025-10-28")]) {
    for (const name of [...missingActions, ...exportedFunctions]) expect(typeof Reflect.get(instance, name), name).toBe("function");
  }
});

it.each(["x-phala-version", "X-PHALA-VERSION"])("uses the selected version for ordinary requests despite %s", async headerName => {
  const versions: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    versions.push(new Headers(init?.headers).get("x-phala-version") ?? "missing");
    return Response.json({ ok: true });
  }));
  const client = createClient({ baseURL: "https://example.test", version: "2026-05-22", headers: { [headerName]: "2026-06-23" } });
  await client.get("/test");
  await client.withVersion("2025-10-28").get("/test");
  expect(versions).toEqual(["2026-05-22", "2025-10-28"]);
});

it("preserves the intentional per-request API version pin for legacy KMS actions", async () => {
  let version: string | null = null;
  vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    version = new Headers(init?.headers).get("x-phala-version");
    return Response.json({ items: [], total: 0, page: 1, page_size: 10, pages: 0 });
  }));
  const client = createClient({ baseURL: "https://example.test", version: "2026-06-23", headers: { "x-phala-version": "2025-10-28" } });
  await client.getKmsList();
  expect(version).toBe("2026-05-22");
});

it("preserves existing bound actions and transport on version clones", async () => {
  let version: string | null = null;
  vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    version = new Headers(init?.headers).get("x-phala-version");
    return Response.json({ hello: "world" });
  }));
  const client = createClient({ baseURL: "https://example.test" }).withVersion("2025-10-28");
  expect(await client.getCurrentUser({ schema: false })).toEqual({ hello: "world" });
  expect(version).toBe("2025-10-28");
});

it("rebinds chained custom actions and factories when switching versions", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
    Response.json({ version: new Headers(init?.headers).get("x-phala-version") })));
  const original = createClient({ baseURL: "https://example.test" })
    .extend({ readVersion: (client: BaseClient) => client.get<{ version: string }>("/version") })
    .extend(client => ({ configVersion: () => client.config.version, info: () => getCvmInfo(client, { id: "cvm-123" }) }));
  expectTypeOf(original.configVersion).returns.toEqualTypeOf<ApiVersion>();
  const clone = original.withVersion("2025-10-28");
  expect(await clone.readVersion()).toEqual({ version: "2025-10-28" });
  expect(clone.configVersion()).toBe("2025-10-28");
  expect(await original.readVersion()).toEqual({ version: "2026-06-23" });
  expectTypeOf(clone.config.version).toEqualTypeOf<"2025-10-28">();
  expectTypeOf(clone.configVersion).returns.toEqualTypeOf<unknown>();
  expectTypeOf(clone.info).returns.toEqualTypeOf<unknown>();
  expectTypeOf(clone.readVersion).returns.toEqualTypeOf<unknown>();
  const twice = clone.withVersion("2026-01-21");
  expect(twice.configVersion()).toBe("2026-01-21");
  expectTypeOf(twice.configVersion).returns.toEqualTypeOf<unknown>();
  expectTypeOf(twice.info).returns.toEqualTypeOf<unknown>();
  if (false) {
    expectTypeOf(clone.configVersion()).toEqualTypeOf<unknown>();
    expectTypeOf(twice.configVersion()).toEqualTypeOf<unknown>();
    expectTypeOf(twice.info()).toEqualTypeOf<unknown>();
  }
  expectTypeOf(clone.getAppInfo).returns.toEqualTypeOf<Promise<GetAppInfoResponse<"2025-10-28">>>();
  if (false) {
    expectTypeOf(clone.getCvmSshKeys({ id: "cvm-123" })).toEqualTypeOf<Promise<CvmSshKeysResponse>>();
    expectTypeOf(clone.getCvmSshKeys({ id: "cvm-123" }, { schema: z.string() })).toEqualTypeOf<Promise<string>>();
    expectTypeOf(clone.safeGetCvmSshKeys({ id: "cvm-123" }, { schema: z.string() })).toEqualTypeOf<Promise<import("./types/client").SafeResult<string>>>();
  }
});

it("preserves extensions on the base client and through repeated version switches", () => {
  const original = createBaseClient({ baseURL: "https://example.test" })
    .extend({ first: (client: BaseClient) => client.config.version })
    .extend({ second: (client: BaseClient, suffix: string) => `${client.config.version}:${suffix}` });
  const switched = original.withVersion("2025-10-28").withVersion("2026-01-21");
  expect(switched.first()).toBe("2026-01-21");
  expect(switched.second("x")).toBe("2026-01-21:x");
  expectTypeOf(switched.config.version).toEqualTypeOf<"2026-01-21">();
});

it("exposes typed refresh actions on versioned clients", async () => {
  const requests: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) => {
    requests.push(String(url));
    return Response.json({ identifier: "cvm-123", status: "unchanged", source: "none", verified_with_gateway: false, cvm_id: "cvm-123" });
  }));
  const client = createClient({ baseURL: "https://example.test" }).withVersion("2026-05-22");
  expectTypeOf(client.refreshCvmInstanceId).returns.toEqualTypeOf<Promise<RefreshCvmInstanceIdResponse<ApiVersion>>>();
  expectTypeOf(client.safeRefreshCvmInstanceId).returns.toEqualTypeOf<Promise<import("./types/client").SafeResult<RefreshCvmInstanceIdResponse<ApiVersion>>>>();
  const result = await client.refreshCvmInstanceId({ id: "cvm-123" });
  expect(result.cvm_id).toBe("cvm-123");
  expect((await client.safeRefreshCvmInstanceId({ id: "cvm-123" })).success).toBe(true);
  expect(requests).toEqual(["https://example.test/cvms/cvm-123/instance-id", "https://example.test/cvms/cvm-123/instance-id"]);
});

it("passes requests and schema parameters to newly bound SSH actions", async () => {
  const urls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) => {
    urls.push(String(url));
    return Response.json({ keys: [], restart_required: false, extra: "wire" });
  }));
  const client = createClient({ baseURL: "https://example.test" });
  expect(await client.getCvmSshKeys({ id: "cvm-123" })).toEqual({ keys: [], restart_required: false });
  expect(await client.safeGetCvmSshKeys({ id: "cvm-123" }, { schema: false })).toEqual({ success: true, data: { keys: [], restart_required: false, extra: "wire" } });
  expect(urls).toEqual(["https://example.test/cvms/cvm-123/ssh-keys", "https://example.test/cvms/cvm-123/ssh-keys"]);
});

it("retains standalone on-chain action signatures without injecting a cloud client", async () => {
  const client = createClient();
  const request = { appAddress: "0x0000000000000000000000000000000000000000" as const, deviceId: "0x00" };
  await expect(client.checkDeviceAllowed(request)).rejects.toThrow("Chain is required");
  expect(await client.safeCheckDeviceAllowed(request)).toMatchObject({ success: false, error: { message: "Chain is required when publicClient is not provided" } });
});

it("binds safe and ordinary token actions to the cloned transport", async () => {
  const requests: Array<{ url: string; method: string; version: string | null }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(url), method: init?.method ?? "GET", version: new Headers(init?.headers).get("x-phala-version") });
    return new Response(null, { status: 204 });
  }));
  const client = createClient({ baseURL: "https://example.test", apiKey: "key" }).withVersion("2025-10-28");
  await client.revokeCurrentApiToken();
  expect((await client.safeRevokeCurrentApiToken()).success).toBe(true);
  expect(requests).toEqual([
    { url: "https://example.test/tokens/self", method: "DELETE", version: "2025-10-28" },
    { url: "https://example.test/tokens/self", method: "DELETE", version: "2025-10-28" },
  ]);
});

it("withVersion clones keep event listeners registered on the original client", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ detail: "boom" }, { status: 500 })));
  const original = createClient({ baseURL: "https://example.test" });
  const seen: string[] = [];
  original.on("error", () => seen.push("original"));
  await original.safeGet("/x");
  await original.withVersion("2025-10-28").safeGet("/x");
  await original.withVersion("2025-10-28").withVersion("2026-01-21").safeGet("/x");
  expect(seen).toEqual(["original", "original", "original"]);
});
