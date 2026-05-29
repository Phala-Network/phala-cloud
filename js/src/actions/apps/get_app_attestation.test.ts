import { beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "../../client";
import { getAppAttestation, safeGetAppAttestation } from "./get_app_attestation";

function buildResponse(chainId: unknown) {
  return {
    app_id: "40c47977fd468f08e82021256be9d86877a176a2",
    contract_address: "0x40c47977fd468f08e82021256be9d86877a176a2",
    kms_info: {
      contract_address: "0x2f83172A49584C017F2B256F0FB2Dca14126Ba9C",
      chain_id: chainId,
      version: "v0.5.7",
      url: "https://kms.example.network",
      gateway_app_id: "0x55760b065A3f1EAbdb1a4d7AbB94950f31B91A84",
      gateway_app_url: "https://gateway.example.network",
      kms_type: "base",
    },
    instances: [],
    kms_guest_agent_info: null,
    gateway_guest_agent_info: null,
    qemu_version: "8.2.2",
  };
}

describe("getAppAttestation", () => {
  let client: Client;

  beforeEach(() => {
    client = new Client({ apiKey: "test-key", baseURL: "https://test-api.example.com" });
  });

  it("parses kms_info.chain_id as a number (backend returns int)", async () => {
    vi.spyOn(client, "get").mockResolvedValue(buildResponse(8453));

    const result = await getAppAttestation(client, { appId: "40c47977fd468f08e82021256be9d86877a176a2" });

    expect(client.get).toHaveBeenCalledWith("/apps/40c47977fd468f08e82021256be9d86877a176a2/attestations");
    expect(result.kms_info.chain_id).toBe(8453);
  });

  it("accepts a null chain_id (no-KMS branch)", async () => {
    vi.spyOn(client, "get").mockResolvedValue(buildResponse(null));

    const result = await safeGetAppAttestation(client, { appId: "app" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kms_info.chain_id).toBeNull();
    }
  });

  it("rejects a string chain_id (guards against the old string schema)", async () => {
    vi.spyOn(client, "get").mockResolvedValue(buildResponse("8453"));

    const result = await safeGetAppAttestation(client, { appId: "app" });

    expect(result.success).toBe(false);
  });
});
