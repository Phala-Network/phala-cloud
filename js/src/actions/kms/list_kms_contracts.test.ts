import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "../../client";
import { listKmsContracts, safeListKmsContracts } from "./list_kms_contracts";

const mockContract = {
  id: "kc_abc",
  slug: "phala",
  label: "Phala KMS",
  contract_address: "phala",
  chain_id: 0,
  k256_pubkey: "0x0334c7",
  ca_pubkey: "0xca00",
  node_count: 16,
};

const mockData = { items: [mockContract], total: 1, page: 1, page_size: 20, pages: 1 };

describe("listKmsContracts", () => {
  let client: ReturnType<typeof createClient>;
  let mockGet: any;

  beforeEach(() => {
    client = createClient({ apiKey: "test-api-key", baseURL: "https://api.test.com" });
    mockGet = vi.spyOn(client, "get");
  });

  it("pins the 2026-06-23 version and returns contracts", async () => {
    mockGet.mockResolvedValue(mockData);

    const result = await listKmsContracts(client, { is_onchain: true });

    expect(mockGet).toHaveBeenCalledWith("/kms", {
      params: { is_onchain: true },
      headers: { "X-Phala-Version": "2026-06-23" },
    });
    expect(result.items[0].slug).toBe("phala");
    expect(result.items[0].k256_pubkey).toBe("0x0334c7");
    expect(result.items[0].node_count).toBe(16);
  });

  it("safeListKmsContracts returns a SafeResult", async () => {
    mockGet.mockResolvedValue(mockData);

    const result = await safeListKmsContracts(client);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total).toBe(1);
    }
  });
});
