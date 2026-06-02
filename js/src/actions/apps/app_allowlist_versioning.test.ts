/**
 * Tests that app-level allowance and device-allowlist actions parse
 * responses with the correct versioned schema based on client.config.version.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "../../client";
import { checkCvmIsAllowed } from "../cvms/check_cvm_is_allowed";
import { checkAppCvmsIsAllowed } from "./check_app_cvms_is_allowed";
import { getAppDeviceAllowlist } from "./get_app_device_allowlist";

const isAllowedBase = {
  app_contract_address: "0xcontract",
  compose_hash: "abc123",
  device_id: "dev-1",
  compose_hash_allowed: true,
  allow_any_device: false,
  device_id_allowed: true,
  is_allowed: true,
  error: null,
};

describe("App allowance actions — version-based schema selection", () => {
  describe("checkCvmIsAllowed", () => {
    it("v20260522: accepts hashid cvm_id", async () => {
      const client = createClient({ apiKey: "test", version: "2026-05-22" });
      vi.spyOn(client, "post").mockResolvedValue({ ...isAllowedBase, cvm_id: "cvm_ykL5lbAn" });
      const result = await checkCvmIsAllowed(client, { cvmId: "cvm_ykL5lbAn" });
      expect(result.cvm_id).toBe("cvm_ykL5lbAn");
    });

    it("v20260121: accepts numeric cvm_id (0 sentinel)", async () => {
      const client = createClient({ apiKey: "test", version: "2026-01-21" });
      vi.spyOn(client, "post").mockResolvedValue({ ...isAllowedBase, cvm_id: 0 });
      const result = await checkCvmIsAllowed(client, { cvmId: "cvm_ykL5lbAn" });
      expect(result.cvm_id).toBe(0);
    });

    it("v20260522: rejects numeric cvm_id", async () => {
      const client = createClient({ apiKey: "test", version: "2026-05-22" });
      vi.spyOn(client, "post").mockResolvedValue({ ...isAllowedBase, cvm_id: 0 });
      await expect(checkCvmIsAllowed(client, { cvmId: "cvm_ykL5lbAn" })).rejects.toThrow();
    });

    it("v20260121: rejects hashid cvm_id", async () => {
      const client = createClient({ apiKey: "test", version: "2026-01-21" });
      vi.spyOn(client, "post").mockResolvedValue({ ...isAllowedBase, cvm_id: "cvm_ykL5lbAn" });
      await expect(checkCvmIsAllowed(client, { cvmId: "cvm_ykL5lbAn" })).rejects.toThrow();
    });
  });

  describe("checkAppCvmsIsAllowed", () => {
    const batchBase = {
      is_onchain: true,
      total: 1,
      allowed_count: 1,
      denied_count: 0,
      error_count: 0,
    };

    it("v20260522: accepts hashid cvm_ids", async () => {
      const client = createClient({ apiKey: "test", version: "2026-05-22" });
      vi.spyOn(client, "post").mockResolvedValue({
        ...batchBase,
        results: [{ ...isAllowedBase, cvm_id: "cvm_ykL5lbAn" }],
        skipped_cvm_ids: [],
      });
      const result = await checkAppCvmsIsAllowed(client, { appId: "app123" });
      expect(result.results[0].cvm_id).toBe("cvm_ykL5lbAn");
    });

    it("v20260121: accepts numeric cvm_ids (0 sentinel)", async () => {
      const client = createClient({ apiKey: "test", version: "2026-01-21" });
      vi.spyOn(client, "post").mockResolvedValue({
        ...batchBase,
        results: [{ ...isAllowedBase, cvm_id: 0 }],
        skipped_cvm_ids: [0],
      });
      const result = await checkAppCvmsIsAllowed(client, { appId: "app123" });
      expect(result.results[0].cvm_id).toBe(0);
      expect(result.skipped_cvm_ids[0]).toBe(0);
    });
  });

  describe("getAppDeviceAllowlist", () => {
    const allowlistBase = {
      is_onchain_kms: true,
      allow_any_device: false,
      chain_id: 1,
      app_contract_address: "0xcontract",
    };

    it("v20260522: accepts hashid cvm_ids in devices", async () => {
      const client = createClient({ apiKey: "test", version: "2026-05-22" });
      vi.spyOn(client, "get").mockResolvedValue({
        ...allowlistBase,
        devices: [{ device_id: "dev-1", node_name: null, allowed_onchain: true, status: "allowed", cvm_ids: ["cvm_ykL5lbAn"] }],
      });
      const result = await getAppDeviceAllowlist(client, { appId: "app123" });
      expect(result.devices[0].cvm_ids[0]).toBe("cvm_ykL5lbAn");
    });

    it("v20260121: accepts numeric cvm_ids (0 sentinel)", async () => {
      const client = createClient({ apiKey: "test", version: "2026-01-21" });
      vi.spyOn(client, "get").mockResolvedValue({
        ...allowlistBase,
        devices: [{ device_id: "dev-1", node_name: null, allowed_onchain: true, status: "allowed", cvm_ids: [0] }],
      });
      const result = await getAppDeviceAllowlist(client, { appId: "app123" });
      expect(result.devices[0].cvm_ids[0]).toBe(0);
    });
  });
});
