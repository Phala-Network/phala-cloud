import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "../client";
import {
  getAppEnvEncryptPubKey,
  safeGetAppEnvEncryptPubKey,
  type GetAppEnvEncryptPubKey,
  type GetAppEnvEncryptPubKeyRequest,
} from "./get_app_env_encrypt_pubkey";
import type { Client } from "../client";

// Mock response data matching the API structure
const mockAppEnvEncryptPubKeyData: GetAppEnvEncryptPubKey = {
  public_key: "04a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  signature: "30440220123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0102203456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234",
};

const mockRequest: GetAppEnvEncryptPubKeyRequest = {
  kms: "kms-123",
  app_id: "a".repeat(40), // Must be exactly 40 characters
};

describe("getAppEnvEncryptPubKey", () => {
  let client: Client;
  let mockSafeGet: any;
  let mockGet: any;

  beforeEach(() => {
    client = createClient({
      apiKey: "test-api-key",
      baseURL: "https://api.test.com",
    });
    mockSafeGet = vi.spyOn(client, "safeGet");
    mockGet = vi.spyOn(client, "get");
  });

  describe("API routing & basic success", () => {
    it("should call correct endpoint with kms and app_id", async () => {
      mockGet.mockResolvedValue(mockAppEnvEncryptPubKeyData);

      const result = await getAppEnvEncryptPubKey(client, mockRequest);

      expect(mockGet).toHaveBeenCalledWith(`/kms/${mockRequest.kms}/pubkey/${mockRequest.app_id}`);
      expect(result).toEqual(mockAppEnvEncryptPubKeyData);
      expect((result as GetAppEnvEncryptPubKey).public_key).toBe(mockAppEnvEncryptPubKeyData.public_key);
    });
  });

  describe("request validation", () => {
    it("should validate kms parameter", async () => {
      await expect(getAppEnvEncryptPubKey(client, { kms: "", app_id: "a".repeat(40) })).rejects.toThrow("KMS ID or slug is required");
    });

    it("should validate app_id length", async () => {
      await expect(getAppEnvEncryptPubKey(client, { kms: "test-kms", app_id: "short" })).rejects.toThrow("App ID must be exactly 40 characters");
      await expect(getAppEnvEncryptPubKey(client, { kms: "test-kms", app_id: "a".repeat(39) })).rejects.toThrow("App ID must be exactly 40 characters");
      await expect(getAppEnvEncryptPubKey(client, { kms: "test-kms", app_id: "a".repeat(41) })).rejects.toThrow("App ID must be exactly 40 characters");
    });
  });

  describe("error handling", () => {
    it("should throw on API errors", async () => {
      const apiError = new Error("KMS or App not found");
      mockGet.mockRejectedValue(apiError);

      await expect(getAppEnvEncryptPubKey(client, mockRequest)).rejects.toThrow("KMS or App not found");
    });
  });

  describe("edge cases", () => {
    it("should handle different KMS and App IDs", async () => {
      mockGet.mockResolvedValue(mockAppEnvEncryptPubKeyData);

      const differentRequest = {
        kms: "another-kms",
        app_id: "b".repeat(40),
      };

      await getAppEnvEncryptPubKey(client, differentRequest);

      expect(mockGet).toHaveBeenCalledWith(`/kms/${differentRequest.kms}/pubkey/${differentRequest.app_id}`);
    });

    it("should handle special characters in KMS ID", async () => {
      mockGet.mockResolvedValue(mockAppEnvEncryptPubKeyData);

      const specialRequest = {
        kms: "kms-123_test.special",
        app_id: "a".repeat(40),
      };

      await getAppEnvEncryptPubKey(client, specialRequest);

      expect(mockGet).toHaveBeenCalledWith(`/kms/${specialRequest.kms}/pubkey/${specialRequest.app_id}`);
    });

    it("should handle long public key and signature", async () => {
      const longKeyData = {
        public_key: "04" + "a".repeat(128),
        signature: "30440220" + "b".repeat(64) + "02" + "c".repeat(62),
      };

      mockGet.mockResolvedValue(longKeyData);

      const result = await getAppEnvEncryptPubKey(client, mockRequest);

      expect(result).toEqual(longKeyData);
    });
  });

  describe("safeGetAppEnvEncryptPubKey", () => {
    it("should return SafeResult on success", async () => {
      mockGet.mockResolvedValue(mockAppEnvEncryptPubKeyData);

      const result = await safeGetAppEnvEncryptPubKey(client, mockRequest);

      expect(mockGet).toHaveBeenCalledWith(`/kms/${mockRequest.kms}/pubkey/${mockRequest.app_id}`);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockAppEnvEncryptPubKeyData);
        expect((result.data as GetAppEnvEncryptPubKey).public_key).toBe(mockAppEnvEncryptPubKeyData.public_key);
      }
    });

    it("should return validation error for invalid request", async () => {
      const result = await safeGetAppEnvEncryptPubKey(client, { kms: "", app_id: "short" });
      expect(result.success).toBe(false);
      if (!result.success) {
        // @ts-expect-error: issues is not defined on RequestError
        expect(result.error.issues).toBeDefined();
      }
    });
  });
});
