import { describe, expect, it, vi } from "vitest";
import type { Client } from "../../client";
import { putCvmInitScripts } from "./put_cvm_init_scripts";

describe("putCvmInitScripts", () => {
  it("sends PUT /cvms/{id}/init-scripts", async () => {
    const mockClient = {
      put: vi.fn().mockResolvedValue({ correlation_id: "corr-1", status: "in_progress" }),
    } as unknown as Client;

    const result = await putCvmInitScripts(mockClient, {
      id: "my-cvm",
      scripts: ["echo custom\n"],
    });

    expect(mockClient.put).toHaveBeenCalledWith(
      "/cvms/my-cvm/init-scripts",
      { scripts: ["echo custom\n"] },
    );
    expect(result).toEqual({ requiresOnChainHash: false, correlationId: "corr-1" });
  });

  it("allows an empty list to clear scripts", async () => {
    const mockClient = {
      put: vi.fn().mockResolvedValue({ status: "no_change" }),
    } as unknown as Client;

    const result = await putCvmInitScripts(mockClient, { id: "my-cvm", scripts: [] });

    expect(mockClient.put).toHaveBeenCalledWith("/cvms/my-cvm/init-scripts", { scripts: [] });
    expect(result.requiresOnChainHash).toBe(false);
    expect(result.correlationId).toBe("");
  });
});
