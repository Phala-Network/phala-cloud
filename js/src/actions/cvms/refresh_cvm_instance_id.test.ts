import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../../client";
import {
  refreshCvmInstanceId,
  safeRefreshCvmInstanceId,
} from "./refresh_cvm_instance_id";

describe("refreshCvmInstanceId", () => {
  const mockResponseV20260522 = {
    cvm_id: "cvm_101",
    identifier: "101",
    status: "updated" as const,
    old_instance_id: null,
    new_instance_id: "inst-abc",
    source: "gateway" as const,
    verified_with_gateway: true,
    reason: null,
  };

  const mockResponseV20260121 = {
    cvm_id: 0,
    identifier: "101",
    status: "updated" as const,
    old_instance_id: null,
    new_instance_id: "inst-abc",
    source: "gateway" as const,
    verified_with_gateway: true,
    reason: null,
  };

  describe("v20260522 (hashid CVM IDs)", () => {
    let client: ReturnType<typeof createClient>;
    let mockPatch: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      client = createClient({
        apiKey: "test-api-key",
        baseURL: "https://api.test.com",
        version: "2026-05-22",
      });
      mockPatch = vi.spyOn(client, "patch");
    });

    it("should patch correct endpoint with body", async () => {
      mockPatch.mockResolvedValue(mockResponseV20260522);

      const result = await refreshCvmInstanceId(client, {
        id: "101",
        overwrite: true,
        dry_run: false,
      });

      expect(mockPatch).toHaveBeenCalledWith("/cvms/101/instance-id", {
        overwrite: true,
        dry_run: false,
      });
      expect(result.cvm_id).toBe("cvm_101");
    });

    it("safe action returns success", async () => {
      mockPatch.mockResolvedValue(mockResponseV20260522);

      const result = await safeRefreshCvmInstanceId(client, { id: "101" });

      expect(result.success).toBe(true);
    });

    it("accepts skipped results without a resolved CVM ID", async () => {
      const skippedResponse = {
        ...mockResponseV20260522,
        cvm_id: null,
        status: "skipped" as const,
        reason: "invalid_identifier",
      };
      mockPatch.mockResolvedValue(skippedResponse);

      const result = await refreshCvmInstanceId(client, { id: "101" });

      expect(result.cvm_id).toBeNull();
    });
  });

  describe("v20260121 (numeric CVM IDs — returns 0 sentinel)", () => {
    let client: ReturnType<typeof createClient>;
    let mockPatch: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      client = createClient({
        apiKey: "test-api-key",
        baseURL: "https://api.test.com",
        version: "2026-01-21",
      });
      mockPatch = vi.spyOn(client, "patch");
    });

    it("parses numeric cvm_id (0 sentinel for pre-hashid API)", async () => {
      mockPatch.mockResolvedValue(mockResponseV20260121);

      const result = await refreshCvmInstanceId(client, { id: "101" });

      expect(result.cvm_id).toBe(0);
    });

    it("rejects hashid cvm_id for v20260121 clients", async () => {
      mockPatch.mockResolvedValue(mockResponseV20260522);

      await expect(refreshCvmInstanceId(client, { id: "101" })).rejects.toThrow();
    });
  });
});
