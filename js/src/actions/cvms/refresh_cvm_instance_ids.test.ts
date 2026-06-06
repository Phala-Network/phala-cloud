import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../../client";
import {
  refreshCvmInstanceIds,
  safeRefreshCvmInstanceIds,
} from "./refresh_cvm_instance_ids";

const baseResponseFields = {
  total: 2,
  scanned: 2,
  updated: 1,
  unchanged: 1,
  skipped: 0,
  conflicts: 0,
  errors: 0,
};

const itemBase = {
  identifier: "101",
  status: "updated" as const,
  old_instance_id: null,
  new_instance_id: "inst-abc",
  source: "gateway" as const,
  verified_with_gateway: true,
  reason: null,
};

describe("refreshCvmInstanceIds", () => {
  describe("v20260522 (hashid CVM IDs)", () => {
    let client: ReturnType<typeof createClient>;
    let mockPatch: ReturnType<typeof vi.spyOn>;

    const mockResponse = {
      ...baseResponseFields,
      items: [
        { ...itemBase, cvm_id: "cvm_101" },
        { ...itemBase, cvm_id: null, identifier: "102", status: "skipped" as const },
      ],
    };

    beforeEach(() => {
      client = createClient({
        apiKey: "test-api-key",
        baseURL: "https://api.test.com",
        version: "2026-05-22",
      });
      mockPatch = vi.spyOn(client, "patch");
    });

    it("should patch batch endpoint", async () => {
      mockPatch.mockResolvedValue(mockResponse);

      const result = await refreshCvmInstanceIds(client, {
        cvm_ids: ["101", "102"],
        dry_run: true,
        running_only: true,
      });

      expect(mockPatch).toHaveBeenCalledWith("/cvms/instance-ids", {
        cvm_ids: ["101", "102"],
        dry_run: true,
        running_only: true,
      });
      expect(result.total).toBe(2);
      expect(result.items[0].cvm_id).toBe("cvm_101");
    });

    it("safe action returns success", async () => {
      mockPatch.mockResolvedValue(mockResponse);

      const result = await safeRefreshCvmInstanceIds(client, { cvm_ids: ["101"] });

      expect(result.success).toBe(true);
    });
  });

  describe("v20260121 (numeric CVM IDs — returns 0 sentinel)", () => {
    let client: ReturnType<typeof createClient>;
    let mockPatch: ReturnType<typeof vi.spyOn>;

    const mockResponse = {
      ...baseResponseFields,
      items: [
        { ...itemBase, cvm_id: 0 },
        { ...itemBase, cvm_id: null, identifier: "102", status: "skipped" as const },
      ],
    };

    beforeEach(() => {
      client = createClient({
        apiKey: "test-api-key",
        baseURL: "https://api.test.com",
        version: "2026-01-21",
      });
      mockPatch = vi.spyOn(client, "patch");
    });

    it("parses numeric cvm_id (0 sentinel) for v20260121", async () => {
      mockPatch.mockResolvedValue(mockResponse);

      const result = await refreshCvmInstanceIds(client, { cvm_ids: ["101"] });

      expect(result.items[0].cvm_id).toBe(0);
    });

    it("rejects hashid cvm_id for v20260121 clients", async () => {
      const hashidResponse = {
        ...baseResponseFields,
        items: [{ ...itemBase, cvm_id: "cvm_101" }],
      };
      mockPatch.mockResolvedValue(hashidResponse);

      await expect(refreshCvmInstanceIds(client, { cvm_ids: ["101"] })).rejects.toThrow();
    });
  });
});
