/**
 * Tests for getEncryptPubkey utility
 */

import { describe, test, expect, mock } from "bun:test";
import { getEncryptPubkey } from "./get-encrypt-pubkey";

// Mock the @phala/cloud module
mock.module("@phala/cloud", () => ({
	safeGetAppEnvEncryptPubKey: mock(async () => ({
		success: true,
		data: { public_key: "decentralized_pubkey_hex" },
	})),
}));

const { safeGetAppEnvEncryptPubKey } = await import("@phala/cloud");

describe("getEncryptPubkey", () => {
	const mockClient = {} as Parameters<typeof getEncryptPubkey>[0];

	describe("centralized KMS", () => {
		test("returns encrypted_env_pubkey directly", async () => {
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

		test("returns pubkey when chain_id is absent", async () => {
			const cvm = {
				app_id: "abc123",
				kms_type: "phala",
				kms_info: {
					encrypted_env_pubkey: "some_pubkey",
				},
			};

			const result = await getEncryptPubkey(mockClient, cvm);
			expect(result).toBe("some_pubkey");
		});

		test("throws when encrypted_env_pubkey is missing", async () => {
			const cvm = {
				app_id: "abc123",
				kms_type: "phala",
				kms_info: {
					chain_id: null,
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

	describe("decentralized KMS", () => {
		test("fetches pubkey from KMS endpoint", async () => {
			(safeGetAppEnvEncryptPubKey as ReturnType<typeof mock>).mockResolvedValue(
				{
					success: true,
					data: { public_key: "decentralized_pubkey_hex" },
				},
			);

			const cvm = {
				app_id: "abc123def456abc123def456abc123def456abc1",
				kms_type: "ethereum",
				kms_info: {
					id: "kms_abc123",
					slug: "test-kms",
					chain_id: 1,
					encrypted_env_pubkey: null,
				},
			};

			const result = await getEncryptPubkey(mockClient, cvm);
			expect(result).toBe("decentralized_pubkey_hex");
			expect(safeGetAppEnvEncryptPubKey).toHaveBeenCalledWith(mockClient, {
				app_id: "abc123def456abc123def456abc123def456abc1",
				kms: "test-kms",
			});
		});

		test("falls back to legacy compose env_pubkey when kms slug and id are missing", async () => {
			const fallbackClient = {
				get: mock(async () => ({ env_pubkey: "legacy_pubkey_hex" })),
			} as unknown as Parameters<typeof getEncryptPubkey>[0];
			const cvm = {
				id: "cvm_abc123",
				app_id: "abc123def456abc123def456abc123def456abc1",
				kms_type: "base",
				kms_info: {
					chain_id: 8453,
					encrypted_env_pubkey: null,
				},
			};

			const result = await getEncryptPubkey(fallbackClient, cvm);
			expect(result).toBe("legacy_pubkey_hex");
			expect(fallbackClient.get).toHaveBeenCalledWith(
				"/cvms/cvm_abc123/compose",
			);
		});

		test("falls back to kms id when slug is missing", async () => {
			(safeGetAppEnvEncryptPubKey as ReturnType<typeof mock>).mockResolvedValue(
				{
					success: true,
					data: { public_key: "decentralized_pubkey_hex" },
				},
			);

			const cvm = {
				app_id: "abc123def456abc123def456abc123def456abc1",
				kms_type: "base",
				kms_info: {
					id: "kms_xyz789",
					slug: null,
					chain_id: 8453,
					encrypted_env_pubkey: null,
				},
			};

			const result = await getEncryptPubkey(mockClient, cvm);
			expect(result).toBe("decentralized_pubkey_hex");
			expect(safeGetAppEnvEncryptPubKey).toHaveBeenCalledWith(mockClient, {
				app_id: "abc123def456abc123def456abc123def456abc1",
				kms: "kms_xyz789",
			});
		});

		test("throws when kms slug and id are missing", async () => {
			const cvm = {
				app_id: "abc123",
				kms_type: null,
				kms_info: {
					chain_id: 1,
					encrypted_env_pubkey: null,
				},
			};

			await expect(getEncryptPubkey(mockClient, cvm)).rejects.toThrow(
				"KMS slug or id is required",
			);
		});

		test("throws when app_id is missing", async () => {
			const cvm = {
				app_id: null,
				kms_type: "ethereum",
				kms_info: {
					id: "kms_abc123",
					slug: "test-kms",
					chain_id: 1,
					encrypted_env_pubkey: null,
				},
			};

			await expect(getEncryptPubkey(mockClient, cvm)).rejects.toThrow(
				"app_id is required",
			);
		});

		test("throws when KMS endpoint returns error", async () => {
			(safeGetAppEnvEncryptPubKey as ReturnType<typeof mock>).mockResolvedValue(
				{
					success: false,
					error: { message: "KMS not found" },
				},
			);

			const cvm = {
				app_id: "abc123def456abc123def456abc123def456abc1",
				kms_type: "base",
				kms_info: {
					id: "kms_base123",
					slug: "kms-base-prod5",
					chain_id: 8453,
					encrypted_env_pubkey: null,
				},
			};

			await expect(getEncryptPubkey(mockClient, cvm)).rejects.toThrow(
				"Failed to get encryption public key",
			);
		});
	});
});
