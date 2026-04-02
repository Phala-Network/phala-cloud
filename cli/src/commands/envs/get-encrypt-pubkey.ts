import type { Client } from "@phala/cloud";

/**
 * Resolve the encryption public key for a CVM.
 *
 * All KMS variants use the CVM response field `encrypted_env_pubkey`.
 */
export async function getEncryptPubkey(
	client: Client,
	cvm: {
		id?: string | null;
		app_id?: string | null;
		kms_type?: string | null;
		kms_info?: {
			chain_id?: number | null;
			encrypted_env_pubkey?: string | null;
		} | null;
	},
): Promise<string> {
	void client;
	const pubkey = cvm.kms_info?.encrypted_env_pubkey;
	if (!pubkey) {
		throw new Error(
			"CVM does not have an encryption public key. The CVM may not support encrypted environment variables.",
		);
	}
	return pubkey;
}
