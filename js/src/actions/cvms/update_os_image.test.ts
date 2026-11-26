import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "../../client";
import { safeUpdateOsImage, updateOsImage } from "./update_os_image";

describe("updateOsImage", () => {
  let mockClient: Client;

  beforeEach(() => {
    mockClient = { patch: vi.fn() } as unknown as Client;
    (mockClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
      message: "OS image update initiated",
      correlation_id: "corr-os-1",
      status: "in_progress",
    });
  });

  it("returns the accepted response with the correlation id", async () => {
    const result = await updateOsImage(mockClient, {
      id: "test-cvm-id",
      os_image_name: "prod-0.3.5",
    });

    expect(mockClient.patch).toHaveBeenCalledWith("/cvms/test-cvm-id/os-image", {
      os_image_name: "prod-0.3.5",
    });
    expect(result.correlation_id).toBe("corr-os-1");
    expect(result.status).toBe("in_progress");
    expect(result.message).toBe("OS image update initiated");
  });

  it("returns the accepted response from the safe variant", async () => {
    const result = await safeUpdateOsImage(mockClient, {
      id: "test-cvm-id",
      os_image_name: "prod-0.3.5",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.correlation_id).toBe("corr-os-1");
  });
});
