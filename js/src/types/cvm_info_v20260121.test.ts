import { describe, expect, it } from "vitest";
import {
  CvmInfoDetailV20260121Schema,
  CvmInfoDetailV20260522Schema,
  CvmInfoDetailV20261111Schema,
} from "./cvm_info_v20260121";

const KMS_INFO = {
  chain_id: 8453,
  dstack_kms_address: "0x1111111111111111111111111111111111111111",
  dstack_app_address: "0x2222222222222222222222222222222222222222",
  deployer_address: "0x3333333333333333333333333333333333333333",
  rpc_endpoint: "https://mainnet.base.org",
  encrypted_env_pubkey: "-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----",
  k256_pubkey: "0x0447a19d42dd0b7e83005b72ddc045bb7a32bf3e8d4bda61a36a63f4bf6f3e4a2c",
};

const detailFixture = {
  id: "cvm-123",
  name: "my-cvm",
  status: "running",
  resource: {},
  gateway: {},
  kms_type: "base",
  kms_info: KMS_INFO,
};

describe("CvmKmsInfoV20260121 k256_pubkey", () => {
  it("keeps kms_info.k256_pubkey after CvmInfoDetailV20260121Schema.parse", () => {
    const parsed = CvmInfoDetailV20260121Schema.parse(detailFixture);
    expect(parsed.kms_info?.k256_pubkey).toBe(KMS_INFO.k256_pubkey);
    expect(parsed.kms_info?.encrypted_env_pubkey).toBe(KMS_INFO.encrypted_env_pubkey);
  });

  it("keeps kms_info.k256_pubkey after CvmInfoDetailV20260522Schema.parse", () => {
    const parsed = CvmInfoDetailV20260522Schema.parse(detailFixture);
    expect(parsed.kms_info?.k256_pubkey).toBe(KMS_INFO.k256_pubkey);
  });

  it("keeps kms_info.k256_pubkey after CvmInfoDetailV20261111Schema.parse", () => {
    const parsed = CvmInfoDetailV20261111Schema.parse({
      ...detailFixture,
      resource: { memory_in_mb: 4096 },
    });
    expect(parsed.kms_info?.k256_pubkey).toBe(KMS_INFO.k256_pubkey);
  });

  it("allows k256_pubkey to be absent or null", () => {
    const { k256_pubkey: _omitted, ...withoutK256 } = KMS_INFO;
    const parsedOmitted = CvmInfoDetailV20260121Schema.parse({
      ...detailFixture,
      kms_info: withoutK256,
    });
    expect(parsedOmitted.kms_info?.k256_pubkey).toBeUndefined();

    const parsedNull = CvmInfoDetailV20260121Schema.parse({
      ...detailFixture,
      kms_info: { ...KMS_INFO, k256_pubkey: null },
    });
    expect(parsedNull.kms_info?.k256_pubkey).toBeNull();
  });
});
