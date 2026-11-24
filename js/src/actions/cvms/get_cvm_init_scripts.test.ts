import { describe, expect, it, vi } from "vitest";
import type { Client } from "../../client";
import { getCvmInitScripts } from "./get_cvm_init_scripts";

describe("getCvmInitScripts", () => {
  it("reads GET /cvms/{id}/init-scripts", async () => {
    const items = [
      { slug: "docker_cleanup", selected: true, selectable: true, reason: null },
      {
        slug: "env_merge",
        selected: false,
        selectable: false,
        reason: "Env merge requires dstack OS 0.6.0 or newer",
      },
    ];
    const mockClient = {
      get: vi.fn().mockResolvedValue({ items, has_custom_scripts: false }),
    } as unknown as Client;

    const result = await getCvmInitScripts(mockClient, { id: "my-cvm" });

    expect(mockClient.get).toHaveBeenCalledWith("/cvms/my-cvm/init-scripts");
    expect(result.items).toEqual(items);
    expect(result.has_custom_scripts).toBe(false);
  });

  it("parses slugs it does not know yet", async () => {
    const items = [
      { slug: "runtime_tmpfs", selected: true, selectable: true, reason: null },
      { slug: "future_script", selected: false, selectable: false, reason: null },
    ];
    const mockClient = {
      get: vi.fn().mockResolvedValue({ items, has_custom_scripts: false }),
    } as unknown as Client;

    const result = await getCvmInitScripts(mockClient, { id: "my-cvm" });

    expect(result.items.map((item) => item.slug)).toEqual(["runtime_tmpfs", "future_script"]);
  });
});
