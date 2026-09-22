import { concat, keccak256, sha256, stringToBytes, toBytes, toHex, type Hex } from "viem";

const MR_CONFIG_ID_LENGTH = 48;

/**
 * Key provider kind, encoded as a single byte for mr_config_id computation.
 *
 * Maps to dstack-types KeyProviderKind:
 * - None = 0
 * - Local = 1
 * - Kms = 2
 * - Tpm = 3
 */
const KEY_PROVIDER_BYTE = {
  none: 0,
  local: 1,
  kms: 2,
  tpm: 3,
} as const;

export type KeyProviderKind = keyof typeof KEY_PROVIDER_BYTE;

export interface MrConfigIdInput {
  /** SHA-256 compose hash, 32 bytes as 0x-prefixed hex */
  compose_hash: Hex;
  /** Application ID, 20 bytes as 0x-prefixed hex */
  app_id: Hex;
  /** Key provider kind */
  key_provider_type: KeyProviderKind;
  /** Key provider identity (CA pubkey for KMS, MR enclave for local-sgx, empty for none), hex bytes */
  key_provider_id: Hex;
}

/**
 * Compute mr_config_id V1 from compose_hash alone.
 *
 * Used when key_provider_id is empty (no key provider configured).
 * Format: 0x01 || compose_hash (32 bytes) || zeros (15 bytes)
 */
export function getMrConfigIdV1(composeHash: Hex): Hex {
  const result = new Uint8Array(MR_CONFIG_ID_LENGTH);
  result[0] = 1;
  result.set(toBytes(composeHash), 1);
  return toHex(result);
}

/**
 * Compute mr_config_id V2 from compose_hash, app_id, key_provider_type
 * and key_provider_id.
 *
 * LEGACY VMMs ONLY. dstack stopped generating V2 for new VMs: a TDX VM that
 * declares `key_provider_id` now measures MrConfigV3, and V2 survives only as
 * the fallback for VMs that predate the stored mr_config document
 * (`dstack/vmm/src/app/mr_config.rs`). Keep it for verifying those quotes;
 * never use it to describe a new deployment.
 *
 * Mirrors dstack-types/src/mr_config.rs MrConfig::V2::to_mr_config_id().
 *
 * Hash input (concatenated raw bytes):
 * - compose_hash: [u8; 32]
 * - app_id: [u8; 20]
 * - key_provider_type: u8 (none=0, local=1, kms=2, tpm=3)
 * - key_provider_id: [u8] (variable length, hex-decoded)
 *
 * Output: 0x02 || keccak256(above) (32 bytes) || zeros (15 bytes) = 48 bytes
 */
export function getMrConfigId(input: MrConfigIdInput): Hex {
  const composeHashBytes = toBytes(input.compose_hash);
  const appIdBytes = toBytes(input.app_id);
  const kpByte = KEY_PROVIDER_BYTE[input.key_provider_type];
  const kpIdBytes =
    input.key_provider_id === "0x" ? new Uint8Array(0) : toBytes(input.key_provider_id);

  const payload = new Uint8Array(
    composeHashBytes.length + appIdBytes.length + 1 + kpIdBytes.length,
  );
  let offset = 0;
  payload.set(composeHashBytes, offset);
  offset += composeHashBytes.length;
  payload.set(appIdBytes, offset);
  offset += appIdBytes.length;
  payload[offset] = kpByte;
  offset += 1;
  payload.set(kpIdBytes, offset);

  const hash = keccak256(payload);
  const hashBytes = toBytes(hash);

  const result = new Uint8Array(MR_CONFIG_ID_LENGTH);
  result[0] = 2;
  result.set(hashBytes, 1);
  return toHex(result);
}

/** Domain separator hashed ahead of the MrConfigV3 document bytes. */
const MR_CONFIG_V3_DOMAIN = "dstack-mr-config-v3:";

/** dstack refuses to bind more than this many init scripts. */
export const MAX_INIT_SCRIPTS = 5;

/**
 * The MrConfigV3 document, field for field as dstack serializes it
 * (`dstack-types/src/mr_config.rs` `MrConfigV3`).
 *
 * Byte fields carry the exact spelling the canonical JSON uses: lowercase hex,
 * no `0x` prefix. Optional fields are absent — never null, never empty — which
 * is what `#[skip_serializing_none]` produces on the Rust side.
 */
