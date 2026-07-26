import type { Client } from "@phala/cloud";
import {
	safeGetAppEnvEncryptPubKey,
	verifyEnvEncryptPublicKeyLegacy,
	type GetAppEnvEncryptPubKey,
} from "@phala/cloud";

function stripHexPrefix(value: string): string {
	return value.startsWith("0x") ? value.slice(2) : value;
}

function normalizeHex(value: string): string {
	return stripHexPrefix(value).toLowerCase();
}

function hexToBytes(value: string, field: string): Uint8Array {
	const hex = stripHexPrefix(value);
	if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
		throw new Error(`Invalid ${field}`);
	}
	return new Uint8Array(Buffer.from(hex, "hex"));
}

export function verifyAndExtractEnvEncryptPubkey(
	response: GetAppEnvEncryptPubKey,
	appId: string,
	expectedKmsPubkey?: string | null,
): string {
	if (!expectedKmsPubkey) {
		throw new Error(
			"KMS k256_pubkey is required to verify encryption public key",
		);
	}

	const recoveredKmsPubkey = verifyEnvEncryptPublicKeyLegacy(
		hexToBytes(response.public_key, "encryption public key"),
		hexToBytes(response.signature, "encryption public key signature"),
		appId,
	);
	if (!recoveredKmsPubkey) {
		throw new Error("Invalid encryption public key signature");
	}
	if (normalizeHex(recoveredKmsPubkey) !== normalizeHex(expectedKmsPubkey)) {
		throw new Error("Encryption public key signature does not match KMS");
	}

	return response.public_key;
}

/**
 * Resolve the encryption public key for a CVM.
 *
 * Centralized KMS (phala/legacy): uses kms_info.encrypted_env_pubkey directly.
 * Decentralized KMS (ethereum/base): fetches from KMS endpoint.
 */
export async function getEncryptPubkey(
	client: Client,
	cvm: {
		app_id?: string | null;
		kms_type?: string | null;
		kms_info?: {
			chain_id?: number | null;
			encrypted_env_pubkey?: string | null;
			k256_pubkey?: string | null;
		} | null;
	},
): Promise<string> {
	const isDecentralized = cvm.kms_info?.chain_id != null;

	if (isDecentralized) {
		const kmsSlug = cvm.kms_type;
		if (!kmsSlug) {
			throw new Error("KMS type is required for decentralized KMS");
		}
		if (!cvm.app_id) {
			throw new Error("app_id is required for decentralized KMS");
		}

		const resp = await safeGetAppEnvEncryptPubKey(client, {
			app_id: cvm.app_id,
			kms: kmsSlug,
		});

		if (!resp.success) {
			throw resp.error;
		}

		return verifyAndExtractEnvEncryptPubkey(
			resp.data,
			cvm.app_id,
			cvm.kms_info?.k256_pubkey,
		);
	}

	// Centralized KMS
	const pubkey = cvm.kms_info?.encrypted_env_pubkey;
	if (!pubkey) {
		throw new Error(
			"CVM does not have an encryption public key. The CVM may not support encrypted environment variables.",
		);
	}
	return pubkey;
}
