import { describe, expect, it, vi } from "vitest";
import type { Client } from "../../client";
import { getManagedInitScripts } from "./get_managed_init_scripts";

describe("getManagedInitScripts", () => {
  it("reads GET /managed-init-scripts", async () => {
    const items = [
      {
        name: "future_script",
        version: "0.0.3",
        script: "echo hi",
        hash: "aaa",
        request_field: "init_scripts",
        min_os_version: "0.6.0",
      },
    ];
    const mockClient = {
      get: vi.fn().mockResolvedValue({ items }),
    } as unknown as Client;

    const result = await getManagedInitScripts(mockClient);

    expect(mockClient.get).toHaveBeenCalledWith("/managed-init-scripts");
    expect(result.items).toEqual(items);
  });
});
