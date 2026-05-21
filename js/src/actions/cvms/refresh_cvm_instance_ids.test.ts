import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../../client";
import {
  refreshCvmInstanceIds,
  safeRefreshCvmInstanceIds,
} from "./refresh_cvm_instance_ids";

describe("refreshCvmInstanceIds", () => {
  const mockResponse = {
    total: 2,
    scanned: 2,
    updated: 1,
    unchanged: 1,
    skipped: 0,
    conflicts: 0,
    errors: 0,
    items: [
      {
        cvm_id: "cvm_101",
        identifier: "101",
        status: "updated" as const,
        old_instance_id: null,
        new_instance_id: "inst-abc",
        source: "gateway" as const,
        verified_with_gateway: true,
        reason: null,
      },
      {
        cvm_id: "cvm_102",
        identifier: "102",
        status: "unchanged" as const,
        old_instance_id: "inst-def",
        new_instance_id: "inst-def",
        source: "teepod_state" as const,
        verified_with_gateway: false,
        reason: "already_synced",
      },
    ],
  };

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
  });

  it("safe action returns success", async () => {
    mockPatch.mockResolvedValue(mockResponse);

    const result = await safeRefreshCvmInstanceIds(client, {
      cvm_ids: ["101"],
    });

    expect(result.success).toBe(true);
  });
});
