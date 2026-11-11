import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { createBaseClient, createClient } from "../../index";
import type { GetAppInfoResponse, GetCvmInfoResponse, GetCvmListResponse } from "../../types";

afterEach(() => vi.unstubAllGlobals());
import { getCvmGpuStatus, getCvmInfo, safeGetCvmGpuStatus } from "./get_cvm_info";
import { CvmInfoDetailV20261111Schema } from "../../types/cvm_info_v20260121";

describe("API version activation", () => {
  it("preserves detail and compose through the versioned action", async () => {
    const client = createBaseClient();
    const detail = { id: "cvm-123", name: "example", status: "running", resource: { memory_in_mb: 4096 }, gateway: {}, gpu: { product_id: "H100", gpus: 2, cc_mode: { expected: "on" } }, dapp_dashboard_url: null, syslog_endpoint: "https://example.test/syslog" }; 
    vi.spyOn(client, "get").mockResolvedValueOnce(detail).mockResolvedValueOnce({ ...detail, compose_file: { services: {} } });
    const cpu = await getCvmInfo(client, { cvmId: "cvm-123" });
    expect(cpu.resource.memory_in_mb).toBe(4096);
    expect(cpu.dapp_dashboard_url).toBeNull();
    expect(cpu.syslog_endpoint).toBe(detail.syslog_endpoint);
    expect(cpu.gpu).toEqual(detail.gpu);
    expectTypeOf(cpu).toEqualTypeOf<GetCvmInfoResponse<"2026-11-11">>();
    expectTypeOf(createClient().config.version).toEqualTypeOf<"2026-11-11">();
    expect(cpu).not.toHaveProperty("compose_file");
    expect((await getCvmInfo(client, { cvmId: "cvm-123", include_compose: true })).compose_file).toEqual({ services: {} });
  });
  it("enforces the GPU and integer memory contract in the versioned action", async () => {
    const client = createBaseClient({ version: "2026-11-11" });
    const detail = { id: "cvm-123", name: "example", status: "running", resource: { memory_in_mb: 4096 }, gateway: {} };
    const gpu = { product_id: "H100", gpus: 2, cc_mode: { expected: "devtools" } };
    const nullGpu = { product_id: null, gpus: 1, cc_mode: { expected: "on" } };
    vi.spyOn(client, "get").mockResolvedValueOnce({ ...detail, gpu }).mockResolvedValueOnce({ ...detail, gpu: nullGpu }).mockResolvedValueOnce({ ...detail, resource: { memory_in_mb: 1.5 } }).mockResolvedValueOnce({ ...detail, resource: { memory_in_mb: null } }).mockResolvedValueOnce({ ...detail, resource: {} });
    expect((await getCvmInfo(client, { cvmId: "cvm-123" })).gpu).toEqual(gpu);
    expect((await getCvmInfo(client, { cvmId: "cvm-123" })).gpu).toEqual(nullGpu);
    for (let i = 0; i < 3; i++) await expect(getCvmInfo(client, { cvmId: "cvm-123" })).rejects.toThrow();
  });
  it("dispatches detail parsing and retains other mappings and default", async () => {
    const client = createBaseClient({ version: "2026-11-11" });
    vi.spyOn(client, "get").mockResolvedValue({ id: "cvm-123", name: "example", status: "running", resource: { memory_in_mb: 4096, memory_in_gb: 4 }, gateway: {}, syslog_endpoint: "https://example.test/syslog" });
    const detail = await getCvmInfo(client, { cvmId: "cvm-123" });
    expect(detail.resource).toMatchObject({ memory_in_mb: 4096, memory_in_gb: 4 });
    expect(detail.syslog_endpoint).toBe("https://example.test/syslog");
    expect(createClient().config.version).toBe("2026-11-11");
    expectTypeOf(detail).toEqualTypeOf<GetCvmInfoResponse<"2026-11-11">>();
    expectTypeOf<GetAppInfoResponse<"2026-11-11">>().toEqualTypeOf<GetAppInfoResponse<"2026-06-23">>();
    expectTypeOf<GetCvmListResponse<"2026-11-11">>().toEqualTypeOf<GetCvmListResponse<"2026-06-23">>();
  });
});

