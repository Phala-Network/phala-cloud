import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { createClient } from "../client";
import {
  getKmsInfo,
  safeGetKmsInfo,
  type GetKmsInfoRequest,
} from "./get_kms_info";
import type { KmsInfo } from "../types/kms_info";
import { SUPPORTED_CHAINS } from "../types/supported_chains";

// Mock response data matching the API structure
const mockKmsInfoData: KmsInfo = {
  id: "kms-123",
  slug: "test-kms",
  url: "https://kms.example.com",
  version: "1.0.0",
  chain_id: 1,
  kms_contract_address: "0x1234567890123456789012345678901234567890" as any,
  gateway_app_id: "0x123456789abcdef" as any,
  // chain will be added by schema transform; reflect it in expected
  chain: SUPPORTED_CHAINS[1],
};

describe("getKmsInfo", () => {
  let client: ReturnType<typeof createClient>;
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

  describe("getKmsInfo", () => {
    it("should return KMS info data successfully", async () => {
      mockGet.mockResolvedValue(mockKmsInfoData);

      const result = await getKmsInfo(client, { kms_id: "test-kms-id" });

      expect(mockGet).toHaveBeenCalledWith("/kms/test-kms-id");
      expect(result).toEqual(mockKmsInfoData);
      expect((result as KmsInfo).id).toBe("kms-123");
      expect((result as KmsInfo).url).toBe("https://kms.example.com");
    });

    it("should handle different KMS IDs correctly", async () => {
      mockGet.mockResolvedValue(mockKmsInfoData);

      await getKmsInfo(client, { kms_id: "another-kms-id" });

      expect(mockGet).toHaveBeenCalledWith("/kms/another-kms-id");
    });

    it("should validate request parameters", async () => {
      await expect(getKmsInfo(client, { kms_id: "" })).rejects.toThrow("KMS ID is required");
    });

    it("should validate response data with zod schema", async () => {
      const invalidData = {
        id: 123, // should be string
        url: null, // should be string
      };

      mockGet.mockResolvedValue(invalidData);

      await expect(getKmsInfo(client, { kms_id: "test-kms-id" })).rejects.toThrow();
    });

    it("should handle API errors properly", async () => {
      const apiError = new Error("KMS not found");
      mockGet.mockRejectedValue(apiError);

      await expect(getKmsInfo(client, { kms_id: "nonexistent-kms" })).rejects.toThrow("KMS not found");
    });

    it("should return raw data when schema is false", async () => {
      const rawData = { some: "raw", data: 123 };
      mockGet.mockResolvedValue(rawData);

      const result = await getKmsInfo(client, { kms_id: "test-kms-id" }, { schema: false });

      expect(result).toEqual(rawData);
    });

    it("should use custom schema when provided", async () => {
      const customSchema = z.object({
        id: z.string(),
        custom_field: z.string(),
      });
      const customData = { id: "test-id", custom_field: "test" };

      mockGet.mockResolvedValue(customData);

      const result = await getKmsInfo(client, { kms_id: "test-kms-id" }, { schema: customSchema });

      expect(result).toEqual(customData);
    });

    it("should throw when custom schema validation fails", async () => {
      const customSchema = z.object({
        id: z.string(),
        custom_field: z.string(),
      });
      const invalidData = { id: 123, custom_field: "test" };

      mockGet.mockResolvedValue(invalidData);

      await expect(getKmsInfo(client, { kms_id: "test-kms-id" }, { schema: customSchema })).rejects.toThrow();
    });

    it("should handle KMS with null optional fields", async () => {
      const kmsWithNulls: KmsInfo = {
        id: "kms-123",
        slug: null,
        url: "https://kms.example.com",
        version: "1.0.0",
        chain_id: null,
        // @ts-expect-error
        kms_contract_address: null,
        // @ts-expect-error
        gateway_app_id: null,
      };

      mockGet.mockResolvedValue(kmsWithNulls);

      const result = await getKmsInfo(client, { kms_id: "test-kms-id" });

      expect(result).toEqual(kmsWithNulls);
      expect((result as KmsInfo).slug).toBeNull();
      expect((result as KmsInfo).chain_id).toBeNull();
    });

    it("should handle KMS with passthrough fields", async () => {
      const kmsWithExtra = {
        ...mockKmsInfoData,
        extra_field: "extra_value",
        another_field: 123,
      };

      mockGet.mockResolvedValue(kmsWithExtra);

      const result = await getKmsInfo(client, { kms_id: "test-kms-id" });

      expect(result).toEqual(kmsWithExtra);
      expect((result as any).extra_field).toBe("extra_value");
    });
  });

  describe("safeGetKmsInfo", () => {
    it("should return success result when API call succeeds", async () => {
      mockGet.mockResolvedValue(mockKmsInfoData);

      const result = await safeGetKmsInfo(client, { kms_id: "test-kms-id" });

      expect(mockGet).toHaveBeenCalledWith("/kms/test-kms-id");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockKmsInfoData);
        expect((result.data as KmsInfo).id).toBe("kms-123");
      }
    });

    it("should return error result when API call fails", async () => {
      const apiError = new Error("KMS not found");
      (apiError as any).isRequestError = true;
      (apiError as any).status = 404;
      mockGet.mockRejectedValue(apiError);

      const result = await safeGetKmsInfo(client, { kms_id: "nonexistent-kms" });

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
        id: 123, // should be string
        url: null, // should be string
      };

      mockGet.mockResolvedValue(invalidData);

      const result = await safeGetKmsInfo(client, { kms_id: "test-kms-id" });

      expect(result.success).toBe(false);
      if (!result.success) {
        if (!("isRequestError" in result.error)) {
          expect(result.error.issues).toBeDefined();
        }
      }
    });

    it("should pass through HTTP errors directly", async () => {
      const error = new Error("internal server error");
      (error as any).isRequestError = true;
      (error as any).status = 500;
      mockGet.mockRejectedValue(error);

      const result = await safeGetKmsInfo(client, { kms_id: "test-kms-id" });

      expect(result.success).toBe(false);
      if (!result.success) {
        if ("isRequestError" in result.error) {
          expect(result.error.status).toBe(500);
        }
      }
    });

    it("should return raw data when schema is false", async () => {
      mockGet.mockResolvedValue(mockKmsInfoData);

      const result = await safeGetKmsInfo(client, { kms_id: "test-kms-id" }, { schema: false });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockKmsInfoData);
      }
    });

    it("should use custom schema when provided", async () => {
      const customSchema = z.object({
        id: z.string(),
        custom_field: z.string(),
      });
      const customData = { id: "test-id", custom_field: "test" };

      mockGet.mockResolvedValue(customData);

      const result = await safeGetKmsInfo(client, { kms_id: "test-kms-id" }, { schema: customSchema });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(customData);
      }
    });

    it("should return validation error when custom schema fails", async () => {
      const customSchema = z.object({
        id: z.string(),
        custom_field: z.string(),
      });
      const invalidData = { id: 123, custom_field: "test" };

      mockGet.mockResolvedValue(invalidData);

      const result = await safeGetKmsInfo(client, { kms_id: "test-kms-id" }, { schema: customSchema });

      expect(result.success).toBe(false);
      if (!result.success) {
        if (!("isRequestError" in result.error)) {
          expect(result.error.issues).toBeDefined();
        }
      }
    });

    it("should handle different KMS IDs correctly in safe version", async () => {
      mockGet.mockResolvedValue(mockKmsInfoData);

      await safeGetKmsInfo(client, { kms_id: "special-kms-456" });

      expect(mockGet).toHaveBeenCalledWith("/kms/special-kms-456");
    });

    it("should handle KMS with minimal data", async () => {
      const minimalKms: KmsInfo = {
        id: "minimal-kms",
        slug: null,
        url: "https://minimal.kms.com",
        version: "0.1.0",
        chain_id: null,
        // @ts-expect-error
        kms_contract_address: null,
        // @ts-expect-error
        gateway_app_id: null,
      };

      mockGet.mockResolvedValue(minimalKms);

      const result = await safeGetKmsInfo(client, { kms_id: "minimal-kms" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(minimalKms);
      }
    });
  });

  describe("edge cases", () => {
    it("should handle empty string KMS ID", async () => {
      await expect(getKmsInfo(client, { kms_id: "" })).rejects.toThrow("KMS ID is required");
    });

    it("should handle KMS ID with special characters", async () => {
      const specialId = "kms-123_test.special-id";
      mockGet.mockResolvedValue(mockKmsInfoData);

      await getKmsInfo(client, { kms_id: specialId });

      expect(mockGet).toHaveBeenCalledWith(`/kms/${specialId}`);
    });

    it("should handle very long KMS IDs", async () => {
      const longId = "a".repeat(256);
      mockGet.mockResolvedValue(mockKmsInfoData);

      await getKmsInfo(client, { kms_id: longId });

      expect(mockGet).toHaveBeenCalledWith(`/kms/${longId}`);
    });
  });

  describe("type inference", () => {
    it("should infer KmsInfo type when no schema provided", async () => {
      mockGet.mockResolvedValue(mockKmsInfoData);
      
      const result = await getKmsInfo(client, { kms_id: "test-kms-id" });
      
      // TypeScript should infer this as KmsInfo
      expect(result.id).toBe("kms-123");
      expect(result.url).toBe("https://kms.example.com");
      expect(result.chain_id).toBe(1);
    });

    it("should infer unknown type when schema is false", async () => {
      const rawResponse = { id: 1, custom_field: "extra" };
      mockGet.mockResolvedValue(rawResponse);
      
      const result = await getKmsInfo(client, { kms_id: "test-kms-id" }, { schema: false });
      
      // TypeScript should infer this as unknown
      expect(result).toEqual(rawResponse);
    });

    it("should infer custom schema type when provided", async () => {
      const customSchema = z.object({ id: z.number(), name: z.string() });
      const customResponse = { id: 1, name: "Test KMS" };
      mockGet.mockResolvedValue(customResponse);
      
      const result = await getKmsInfo(client, { kms_id: "test-kms-id" }, { schema: customSchema });
      
      // TypeScript should infer this as { id: number; name: string }
      expect(result.id).toBe(1);
      expect(result.name).toBe("Test KMS");
    });

    it("should enforce parameter type safety", async () => {
      mockGet.mockResolvedValue(mockKmsInfoData);
      
      // @ts-expect-error - schema should be ZodSchema | false | undefined
      await expect(getKmsInfo(client, { kms_id: "test-kms-id" }, { schema: "invalid" })).rejects.toThrow("Invalid schema");
      
      // @ts-expect-error - unknown parameter
      await getKmsInfo(client, { kms_id: "test-kms-id" }, { unknownParam: true });
      
      // @ts-expect-error - missing required kmsId
      await expect(getKmsInfo(client, {})).rejects.toThrow("Required");
      
      // Valid parameters should compile
      const request: GetKmsInfoRequest = { kms_id: "test-kms-id" };
      await getKmsInfo(client, request);

      // Test with custom schema - use appropriate mock data
      const customSchema = z.object({ id: z.number() });
      const customMockData = { id: 123 };
      mockGet.mockResolvedValueOnce(customMockData);
      await getKmsInfo(client, request, { schema: customSchema });
    });
  });

  describe("request validation in safe version", () => {
    it("should validate request parameters before making API call", async () => {
      const result = await safeGetKmsInfo(client, { kms_id: "" });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        // @ts-expect-error
        expect(result.error.issues).toBeDefined();
        // @ts-expect-error
        expect(result.error.issues[0].message).toBe("KMS ID is required");
        // @ts-expect-error
        expect(result.error.issues[0].code).toBe("too_small");
      }
      
      // API call should not be made
      expect(mockSafeGet).not.toHaveBeenCalled();
    });

    it("should validate request object structure", async () => {
      // @ts-expect-error - Testing runtime behavior with invalid type
      const result = await safeGetKmsInfo(client, { wrongField: "test" });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        // @ts-expect-error
        expect(result.error.issues).toBeDefined();
        // @ts-expect-error
        expect(result.error.issues[0].code).toBe("invalid_type");
      }
    });
  });

  describe("client method behavior", () => {
    it("should use client.get in standard version", async () => {
      mockGet.mockResolvedValue(mockKmsInfoData);

      await getKmsInfo(client, { kms_id: "test-kms-id" });

      expect(mockGet).toHaveBeenCalledWith("/kms/test-kms-id");
    });

    it("should use client.get in safe version (wrapped by safeAction)", async () => {
      mockGet.mockResolvedValue(mockKmsInfoData);

      const result = await safeGetKmsInfo(client, { kms_id: "test-kms-id" });

      expect(mockGet).toHaveBeenCalledWith("/kms/test-kms-id");
      expect(result.success).toBe(true);
    });

    it("should handle errors from client.get", async () => {
      const error = new Error("Network error");
      mockGet.mockRejectedValue(error);

      await expect(getKmsInfo(client, { kms_id: "test-kms-id" })).rejects.toThrow("Network error");
    });
  });

  describe("parameter validation", () => {
    it("should reject invalid parameter types at runtime", async () => {
      mockGet.mockResolvedValue(mockKmsInfoData);

      // @ts-expect-error - Testing runtime behavior with invalid type
      await expect(getKmsInfo(client, { kms_id: 123 })).rejects.toThrow();
      
      // @ts-expect-error - Testing runtime behavior with invalid type
      await expect(getKmsInfo(client, { kms_id: "test-kms-id" }, { schema: 123 })).rejects.toThrow();
      
      // @ts-expect-error - Testing runtime behavior with invalid type
      await expect(getKmsInfo(client, { kms_id: "test-kms-id" }, { schema: "invalid" })).rejects.toThrow();
      
      // @ts-expect-error - Testing runtime behavior with invalid type
      await expect(getKmsInfo(client, { kms_id: "test-kms-id" }, { schema: {} })).rejects.toThrow();
    });
  });
}); 