import { describe, it, expect } from "vitest";
import { getMrConfigId, getMrConfigIdV1, verifyMrConfigId } from "./get_mr_config_id";
import { toBytes, toHex } from "viem";

// Test vectors generated from the dstack Rust formula
// (dstack-types/src/mr_config.rs MrConfig::V2::to_mr_config_id)
//
// Input encoding matches Rust exactly:
//   compose_hash: [u8; 32] raw bytes
//   app_id: [u8; 20] raw bytes
//   key_provider_type: u8 (none=0, local=1, kms=2, tpm=3)
//   key_provider_id: [u8] raw bytes (hex-decoded)

const COMPOSE_HASH = "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const APP_ID = "0x000102030405060708090a0b0c0d0e0f10111213";

describe("getMrConfigId (V2)", () => {
  it("should match dstack Rust output for kms with key_provider_id", () => {
    const result = getMrConfigId({
      compose_hash: COMPOSE_HASH,
      app_id: APP_ID,
      key_provider_type: "kms",
      key_provider_id: "0xaabbccdd",
    });
    expect(result).toBe(
      "0x02e472ed80a08042f044ba63b53b798e98e3ea5219cd078007b1ac8b3dfc762b94000000000000000000000000000000",
    );
  });

  it("should match dstack Rust output for none with empty key_provider_id", () => {
    const result = getMrConfigId({
      compose_hash: COMPOSE_HASH,
      app_id: APP_ID,
      key_provider_type: "none",
      key_provider_id: "0x",
    });
    expect(result).toBe(
      "0x02b21a3a65891c2c3955d82000b30fab13f4adc1a12dc4a84793ea322b71f1882a000000000000000000000000000000",
    );
  });

  it("should produce 48 bytes", () => {
    const result = getMrConfigId({
      compose_hash: COMPOSE_HASH,
      app_id: APP_ID,
      key_provider_type: "kms",
      key_provider_id: "0xaabbccdd",
    });
    expect(toBytes(result).length).toBe(48);
  });

  it("should have version byte 0x02", () => {
    const result = getMrConfigId({
      compose_hash: COMPOSE_HASH,
      app_id: APP_ID,
      key_provider_type: "kms",
      key_provider_id: "0xaabbccdd",
    });
    expect(toBytes(result)[0]).toBe(0x02);
  });

  it("should zero-pad bytes 33-47", () => {
    const result = getMrConfigId({
      compose_hash: COMPOSE_HASH,
      app_id: APP_ID,
      key_provider_type: "kms",
      key_provider_id: "0xaabbccdd",
    });
    const bytes = toBytes(result);
    expect(bytes.slice(33)).toEqual(new Uint8Array(15));
  });

  it("should produce different results for different key provider types", () => {
    const base = { compose_hash: COMPOSE_HASH, app_id: APP_ID, key_provider_id: "0xaabb" as const };
    const results = new Set(
      (["none", "local", "kms", "tpm"] as const).map((t) => getMrConfigId({ ...base, key_provider_type: t })),
    );
    expect(results.size).toBe(4);
  });

  it("should be deterministic", () => {
    const input = {
      compose_hash: COMPOSE_HASH,
      app_id: APP_ID,
      key_provider_type: "kms" as const,
      key_provider_id: "0xaabbccdd" as const,
    };
    expect(getMrConfigId(input)).toBe(getMrConfigId(input));
  });
});

describe("getMrConfigIdV1", () => {
  it("should match dstack Rust V1 output", () => {
    const result = getMrConfigIdV1(COMPOSE_HASH);
    expect(result).toBe(
      "0x01000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f000000000000000000000000000000",
    );
  });

  it("should have version byte 0x01", () => {
    expect(toBytes(getMrConfigIdV1(COMPOSE_HASH))[0]).toBe(0x01);
  });

  it("should embed compose_hash directly at bytes 1-32", () => {
    const result = toBytes(getMrConfigIdV1(COMPOSE_HASH));
    expect(toHex(result.slice(1, 33))).toBe(COMPOSE_HASH);
  });
});

describe("verifyMrConfigId", () => {
  const input = {
    compose_hash: COMPOSE_HASH,
    app_id: APP_ID,
    key_provider_type: "kms" as const,
    key_provider_id: "0xaabbccdd" as const,
  };

  it("should return true for matching mr_config_id", () => {
    const mrConfigId = getMrConfigId(input);
    expect(verifyMrConfigId(mrConfigId, input)).toBe(true);
  });

  it("should return false for wrong mr_config_id", () => {
    const fake = toHex(new Uint8Array(48));
    expect(verifyMrConfigId(fake, input)).toBe(false);
  });

  it("should be case-insensitive", () => {
    const mrConfigId = getMrConfigId(input);
    expect(verifyMrConfigId(mrConfigId.toUpperCase() as `0x${string}`, input)).toBe(true);
  });
});
