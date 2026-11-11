import { describe, expect, it, vi } from "vitest";
import { createBaseClient } from "../../index";
import { getCvmInfo } from "./get_cvm_info";
import { CvmInfoDetailV20261111Schema } from "../../types/cvm_info_v20260121";

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
  it("preserves GPU details including a null product ID", () => {
    const detail = { id: "cvm-123", name: "example", status: "running", resource: {}, gateway: {} };
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
      resource: {},
      gateway: {},
      dapp_dashboard_url: null,
      syslog_endpoint: "https://example.test/syslog",
    };
    expect(CvmInfoDetailV20261111Schema.parse(detail)).toMatchObject(detail);
  });
});
