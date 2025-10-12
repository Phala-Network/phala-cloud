import { describe, it, expect, vi, beforeEach } from "vitest";
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

  describe("API routing & basic success", () => {
    it("should call correct endpoint with kms_id", async () => {
      mockGet.mockResolvedValue(mockKmsInfoData);

      const result = await getKmsInfo(client, { kms_id: "test-kms-id" });

      expect(mockGet).toHaveBeenCalledWith("/kms/test-kms-id");
      expect(result).toEqual(mockKmsInfoData);
      expect((result as KmsInfo).id).toBe("kms-123");
    });
  });

  describe("request validation", () => {
    it("should validate kms_id parameter", async () => {
      await expect(getKmsInfo(client, { kms_id: "" })).rejects.toThrow("KMS ID is required");
    });
  });

  describe("error handling", () => {
    it("should throw on API errors", async () => {
      const apiError = new Error("KMS not found");
      mockGet.mockRejectedValue(apiError);

      await expect(getKmsInfo(client, { kms_id: "nonexistent-kms" })).rejects.toThrow("KMS not found");
    });
  });

  describe("edge cases", () => {
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

    it("should handle KMS ID with special characters", async () => {
      const specialId = "kms-123_test.special-id";
      mockGet.mockResolvedValue(mockKmsInfoData);

      await getKmsInfo(client, { kms_id: specialId });

      expect(mockGet).toHaveBeenCalledWith(`/kms/${specialId}`);
    });

    it("should handle different KMS IDs correctly", async () => {
      mockGet.mockResolvedValue(mockKmsInfoData);

      await getKmsInfo(client, { kms_id: "another-kms-id" });

      expect(mockGet).toHaveBeenCalledWith("/kms/another-kms-id");
    });
  });

  describe("safeGetKmsInfo", () => {
    it("should return SafeResult on success", async () => {
      mockGet.mockResolvedValue(mockKmsInfoData);

      const result = await safeGetKmsInfo(client, { kms_id: "test-kms-id" });

      expect(mockGet).toHaveBeenCalledWith("/kms/test-kms-id");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockKmsInfoData);
        expect((result.data as KmsInfo).id).toBe("kms-123");
      }
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
}); 