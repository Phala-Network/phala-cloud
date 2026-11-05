import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "../../client";
import { PhalaCloudError } from "../../utils/errors";
import { safeUpdateCvmVisibility, updateCvmVisibility } from "./update_cvm_visibility";

describe("updateCvmVisibility", () => {
  let mockClient: Client;

  beforeEach(() => {
    mockClient = { patch: vi.fn() } as unknown as Client;
  });

  it("sends the visibility flags to the unified PATCH endpoint", async () => {
    (mockClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
      message: "CVM update initiated",
      correlation_id: "corr-123",
      status: "in_progress",
    });

    const result = await updateCvmVisibility(mockClient, {
      id: "test-cvm-id",
      public_sysinfo: true,
      public_logs: false,
      public_tcbinfo: true,
    });

    expect(mockClient.patch).toHaveBeenCalledWith("/cvms/test-cvm-id", {
      public_sysinfo: true,
      public_logs: false,
      public_tcbinfo: true,
    });
    expect(result.correlation_id).toBe("corr-123");
  });

  it("omits public_tcbinfo when it is not set", async () => {
    (mockClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "no_change",
      message: "Compose configuration unchanged",
      correlation_id: "",
    });

    await updateCvmVisibility(mockClient, {
      id: "test-cvm-id",
      public_sysinfo: false,
      public_logs: true,
    });

    expect(mockClient.patch).toHaveBeenCalledWith("/cvms/test-cvm-id", {
      public_sysinfo: false,
      public_logs: true,
    });
  });

  it("propagates 465 so callers can register the compose hash and retry", async () => {
    const error = new PhalaCloudError("Compose hash registration required", {
      status: 465,
      statusText: "Hash Registration Required",
      detail: { details: [{ field: "compose_hash", value: "abc" }] },
    });
    (mockClient.patch as ReturnType<typeof vi.fn>).mockRejectedValue(error);

    const result = await safeUpdateCvmVisibility(mockClient, {
      id: "test-cvm-id",
      public_sysinfo: true,
      public_logs: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect((result.error as PhalaCloudError).status).toBe(465);
    }
  });
});
