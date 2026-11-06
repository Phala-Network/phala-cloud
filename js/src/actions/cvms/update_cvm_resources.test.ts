import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "../../client";
import { updateCvmResources } from "./update_cvm_resources";

describe("updateCvmResources", () => {
  let mockClient: Client;

  beforeEach(() => {
    mockClient = { patch: vi.fn() } as unknown as Client;
    (mockClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
      message: "CVM update initiated",
      correlation_id: "corr-123",
      status: "in_progress",
    });
  });

  it("sends only the resource fields the unified PATCH endpoint accepts", async () => {
    await updateCvmResources(mockClient, {
      id: "test-cvm-id",
      vcpu: 4,
      memory: 8192,
      disk_size: 50,
      instance_type: "tdx.medium",
      allow_restart: true,
    });

    expect(mockClient.patch).toHaveBeenCalledWith("/cvms/test-cvm-id", {
      vcpu: 4,
      memory: 8192,
      disk_size: 50,
      instance_type: "tdx.medium",
    });
  });
});
