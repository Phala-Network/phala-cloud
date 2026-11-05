import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "../../client";
import { getCvmAnnotations, updateCvmAnnotations } from "./cvm_annotations";

describe("CVM annotations", () => {
  let mockClient: Client;

  beforeEach(() => {
    mockClient = {
      get: vi.fn().mockResolvedValue({ annotations: { memory_tier: "fast" } }),
      put: vi.fn().mockResolvedValue({ annotations: {} }),
    } as unknown as Client;
  });

  it("reads GET /cvms/{id}/annotations", async () => {
    const result = await getCvmAnnotations(mockClient, { id: "my-cvm" });
    expect(mockClient.get).toHaveBeenCalledWith("/cvms/my-cvm/annotations");
    expect(result.annotations).toEqual({ memory_tier: "fast" });
  });

  it("replaces the whole map with PUT /cvms/{id}/annotations", async () => {
    const result = await updateCvmAnnotations(mockClient, { id: "my-cvm", annotations: {} });
    expect(mockClient.put).toHaveBeenCalledWith("/cvms/my-cvm/annotations", { annotations: {} });
    expect(result.annotations).toEqual({});
  });
});
