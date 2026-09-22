import { describe, it, expect } from "vitest";
import {
  buildMrConfigV3Document,
  canonicalizeMrConfigV3Document,
  getMrConfigId,
  getMrConfigIdV1,
  getMrConfigIdV3,
  getSnpHostDataV3,
  verifyMrConfigId,
} from "./get_mr_config_id";
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

  it("should match KMS CA pubkey vector", () => {
    const result = getMrConfigId({
      compose_hash: "0x4f475ed201ac079f2e4760fb7554763edcc97c48132d554666a2ec3fd2c9e099",
      app_id: "0x8d8f406cf93e1cf54207fbf99c9bc437dd4d6aef",
      key_provider_type: "kms",
      key_provider_id:
        "0x3059301306072a8648ce3d020106082a8648ce3d030107034200048844eb42ccdf8c52fd4f174f362fcb9bbd19c45fd48f1edec2d8f1ca23536ec1a74021b4cee610c074f8294d431b2b7fee2c39e5333fdaf0a4522d43fb159d9f",
    });
    expect(result).toBe(
      "0x02dd0db3893b8c47b5e4098d7630d22959a1423af536890d10aaf3f0a7b169921b000000000000000000000000000000",
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

// ---------------------------------------------------------------------------
// MrConfigV3
//
// Every vector below was printed by dstack itself, not by this implementation:
// a scratch crate with a path dependency on `dstack/dstack-types` (at
// `origin/next`) built each document with `MrConfigV3::new(...)` and printed
// `to_canonical_json()`, `to_tdx_mr_config_id()` and `to_snp_host_data()`.
// The same six vectors are pinned in the Python and Go suites.
// ---------------------------------------------------------------------------

const V3_APP_ID = `0x${"11".repeat(20)}`;
const V3_COMPOSE_HASH = `0x${"22".repeat(32)}`;
const V3_KMS_KEY_PROVIDER_ID = `0x${"33".repeat(32)}`;
const V3_INSTANCE_ID = `0x${"44".repeat(20)}`;
/** sha256(JCS({})) — dstack's `gpu_policy_hash` for a compose with no policy. */
const V3_DEFAULT_GPU_POLICY_HASH = "0x44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a";

describe("MrConfigV3", () => {
  it("(a) canonicalizes and hashes a KMS document carrying an instance_id", () => {
    const document = buildMrConfigV3Document({
      app_id: V3_APP_ID,
      compose_hash: V3_COMPOSE_HASH,
      key_provider: "kms",
      key_provider_id: V3_KMS_KEY_PROVIDER_ID,
      instance_id: V3_INSTANCE_ID,
    });
    expect(canonicalizeMrConfigV3Document(document)).toBe(
      '{"app_id":"1111111111111111111111111111111111111111",' +
        '"compose_hash":"2222222222222222222222222222222222222222222222222222222222222222",' +
        '"instance_id":"4444444444444444444444444444444444444444",' +
        '"key_provider":"kms",' +
        '"key_provider_id":"3333333333333333333333333333333333333333333333333333333333333333",' +
        '"version":3}',
    );
    expect(getMrConfigIdV3(document)).toBe(
      "0x0350fc88d0a462b6a0b06ba25859abc02e98c2a8d9bd000b7dc0d8bae65e71ecbb000000000000000000000000000000",
    );
    expect(getSnpHostDataV3(document)).toBe(
      "0x50fc88d0a462b6a0b06ba25859abc02e98c2a8d9bd000b7dc0d8bae65e71ecbb",
    );
  });

  it("(b) binds gpu_policy_hash for a GPU launch", () => {
    const document = buildMrConfigV3Document({
      app_id: V3_APP_ID,
      compose_hash: V3_COMPOSE_HASH,
      gpu_policy_hash: V3_DEFAULT_GPU_POLICY_HASH,
      key_provider: "kms",
      key_provider_id: V3_KMS_KEY_PROVIDER_ID,
      instance_id: V3_INSTANCE_ID,
    });
    expect(canonicalizeMrConfigV3Document(document)).toBe(
      '{"app_id":"1111111111111111111111111111111111111111",' +
        '"compose_hash":"2222222222222222222222222222222222222222222222222222222222222222",' +
        '"gpu_policy_hash":"44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",' +
        '"instance_id":"4444444444444444444444444444444444444444",' +
        '"key_provider":"kms",' +
        '"key_provider_id":"3333333333333333333333333333333333333333333333333333333333333333",' +
        '"version":3}',
    );
    expect(getMrConfigIdV3(document)).toBe(
      "0x03893655c09844af05adb4d67af5917998038afe711bdcd3a3ec1dbd94ad272b85000000000000000000000000000000",
    );
    expect(getSnpHostDataV3(document)).toBe(
      "0x893655c09844af05adb4d67af5917998038afe711bdcd3a3ec1dbd94ad272b85",
    );
  });

  it("(c) binds ordered init_script_hashes", () => {
    const document = buildMrConfigV3Document({
      app_id: V3_APP_ID,
      compose_hash: V3_COMPOSE_HASH,
      key_provider: "local",
      key_provider_id: `0x${"55".repeat(20)}`,
      instance_id: V3_INSTANCE_ID,
      init_script_hashes: [`0x${"aa".repeat(32)}`, `0x${"bb".repeat(32)}`],
    });
    expect(canonicalizeMrConfigV3Document(document)).toBe(
      '{"app_id":"1111111111111111111111111111111111111111",' +
        '"compose_hash":"2222222222222222222222222222222222222222222222222222222222222222",' +
        '"init_script_hashes":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",' +
        '"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],' +
        '"instance_id":"4444444444444444444444444444444444444444",' +
        '"key_provider":"local",' +
        '"key_provider_id":"5555555555555555555555555555555555555555",' +
        '"version":3}',
    );
    expect(getMrConfigIdV3(document)).toBe(
      "0x039af46bdc5deb1ea74f2c77b4f83165f1f3e4e37e3ce15462b5fee0d235912390000000000000000000000000000000",
    );
    expect(getSnpHostDataV3(document)).toBe(
      "0x9af46bdc5deb1ea74f2c77b4f83165f1f3e4e37e3ce15462b5fee0d235912390",
    );
  });

  it("(c2) keeps an empty init_script_hashes list, which is not the same as omitting it", () => {
    const withEmptyList = buildMrConfigV3Document({
      app_id: V3_APP_ID,
      compose_hash: V3_COMPOSE_HASH,
      key_provider: "kms",
      key_provider_id: V3_KMS_KEY_PROVIDER_ID,
      instance_id: V3_INSTANCE_ID,
      init_script_hashes: [],
    });
    expect(canonicalizeMrConfigV3Document(withEmptyList)).toContain('"init_script_hashes":[]');
    expect(getMrConfigIdV3(withEmptyList)).toBe(
      "0x03ce2f8b8e4aa4cccdae73fb3a118047726b77d70b1e47bb0e3e48600603fd612c000000000000000000000000000000",
    );
    expect(getSnpHostDataV3(withEmptyList)).toBe(
      "0xce2f8b8e4aa4cccdae73fb3a118047726b77d70b1e47bb0e3e48600603fd612c",
    );

    const omitted = buildMrConfigV3Document({
      app_id: V3_APP_ID,
      compose_hash: V3_COMPOSE_HASH,
      key_provider: "kms",
      key_provider_id: V3_KMS_KEY_PROVIDER_ID,
      instance_id: V3_INSTANCE_ID,
    });
    expect(getMrConfigIdV3(omitted)).not.toBe(getMrConfigIdV3(withEmptyList));
  });

  it("(d) omits instance_id and key_provider_id when there are none", () => {
    const document = buildMrConfigV3Document({
      app_id: V3_APP_ID,
      compose_hash: V3_COMPOSE_HASH,
      key_provider: "none",
    });
    expect(canonicalizeMrConfigV3Document(document)).toBe(
      '{"app_id":"1111111111111111111111111111111111111111",' +
        '"compose_hash":"2222222222222222222222222222222222222222222222222222222222222222",' +
        '"key_provider":"none",' +
        '"version":3}',
    );
    expect(getMrConfigIdV3(document)).toBe(
      "0x0301d4d7e6ca2922bb80683c27fe1f4da318cf14d1c38db97563c2b6209af7dba5000000000000000000000000000000",
    );
    expect(getSnpHostDataV3(document)).toBe(
      "0x01d4d7e6ca2922bb80683c27fe1f4da318cf14d1c38db97563c2b6209af7dba5",
    );
  });

  it("(e) serializes every optional field at once, on a tpm key provider", () => {
    const document = buildMrConfigV3Document({
      app_id: V3_APP_ID,
      compose_hash: V3_COMPOSE_HASH,
      gpu_policy_hash: `0x${"55".repeat(32)}`,
      key_provider: "tpm",
      key_provider_id: `0x${"66".repeat(16)}`,
      instance_id: V3_INSTANCE_ID,
      init_script_hashes: [`0x${"cc".repeat(32)}`],
    });
    expect(getMrConfigIdV3(document)).toBe(
      "0x03633f5444c26877f68c293d90a6feef58064e1e57367ac55c94b255cf3bdf8885000000000000000000000000000000",
    );
    expect(getSnpHostDataV3(document)).toBe(
      "0x633f5444c26877f68c293d90a6feef58064e1e57367ac55c94b255cf3bdf8885",
    );
  });

  it("accepts bare hex as readily as 0x-prefixed hex", () => {
    const prefixed = buildMrConfigV3Document({
      app_id: V3_APP_ID,
      compose_hash: V3_COMPOSE_HASH,
      key_provider: "none",
    });
    const bare = buildMrConfigV3Document({
      app_id: "11".repeat(20),
      compose_hash: "22".repeat(32),
      key_provider: "none",
    });
    expect(bare).toEqual(prefixed);
  });

  it("rejects byte fields of the wrong length", () => {
    expect(() =>
      buildMrConfigV3Document({ compose_hash: "0x2222", key_provider: "none" }),
    ).toThrow(/compose_hash must be 32 bytes/);
    expect(() =>
      buildMrConfigV3Document({
        app_id: `0x${"11".repeat(32)}`,
        compose_hash: V3_COMPOSE_HASH,
        key_provider: "none",
      }),
    ).toThrow(/app_id must be 20 bytes/);
  });

  it("rejects more init scripts than dstack binds", () => {
    expect(() =>
      buildMrConfigV3Document({
        compose_hash: V3_COMPOSE_HASH,
        key_provider: "none",
        init_script_hashes: Array.from({ length: 6 }, () => `0x${"aa".repeat(32)}`),
      }),
    ).toThrow(/at most 5/);
  });
});

describe("verifyMrConfigId dispatches on the version byte", () => {
  const composeHash = V3_COMPOSE_HASH as `0x${string}`;
  const appId = V3_APP_ID as `0x${string}`;
  const input = {
    compose_hash: composeHash,
    app_id: appId,
    key_provider_type: "kms" as const,
    key_provider_id: V3_KMS_KEY_PROVIDER_ID as `0x${string}`,
    instance_id: V3_INSTANCE_ID as `0x${string}`,
  };

  it("verifies a V1 quote from compose_hash alone", () => {
    expect(verifyMrConfigId(getMrConfigIdV1(composeHash), input)).toBe(true);
  });

  it("verifies a legacy V2 quote", () => {
    expect(verifyMrConfigId(getMrConfigId(input), input)).toBe(true);
  });

  it("verifies a V3 quote against the pinned dstack vector", () => {
    expect(
      verifyMrConfigId(
        "0x0350fc88d0a462b6a0b06ba25859abc02e98c2a8d9bd000b7dc0d8bae65e71ecbb000000000000000000000000000000",
        input,
      ),
    ).toBe(true);
  });

  it("rejects a V3 quote once the instance_id changes", () => {
    expect(
      verifyMrConfigId(
        "0x0350fc88d0a462b6a0b06ba25859abc02e98c2a8d9bd000b7dc0d8bae65e71ecbb000000000000000000000000000000",
        { ...input, instance_id: `0x${"45".repeat(20)}` },
      ),
    ).toBe(false);
  });

  it("rejects an unknown version byte", () => {
    expect(
      verifyMrConfigId(
        "0x0450fc88d0a462b6a0b06ba25859abc02e98c2a8d9bd000b7dc0d8bae65e71ecbb000000000000000000000000000000",
        input,
      ),
    ).toBe(false);
  });
});
