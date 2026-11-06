import { describe, expect, it, vi } from "vitest";
import type { Client } from "../../client";
import { getCvmUserConfig } from "./get_cvm_user_config";

describe("getCvmUserConfig", () => {
  it("returns the app launch token", async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({
        hostname: "my-cvm",
        ssh_authorized_keys: [],
        default_gateway_domain: null,
        launch_token: "t".repeat(32),
      }),
    } as unknown as Client;

    const result = await getCvmUserConfig(mockClient, { id: "my-cvm" });

    expect(mockClient.get).toHaveBeenCalledWith("/cvms/my-cvm/user_config");
    expect(result.launch_token).toBe("t".repeat(32));
  });
});
