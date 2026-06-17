import { keccak256, toBytes, toHex, type Hex } from "viem";

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

/**
 * Verify that a mr_config_id matches the expected value computed from
 * the given inputs. Automatically selects V1 or V2 based on version byte.
 */
export function verifyMrConfigId(mrConfigId: Hex, input: MrConfigIdInput): boolean {
  const expected = getMrConfigId(input);
  return expected.toLowerCase() === mrConfigId.toLowerCase();
}