export interface MrConfigV3Document {
  /** Always 3, and the only numeric field in the document. */
  version: 3;
  app_id?: string;
  compose_hash: string;
  gpu_policy_hash?: string;
  key_provider: KeyProviderKind;
  key_provider_id?: string;
  instance_id?: string;
  /** Present only for manifest_version >= 3; an empty list is meaningful. */
  init_script_hashes?: string[];
}

/** Loose inputs accepted when building a document: `0x`-prefixed or bare hex. */
export interface MrConfigV3Input {
  /** 20 bytes. Absent or empty means dstack pins no application identity. */
  app_id?: string;
  /** 32 bytes. */
  compose_hash: string;
  /** 32 bytes. Present only when the VM has GPUs attached. */
  gpu_policy_hash?: string;
  key_provider: KeyProviderKind;
  /** Variable length. Absent or empty for `key_provider: "none"`. */
  key_provider_id?: string;
  /** 20 bytes. Absent when the compose sets `no_instance_id`. */
  instance_id?: string;
  /** 32 bytes each, in execution order. Absent disables the check. */
  init_script_hashes?: string[];
}

function normalizeHex(value: string, field: string): string {
  const bare = value.replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]*$/.test(bare)) throw new Error(`${field} is not hex: ${value}`);
  if (bare.length % 2 !== 0) throw new Error(`${field} has an odd hex length: ${value}`);
  return bare;
}

function expectByteLength(bare: string, bytes: number, field: string): string {
  if (bare.length !== bytes * 2) {
    throw new Error(`${field} must be ${bytes} bytes, got ${bare.length / 2}`);
  }
  return bare;
}

/**
 * Build the MrConfigV3 document dstack would generate for these inputs.
 *
 * Mirrors `VmWorkDir::prepare_mr_config_v3` in `dstack/vmm/src/app/mr_config.rs`:
 * empty optional byte fields are dropped rather than serialized as empty
 * strings, so a `no_instance_id` compose yields a document with no
 * `instance_id` key at all.
 */
export function buildMrConfigV3Document(input: MrConfigV3Input): MrConfigV3Document {
  const document: MrConfigV3Document = {
    version: 3,
    compose_hash: expectByteLength(
      normalizeHex(input.compose_hash, "compose_hash"),
      32,
      "compose_hash",
    ),
    key_provider: input.key_provider,
  };

  const appId = input.app_id ? normalizeHex(input.app_id, "app_id") : "";
  if (appId) document.app_id = expectByteLength(appId, 20, "app_id");

  const gpuPolicyHash = input.gpu_policy_hash
    ? normalizeHex(input.gpu_policy_hash, "gpu_policy_hash")
    : "";
  if (gpuPolicyHash)
    document.gpu_policy_hash = expectByteLength(gpuPolicyHash, 32, "gpu_policy_hash");

  const keyProviderId = input.key_provider_id
    ? normalizeHex(input.key_provider_id, "key_provider_id")
    : "";
  if (keyProviderId) document.key_provider_id = keyProviderId;

  const instanceId = input.instance_id ? normalizeHex(input.instance_id, "instance_id") : "";
  if (instanceId) document.instance_id = expectByteLength(instanceId, 20, "instance_id");

  if (input.init_script_hashes !== undefined) {
    if (input.init_script_hashes.length > MAX_INIT_SCRIPTS) {
      throw new Error(`init_script_hashes supports at most ${MAX_INIT_SCRIPTS} hashes`);
    }
    document.init_script_hashes = input.init_script_hashes.map((hash, index) =>
      expectByteLength(
        normalizeHex(hash, `init_script_hashes[${index}]`),
        32,
        `init_script_hashes[${index}]`,
      ),
    );
  }

  return document;
}

