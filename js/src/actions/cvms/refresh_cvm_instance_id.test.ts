import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../../client";
import {
  refreshCvmInstanceId,
  safeRefreshCvmInstanceId,
} from "./refresh_cvm_instance_id";

describe("refreshCvmInstanceId", () => {
  const mockResponse = {
    cvm_id: "cvm_101",
    identifier: "101",
    status: "updated" as const,
    old_instance_id: null,
    new_instance_id: "inst-abc",
    source: "gateway" as const,
    verified_with_gateway: true,
    reason: null,
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

  it("should patch correct endpoint with body", async () => {
    mockPatch.mockResolvedValue(mockResponse);

    const result = await refreshCvmInstanceId(client, {
      id: "101",
      overwrite: true,
      dry_run: false,
    });

    expect(mockPatch).toHaveBeenCalledWith("/cvms/101/instance-id", {
      overwrite: true,
      dry_run: false,
    });
    expect(result).toEqual(mockResponse);
  });

  it("safe action returns success", async () => {
    mockPatch.mockResolvedValue(mockResponse);

    const result = await safeRefreshCvmInstanceId(client, { id: "101" });

    expect(result.success).toBe(true);
  });

  it("accepts skipped results without a resolved CVM ID", async () => {
    const skippedResponse = {
      ...mockResponse,
      cvm_id: null,
      status: "skipped" as const,
      reason: "invalid_identifier",
    };
    mockPatch.mockResolvedValue(skippedResponse);

    const result = await refreshCvmInstanceId(client, { id: "101" });

    expect(result.cvm_id).toBeNull();
  });
});
