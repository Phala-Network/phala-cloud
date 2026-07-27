/**
 * Tests for getEncryptPubkey utility
 */

import { describe, test, expect, mock } from "bun:test";
import { getEncryptPubkey } from "./get-encrypt-pubkey";

// Mock the @phala/cloud module
mock.module("@phala/cloud", () => ({
	safeGetAppEnvEncryptPubKey: mock(async () => ({
		success: true,
		data: { public_key: "aa", signature: "bb" },
	})),
	verifyEnvEncryptPublicKeyLegacy: mock(() => "0xexpected_kms_pubkey"),
}));

const { safeGetAppEnvEncryptPubKey, verifyEnvEncryptPublicKeyLegacy } =
	await import("@phala/cloud");

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
					data: {
						public_key: "aa",
						signature: "bb",
					},
				},
			);
			(
				verifyEnvEncryptPublicKeyLegacy as ReturnType<typeof mock>
			).mockReturnValue("0xexpected_kms_pubkey");

			const cvm = {
				app_id: "abc123def456abc123def456abc123def456abc1",
				kms_type: "ethereum",
				kms_info: {
					chain_id: 1,
					encrypted_env_pubkey: null,
					k256_pubkey: "expected_kms_pubkey",
				},
			};

			const result = await getEncryptPubkey(mockClient, cvm);
			expect(result).toBe("aa");
		});

		test("throws when KMS k256_pubkey is missing", async () => {
			(safeGetAppEnvEncryptPubKey as ReturnType<typeof mock>).mockResolvedValue(
				{
					success: true,
					data: {
						public_key: "aa",
						signature: "bb",
					},
				},
			);

			const cvm = {
				app_id: "abc123def456abc123def456abc123def456abc1",
				kms_type: "ethereum",
				kms_info: {
					chain_id: 1,
					encrypted_env_pubkey: null,
				},
			};

			await expect(getEncryptPubkey(mockClient, cvm)).rejects.toThrow(
				"KMS k256_pubkey is required",
			);
		});

		test("throws when signature recovers a different KMS key", async () => {
			(safeGetAppEnvEncryptPubKey as ReturnType<typeof mock>).mockResolvedValue(
				{
					success: true,
					data: {
						public_key: "aa",
						signature: "bb",
					},
				},
			);
			(
				verifyEnvEncryptPublicKeyLegacy as ReturnType<typeof mock>
			).mockReturnValue("0xother_kms_pubkey");

			const cvm = {
				app_id: "abc123def456abc123def456abc123def456abc1",
				kms_type: "ethereum",
				kms_info: {
					chain_id: 1,
					encrypted_env_pubkey: null,
					k256_pubkey: "expected_kms_pubkey",
				},
			};

			await expect(getEncryptPubkey(mockClient, cvm)).rejects.toThrow(
				"does not match KMS",
			);
		});

		test("throws when kms_type is missing", async () => {
			const cvm = {
				app_id: "abc123",
				kms_type: null,
				kms_info: {
					chain_id: 1,
					encrypted_env_pubkey: null,
				},
			};

			await expect(getEncryptPubkey(mockClient, cvm)).rejects.toThrow(
				"KMS type is required",
			);
		});

		test("throws when app_id is missing", async () => {
			const cvm = {
				app_id: null,
				kms_type: "ethereum",
				kms_info: {
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
					chain_id: 8453,
					encrypted_env_pubkey: null,
				},
			};

			await expect(getEncryptPubkey(mockClient, cvm)).rejects.toEqual({
				message: "KMS not found",
			});
		});
	});
});
