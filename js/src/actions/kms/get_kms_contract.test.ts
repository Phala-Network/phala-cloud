import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "../../client";
import { getKmsContract, safeGetKmsContract } from "./get_kms_contract";

const mockContract = {
  id: "kc_abc",
  slug: "base",
  label: "Base KMS",
  contract_address: "0x2f83172A49584C017F2B256F0FB2Dca14126Ba9C",
  chain_id: 8453,
  k256_pubkey: "0x02a335",
  ca_pubkey: "0xca01",
  node_count: 11,
};

describe("getKmsContract", () => {
  let client: ReturnType<typeof createClient>;
  let mockGet: any;

  beforeEach(() => {
    client = createClient({ apiKey: "test-api-key", baseURL: "https://api.test.com" });
    mockGet = vi.spyOn(client, "get");
  });

  it("resolves by slug and pins the 2026-06-23 version", async () => {
    mockGet.mockResolvedValue(mockContract);

    const result = await getKmsContract(client, { slug: "base" });

    expect(mockGet).toHaveBeenCalledWith("/kms/base", {
      headers: { "X-Phala-Version": "2026-06-23" },
    });
    expect(result.slug).toBe("base");
    expect(result.chain_id).toBe(8453);
  });

  it("safeGetKmsContract returns a SafeResult", async () => {
    mockGet.mockResolvedValue(mockContract);

    const result = await safeGetKmsContract(client, { slug: "base" });

    expect(result.success).toBe(true);
  });
});