describe("GPU status", () => {
  it("returns observed and null statuses through the exported actions", async () => {
    const client = createBaseClient();
    const observed = [{ slot: "0000:01:00.0", cc_mode: "unknown" }];
    const get = vi.spyOn(client, "get").mockResolvedValueOnce({ observed }).mockResolvedValueOnce({ observed: null }).mockResolvedValueOnce({ observed });
    expect(await getCvmGpuStatus(client, { cvmId: "cvm-123" })).toEqual({ observed });
    expect(get).toHaveBeenCalledWith("/cvms/cvm-123/gpu-status");
    expect(await getCvmGpuStatus(client, { cvmId: "cvm-123" })).toEqual({ observed: null });
    expect(await safeGetCvmGpuStatus(client, { cvmId: "cvm-123" })).toEqual({ success: true, data: { observed } });
  });
  it("binds methods and handles HTTP success and errors", async () => {
    const observed = [{ slot: "0000:01:00.0", cc_mode: "on" }];
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ observed })).mockResolvedValueOnce(Response.json({ observed: null })).mockImplementation(async () => Response.json({ detail: "CVM has no GPU" }, { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    const client = createClient({ baseURL: "https://example.test" });
    expect(await client.getCvmGpuStatus({ cvmId: "gpu" })).toEqual({ observed });
    expect(await client.safeGetCvmGpuStatus({ cvmId: "gpu" })).toEqual({ success: true, data: { observed: null } });
    await expect(client.getCvmGpuStatus({ cvmId: "cpu" })).rejects.toMatchObject({ status: 404 });
    const result = await client.safeGetCvmGpuStatus({ cvmId: "cpu" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatchObject({ status: 404 });
  });
});

describe("CVM compose opt-in", () => {
  it("forwards true and false and omits an unspecified option", async () => {
    const client = createBaseClient();
    const detail = { id: "cvm-123", name: "example", status: "running", resource: { memory_in_mb: 4096 }, gateway: {} };
    const get = vi.spyOn(client, "get").mockResolvedValue(detail);
    await getCvmInfo(client, { cvmId: "cvm-123" });
    await getCvmInfo(client, { cvmId: "cvm-123", include_compose: true });
    await getCvmInfo(client, { cvmId: "cvm-123", include_compose: false });
    expect(get).toHaveBeenNthCalledWith(1, "/cvms/cvm-123");
    expect(get).toHaveBeenNthCalledWith(2, "/cvms/cvm-123", { params: { include_compose: true } });
    expect(get).toHaveBeenNthCalledWith(3, "/cvms/cvm-123", { params: { include_compose: false } });
  });
});

describe("2026-11-11 CVM detail schema", () => {
  it("requires integer MB and preserves both memory fields", () => {
    const detail = { id: "cvm-123", name: "example", status: "running", gateway: {} };
    const resource = { memory_in_mb: 4096, memory_in_gb: 4 };
    expect(CvmInfoDetailV20261111Schema.parse({ ...detail, resource }).resource).toEqual(resource);
    expect(CvmInfoDetailV20261111Schema.parse({ ...detail, resource: { memory_in_mb: 4096 } }).resource).toEqual({ memory_in_mb: 4096 });
    for (const memory_in_mb of [undefined, null, 1.5]) {
      expect(() => CvmInfoDetailV20261111Schema.parse({ ...detail, resource: { memory_in_mb } })).toThrow();
    }
  });
  it("preserves GPU details including a null product ID", () => {
    const detail = { id: "cvm-123", name: "example", status: "running", resource: { memory_in_mb: 4096 }, gateway: {} };
    for (const product_id of ["H100", null]) {
      const gpu = { product_id, gpus: 2, cc_mode: { expected: "devtools" } };
      expect(CvmInfoDetailV20261111Schema.parse({ ...detail, gpu }).gpu).toEqual(gpu);
    }
    expect(CvmInfoDetailV20261111Schema.parse(detail)).not.toHaveProperty("gpu");
  });

  it("parses the base detail fields", () => {
    const detail = {
      id: "cvm-123",
      name: "example",
      status: "running",
      resource: { memory_in_mb: 4096 },
      gateway: {},
      dapp_dashboard_url: null,
      syslog_endpoint: "https://example.test/syslog",
    };
    expect(CvmInfoDetailV20261111Schema.parse(detail)).toMatchObject(detail);
  });
});