/**
 * RFC 8785 (JCS) serialization of an MrConfigV3 document, byte for byte what
 * `serde_jcs::to_string` produces for the Rust struct.
 *
 * The document is a flat object whose values are hex strings, one enum string,
 * one small integer, and an array of hex strings. That means JCS reduces to
 * three rules here: sort the member names by UTF-16 code unit (which is what
 * `Array.prototype.sort` does), emit no whitespace, and print the one number as
 * a bare integer. No value needs JSON string escaping, because every string is
 * `[0-9a-f]*` or one of `none`/`kms`/`local`/`tpm`.
 */
export function canonicalizeMrConfigV3Document(document: MrConfigV3Document): string {
  const members: string[] = [];
  for (const key of Object.keys(document).sort()) {
    const value = document[key as keyof MrConfigV3Document];
    if (value === undefined) continue;
    if (typeof value === "number") {
      members.push(`${JSON.stringify(key)}:${value}`);
    } else if (Array.isArray(value)) {
      members.push(
        `${JSON.stringify(key)}:[${value.map((item) => JSON.stringify(item)).join(",")}]`,
      );
    } else {
      members.push(`${JSON.stringify(key)}:${JSON.stringify(value)}`);
    }
  }
  return `{${members.join(",")}}`;
}

/**
 * The 32-byte digest both platform carriers are derived from:
 * `sha256("dstack-mr-config-v3:" ‖ 0x00 ‖ JCS(document))`.
 */
function hashMrConfigV3Document(document: MrConfigV3Document): Uint8Array {
  const payload = concat([
    stringToBytes(MR_CONFIG_V3_DOMAIN),
    new Uint8Array([0]),
    stringToBytes(canonicalizeMrConfigV3Document(document)),
  ]);
  return toBytes(sha256(payload));
}

/**
 * Compute the TDX mr_config_id V3 for a document.
 *
 * Output: 0x03 || sha256(domain ‖ 0x00 ‖ JCS(document)) (32 bytes) || zeros (15 bytes).
 *
 * Mirrors `MrConfigV3::tdx_mr_config_id_from_document` in
 * `dstack-types/src/mr_config.rs`.
 */
export function getMrConfigIdV3(document: MrConfigV3Document): Hex {
  const result = new Uint8Array(MR_CONFIG_ID_LENGTH);
  result[0] = 3;
  result.set(hashMrConfigV3Document(document), 1);
  return toHex(result);
}

/**
 * Compute the AMD SEV-SNP `host_data` for a document: the same 32-byte digest
 * as `getMrConfigIdV3`, carried without the version byte or the padding.
 */
export function getSnpHostDataV3(document: MrConfigV3Document): Hex {
  return toHex(hashMrConfigV3Document(document));
}

/** Everything `verifyMrConfigId` may need, across all three layouts. */
export interface MrConfigVerifyInput extends MrConfigIdInput {
  /** V3 only: present when the VM has GPUs attached. */
  gpu_policy_hash?: Hex;
  /** V3 only: absent when the compose sets `no_instance_id`. */
  instance_id?: Hex;
  /** V3 only: present when the compose is manifest_version >= 3. */
  init_script_hashes?: Hex[];
}

/**
 * Verify a mr_config_id against the inputs it should have been derived from.
 *
 * The version byte decides the layout, so a single call verifies quotes from
 * legacy VMMs (V1 compose-hash-only, V2 keccak) and current ones (V3 document
 * digest) alike.
 */
export function verifyMrConfigId(mrConfigId: Hex, input: MrConfigVerifyInput): boolean {
  const bare = mrConfigId.replace(/^0x/i, "").toLowerCase();
  if (bare.length !== MR_CONFIG_ID_LENGTH * 2) return false;

  let expected: Hex;
  switch (bare.slice(0, 2)) {
    case "01":
      expected = getMrConfigIdV1(input.compose_hash);
      break;
    case "02":
      expected = getMrConfigId(input);
      break;
    case "03":
      expected = getMrConfigIdV3(
        buildMrConfigV3Document({
          app_id: input.app_id,
          compose_hash: input.compose_hash,
          gpu_policy_hash: input.gpu_policy_hash,
          key_provider: input.key_provider_type,
          key_provider_id: input.key_provider_id,
          instance_id: input.instance_id,
          init_script_hashes: input.init_script_hashes,
        }),
      );
      break;
    default:
      return false;
  }
  return expected.replace(/^0x/i, "").toLowerCase() === bare;
}
