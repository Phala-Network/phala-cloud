import { afterEach, describe, expect, it, vi } from "vitest";
import { createBaseClient, createClient } from "../../index";

afterEach(() => vi.unstubAllGlobals());
import { getCvmGpuStatus, getCvmInfo, safeGetCvmGpuStatus } from "./get_cvm_info";
import { CvmInfoDetailV20261111Schema } from "../../types/cvm_info_v20260121";

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
    const detail = { id: "cvm-123", name: "example", status: "running", resource: {}, gateway: {} };
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
