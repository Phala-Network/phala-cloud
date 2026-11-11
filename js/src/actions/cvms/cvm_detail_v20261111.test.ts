import { describe, expect, it } from "vitest";
import { CvmInfoDetailV20261111Schema } from "../../types/cvm_info_v20260121";

describe("2026-11-11 CVM detail schema", () => {
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
