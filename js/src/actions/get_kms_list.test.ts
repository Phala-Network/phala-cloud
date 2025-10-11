import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "../client";
import { getKmsList, safeGetKmsList } from "./get_kms_list";
import type { KmsInfo } from "../types/kms_info";
import { SUPPORTED_CHAINS } from "../types/supported_chains";

// Mock response data matching the API structure
const mockKmsData: KmsInfo = {
  id: "kms-123",
  slug: "test-kms",
  url: "https://kms.example.com",
  version: "1.0.0",
  chain_id: 1,
  kms_contract_address: "0x1234567890123456789012345678901234567890" as any,
  gateway_app_id: "0x123456789abcdef" as any,
  chain: SUPPORTED_CHAINS[1],
};

const mockKmsListData = {
  items: [mockKmsData],
  total: 1,
  page: 1,
  page_size: 10,
  pages: 1,
};

describe("getKmsList", () => {
  let client: ReturnType<typeof createClient>;
  let mockGet: any;

  beforeEach(() => {
    client = createClient({
      apiKey: "test-api-key",
      baseURL: "https://api.test.com",
    });
    mockGet = vi.spyOn(client, "get");
  });

  describe("API routing & basic success", () => {
    it("should call correct endpoint with pagination params", async () => {
      mockGet.mockResolvedValue(mockKmsListData);

      const result = await getKmsList(client, { page: 2, page_size: 20 });

      expect(mockGet).toHaveBeenCalledWith("/kms", { params: { page: 2, page_size: 20 } });
      expect(result).toEqual(mockKmsListData);
    });
  });

  describe("request validation", () => {
    it("should validate pagination parameters", async () => {
      await expect(getKmsList(client, { page: 0 })).rejects.toThrow();
      await expect(getKmsList(client, { page_size: 0 })).rejects.toThrow();
      await expect(getKmsList(client, { page: -1 })).rejects.toThrow();
      await expect(getKmsList(client, { page_size: -1 })).rejects.toThrow();
      await expect(getKmsList(client, { page: 1.5 })).rejects.toThrow();
      await expect(getKmsList(client, { page_size: 1.5 })).rejects.toThrow();
    });

    it("should reject unknown request fields", async () => {
      // @ts-expect-error - Testing runtime behavior with invalid field
      await expect(getKmsList(client, { unknownField: "value" })).rejects.toThrow();
    });
  });

  describe("error handling", () => {
    it("should throw on API errors", async () => {
      const apiError = new Error("KMS service unavailable");
      mockGet.mockRejectedValue(apiError);

      await expect(getKmsList(client)).rejects.toThrow("KMS service unavailable");
    });
  });

  describe("edge cases", () => {
    it("should handle empty KMS list", async () => {
      const emptyList = {
        items: [],
        total: 0,
        page: 1,
        page_size: 10,
        pages: 0,
      };

      mockGet.mockResolvedValue(emptyList);

      const result = await getKmsList(client);

      expect(result).toEqual(emptyList);
      expect(result.items).toHaveLength(0);
    });

    it("should handle multiple KMS instances", async () => {
      const multipleKmsData = {
        items: [
          mockKmsData,
          {
            ...mockKmsData,
            id: "kms-456",
            slug: "another-kms",
            url: "https://kms2.example.com",
          },
        ],
        total: 2,
        page: 1,
        page_size: 10,
        pages: 1,
      };

      mockGet.mockResolvedValue(multipleKmsData);

      const result = await getKmsList(client);

      expect(result).toEqual(multipleKmsData);
      expect(result.items).toHaveLength(2);
    });
  });

  describe("safeGetKmsList", () => {
    it("should return SafeResult on success", async () => {
      mockGet.mockResolvedValue(mockKmsListData);

      const result = await safeGetKmsList(client);

      expect(mockGet).toHaveBeenCalledWith("/kms", { params: {} });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockKmsListData);
        expect(result.data.items).toHaveLength(1);
      }
    });

    it("should handle null values in KMS data", async () => {
      const kmsWithNulls = {
        items: [
          {
            id: "kms-123",
            slug: null,
            url: "https://kms.example.com",
            version: "1.0.0",
            chain_id: null,
            kms_contract_address: null,
            gateway_app_id: null,
          },
        ],
        total: 1,
        page: 1,
        page_size: 10,
        pages: 1,
      };

      mockGet.mockResolvedValue(kmsWithNulls);

      const result = await safeGetKmsList(client);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(kmsWithNulls);
      }
    });
  });
});
