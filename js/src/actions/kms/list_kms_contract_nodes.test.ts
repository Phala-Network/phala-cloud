import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "../../client";
import { listKmsContractNodes, safeListKmsContractNodes } from "./list_kms_contract_nodes";

const mockData = {
  items: [
    {
      id: "kms_1",
      slug: "phala-prod3",
      url: "https://kms.dstack-pha-prod3.phala.network",
      version: "0.5.7",
      kms_type: "phala",
    },
  ],
  total: 1,
};

describe("listKmsContractNodes", () => {
  let client: ReturnType<typeof createClient>;
  let mockGet: any;

  beforeEach(() => {
    client = createClient({ apiKey: "test-api-key", baseURL: "https://api.test.com" });
    mockGet = vi.spyOn(client, "get");
  });

  it("lists nodes with RPC url and pins the 2026-06-23 version", async () => {
    mockGet.mockResolvedValue(mockData);

    const result = await listKmsContractNodes(client, { slug: "phala" });

    expect(mockGet).toHaveBeenCalledWith("/kms/phala/nodes", {
      headers: { "X-Phala-Version": "2026-06-23" },
    });
    expect(result.items[0].url).toBe("https://kms.dstack-pha-prod3.phala.network");
    expect(result.total).toBe(1);
  });

  it("safeListKmsContractNodes returns a SafeResult", async () => {
    mockGet.mockResolvedValue(mockData);

    const result = await safeListKmsContractNodes(client, { slug: "phala" });

    expect(result.success).toBe(true);
  });
});
