import type { Client } from "@phala/cloud";
import { safeGetAppEnvEncryptPubKey } from "@phala/cloud";
import { logger } from "@/src/utils/logger";

/**
 * Resolve the encryption public key for a CVM.
 *
 * Centralized KMS (phala/legacy): uses kms_info.encrypted_env_pubkey directly.
 * Decentralized KMS (ethereum/base): fetches from KMS endpoint.
 */
export async function getEncryptPubkey(
	client: Client,
	cvm: {
		id?: string | null;
		app_id?: string | null;
		kms_type?: string | null;
		kms_info?: {
			id?: string | null;
			slug?: string | null;
			chain_id?: number | null;
			encrypted_env_pubkey?: string | null;
		} | null;
	},
): Promise<string> {
	const isDecentralized = cvm.kms_info?.chain_id != null;

	if (isDecentralized) {
		const kmsIdentifier = cvm.kms_info?.slug || cvm.kms_info?.id;
		if (!kmsIdentifier) {
			const fallbackCvmId = cvm.id || cvm.app_id;
			if (fallbackCvmId) {
				try {
					const legacyCompose = await client.get<{
						env_pubkey?: string | null;
					}>(`/cvms/${fallbackCvmId}/compose`);
					if (legacyCompose.env_pubkey) {
						return legacyCompose.env_pubkey;
					}
				} catch {
					// Ignore legacy fallback failures and surface the primary error below.
				}
			}
			throw new Error("KMS slug or id is required for decentralized KMS");
		}
		if (!cvm.app_id) {
			throw new Error("app_id is required for decentralized KMS");
		}

		const resp = await safeGetAppEnvEncryptPubKey(client, {
			app_id: cvm.app_id,
			kms: kmsIdentifier,
		});

		if (!resp.success) {
			logger.logDetailedError(resp.error, "Get App Env Encrypt PubKey");
			throw new Error(
				`Failed to get encryption public key: ${resp.error.message}`,
			);
		}

		return resp.data.public_key;
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
