import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { createClient } from "../client";
import {
  getAppEnvEncryptPubKey,
  safeGetAppEnvEncryptPubKey,
  GetAppEnvEncryptPubKeySchema,
  GetAppEnvEncryptPubKeyRequestSchema,
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

  describe("getAppEnvEncryptPubKey", () => {
    it("should return app env encrypt pubkey data successfully", async () => {
      mockGet.mockResolvedValue(mockAppEnvEncryptPubKeyData);

      const result = await getAppEnvEncryptPubKey(client, mockRequest);

      expect(mockGet).toHaveBeenCalledWith(`/kms/${mockRequest.kms}/pubkey/${mockRequest.app_id}`);
      expect(result).toEqual(mockAppEnvEncryptPubKeyData);
      expect((result as GetAppEnvEncryptPubKey).public_key).toBe(mockAppEnvEncryptPubKeyData.public_key);
      expect((result as GetAppEnvEncryptPubKey).signature).toBe(mockAppEnvEncryptPubKeyData.signature);
    });

    it("should handle different KMS and App IDs correctly", async () => {
      mockGet.mockResolvedValue(mockAppEnvEncryptPubKeyData);

      const differentRequest = {
        kms: "another-kms",
        app_id: "b".repeat(40),
      };

      await getAppEnvEncryptPubKey(client, differentRequest);

      expect(mockGet).toHaveBeenCalledWith(`/kms/${differentRequest.kms}/pubkey/${differentRequest.app_id}`);
    });

    it("should validate request payload structure", async () => {
      // Test empty KMS
      await expect(getAppEnvEncryptPubKey(client, { kms: "", app_id: "a".repeat(40) })).rejects.toThrow("KMS ID or slug is required");

      // Test invalid appId length
      await expect(getAppEnvEncryptPubKey(client, { kms: "test-kms", app_id: "short" })).rejects.toThrow("App ID must be exactly 40 characters");
      await expect(getAppEnvEncryptPubKey(client, { kms: "test-kms", app_id: "a".repeat(39) })).rejects.toThrow("App ID must be exactly 40 characters");
      await expect(getAppEnvEncryptPubKey(client, { kms: "test-kms", app_id: "a".repeat(41) })).rejects.toThrow("App ID must be exactly 40 characters");

      // Test valid request
      const validRequest = { kms: "test-kms", app_id: "a".repeat(40) };
      expect(GetAppEnvEncryptPubKeyRequestSchema.parse(validRequest)).toEqual(validRequest);
    });

    it("should validate response data with zod schema", async () => {
      const invalidData = {
        public_key: 123, // should be string
        signature: null, // should be string
      };

      mockGet.mockResolvedValue(invalidData);

      await expect(getAppEnvEncryptPubKey(client, mockRequest)).rejects.toThrow();
    });

    it("should handle API errors properly", async () => {
      const apiError = new Error("KMS or App not found");
      mockGet.mockRejectedValue(apiError);

      await expect(getAppEnvEncryptPubKey(client, mockRequest)).rejects.toThrow("KMS or App not found");
    });

    it("should return raw data when schema is false", async () => {
      const rawData = { some: "raw", data: 123 };
      mockGet.mockResolvedValue(rawData);

      const result = await getAppEnvEncryptPubKey(client, mockRequest, { schema: false });

      expect(result).toEqual(rawData);
    });

    it("should use custom schema when provided", async () => {
      const customSchema = z.object({
        custom_key: z.string(),
        custom_signature: z.string(),
      });
      const customData = { 
        custom_key: "custom-key-data",
        custom_signature: "custom-signature-data",
      };

      mockGet.mockResolvedValue(customData);

      const result = await getAppEnvEncryptPubKey(client, mockRequest, { schema: customSchema });

      expect(result).toEqual(customData);
    });

    it("should throw when custom schema validation fails", async () => {
      const customSchema = z.object({
        custom_key: z.string(),
        custom_signature: z.string(),
      });
      const invalidData = { custom_key: 123, custom_signature: "test" };

      mockGet.mockResolvedValue(invalidData);

      await expect(getAppEnvEncryptPubKey(client, mockRequest, { schema: customSchema })).rejects.toThrow();
    });

    it("should handle special characters in IDs", async () => {
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
        public_key: "04" + "a".repeat(128), // Long hex string
        signature: "30440220" + "b".repeat(64) + "02" + "c".repeat(62), // Long signature
      };

      mockGet.mockResolvedValue(longKeyData);

      const result = await getAppEnvEncryptPubKey(client, mockRequest);

      expect(result).toEqual(longKeyData);
    });
  });

  describe("safeGetAppEnvEncryptPubKey", () => {
    it("should return success result when API call succeeds", async () => {
      mockGet.mockResolvedValue(mockAppEnvEncryptPubKeyData);

      const result = await safeGetAppEnvEncryptPubKey(client, mockRequest);

      expect(mockGet).toHaveBeenCalledWith(`/kms/${mockRequest.kms}/pubkey/${mockRequest.app_id}`);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockAppEnvEncryptPubKeyData);
        expect((result.data as GetAppEnvEncryptPubKey).public_key).toBe(mockAppEnvEncryptPubKeyData.public_key);
      }
    });

    it("should return error result when API call fails", async () => {
      const error = new Error("KMS not found");
      (error as any).isRequestError = true;
      (error as any).status = 404;
      (error as any).detail = "KMS not found";
      mockGet.mockRejectedValue(error);

      const result = await safeGetAppEnvEncryptPubKey(client, mockRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("KMS not found");
        if ("isRequestError" in result.error) {
          expect(result.error.isRequestError).toBe(true);
          expect(result.error.status).toBe(404);
        }
      }
    });

    it("should handle zod validation errors", async () => {
      const invalidData = {
        public_key: 123, // should be string
        signature: null, // should be string
      };

      mockGet.mockResolvedValue(invalidData);

      const result = await safeGetAppEnvEncryptPubKey(client, mockRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        if (!("isRequestError" in result.error)) {
          expect(result.error.issues).toBeDefined();
        }
      }
    });

    it("should pass through HTTP errors directly", async () => {
      const error = new Error("forbidden");
      (error as any).isRequestError = true;
      (error as any).status = 403;
      mockGet.mockRejectedValue(error);

      const result = await safeGetAppEnvEncryptPubKey(client, mockRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        if ("isRequestError" in result.error) {
          expect(result.error.status).toBe(403);
        }
      }
    });

    it("should return raw data when schema is false", async () => {
      mockGet.mockResolvedValue(mockAppEnvEncryptPubKeyData);

      const result = await safeGetAppEnvEncryptPubKey(client, mockRequest, { schema: false });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockAppEnvEncryptPubKeyData);
      }
    });

    it("should use custom schema when provided", async () => {
      const customSchema = z.object({
        custom_key: z.string(),
        custom_signature: z.string(),
      });
      const customData = {
        custom_key: "custom-key-data",
        custom_signature: "custom-signature-data",
      };

      mockGet.mockResolvedValue(customData);

      const result = await safeGetAppEnvEncryptPubKey(client, mockRequest, { schema: customSchema });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(customData);
      }
    });

    it("should return validation error when custom schema fails", async () => {
      const customSchema = z.object({
        custom_key: z.string(),
        custom_signature: z.string(),
      });
      const invalidData = { custom_key: 123, custom_signature: "test" };

      mockGet.mockResolvedValue(invalidData);

      const result = await safeGetAppEnvEncryptPubKey(client, mockRequest, { schema: customSchema });

      expect(result.success).toBe(false);
      if (!result.success) {
        if (!("isRequestError" in result.error)) {
          expect(result.error.issues).toBeDefined();
        }
      }
    });

    it("should handle different request payloads in safe version", async () => {
      mockGet.mockResolvedValue(mockAppEnvEncryptPubKeyData);

      const anotherRequest = {
        kms: "production-kms",
        app_id: "c".repeat(40),
      };

      await safeGetAppEnvEncryptPubKey(client, anotherRequest);

      expect(mockGet).toHaveBeenCalledWith(`/kms/${anotherRequest.kms}/pubkey/${anotherRequest.app_id}`);
    });

    it("should handle empty string responses", async () => {
      const emptyData = {
        public_key: "",
        signature: "",
      };

      mockGet.mockResolvedValue(emptyData);

      const result = await safeGetAppEnvEncryptPubKey(client, mockRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(emptyData);
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

  describe("edge cases", () => {
    it("should reject empty string IDs", async () => {
      const emptyRequest = {
        kms: "",
        app_id: "a".repeat(40),
      };

      await expect(getAppEnvEncryptPubKey(client, emptyRequest)).rejects.toThrow("KMS ID or slug is required");
    });

    it("should handle URL encoding in IDs", async () => {
      mockGet.mockResolvedValue(mockAppEnvEncryptPubKeyData);

      const encodedRequest = {
        kms: "kms with spaces",
        app_id: "a".repeat(40),
      };

      await getAppEnvEncryptPubKey(client, encodedRequest);

      expect(mockGet).toHaveBeenCalledWith(`/kms/${encodedRequest.kms}/pubkey/${encodedRequest.app_id}`);
    });

    it("should validate schema structure", async () => {
      // Test the schema validation
      expect(() => {
        GetAppEnvEncryptPubKeySchema.parse({
          public_key: "valid-key",
          signature: "valid-signature",
        });
      }).not.toThrow();

      expect(() => {
        GetAppEnvEncryptPubKeySchema.parse({
          public_key: "valid-key",
          // missing signature
        });
      }).toThrow();
    });
  });
}); 