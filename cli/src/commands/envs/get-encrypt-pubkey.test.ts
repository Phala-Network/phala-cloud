/**
 * Tests for getEncryptPubkey utility
 */

import { describe, test, expect } from "bun:test";
import { getEncryptPubkey } from "./get-encrypt-pubkey";

describe("getEncryptPubkey", () => {
	const mockClient = {} as Parameters<typeof getEncryptPubkey>[0];

	test("returns encrypted_env_pubkey for centralized KMS", async () => {
		const cvm = {
			app_id: "abc123",
			kms_type: "phala",
			kms_info: {
				chain_id: null,
				encrypted_env_pubkey: "centralized_pubkey_hex",
			},
		};

		const result = await getEncryptPubkey(mockClient, cvm);
		expect(result).toBe("centralized_pubkey_hex");
	});

	test("returns encrypted_env_pubkey for decentralized KMS", async () => {
		const cvm = {
			app_id: "abc123def456abc123def456abc123def456abc1",
			kms_type: "ethereum",
			kms_info: {
				chain_id: 1,
				encrypted_env_pubkey: "decentralized_pubkey_hex",
			},
		};

		const result = await getEncryptPubkey(mockClient, cvm);
		expect(result).toBe("decentralized_pubkey_hex");
	});

	test("throws when encrypted_env_pubkey is missing", async () => {
		const cvm = {
			app_id: "abc123",
			kms_type: "base",
			kms_info: {
				chain_id: 8453,
				encrypted_env_pubkey: null,
			},
		};

		await expect(getEncryptPubkey(mockClient, cvm)).rejects.toThrow(
			"CVM does not have an encryption public key",
		);
	});

	test("throws when kms_info is null", async () => {
		const cvm = {
			app_id: "abc123",
			kms_type: "phala",
			kms_info: null,
		};

		await expect(getEncryptPubkey(mockClient, cvm)).rejects.toThrow(
			"CVM does not have an encryption public key",
		);
	});
});
