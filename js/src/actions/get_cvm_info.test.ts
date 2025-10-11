import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { createClient } from "../client";
import {
  getCvmInfo,
  safeGetCvmInfo,
  GetCvmInfoSchema,
  type GetCvmInfoResponse,
} from "./get_cvm_info";
import type { CvmLegacyDetail } from "../types/cvm_info";

// Mock response data matching the CvmLegacyDetailSchema structure
const mockCvmInfoData: CvmLegacyDetail = {
  id: 123,
  name: "test-cvm",
  status: "running",
  in_progress: false,
  teepod_id: 456,
  teepod: {
    id: 456,
    name: "test-node",
    region_identifier: "us-west-1",
  },
  app_id: "app-123",
  vm_uuid: "123e4567-e89b-42d3-a456-556642440000",
  instance_id: "instance-123",
  vcpu: 2,
  memory: 4096,
  disk_size: 40,
  base_image: "ubuntu:20.04",
  encrypted_env_pubkey: "0x1234567890abcdef",
  listed: true,
  project_id: "project-123",
  project_type: "webapp",
  public_sysinfo: true,
  public_logs: true,
  dapp_dashboard_url: "https://dashboard.example.com",
  syslog_endpoint: "https://syslog.example.com",
  kms_info: {
    id: "kms-123",
    slug: "test-kms",
    url: "https://kms.example.com",
    version: "1.0.0",
    chain_id: 1,
    kms_contract_address: "0x1234567890123456789012345678901234567890",
    gateway_app_id: "gateway-123",
    chain: {
      id: 1,
      name: "Ethereum",
      nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18
      },
      rpcUrls: {
        default: {
          http: ["https://eth.merkle.io"]
        }
      },
      blockExplorers: {
        default: {
          name: "Etherscan",
          url: "https://etherscan.io",
          apiUrl: "https://api.etherscan.io/api"
        }
      },
      contracts: {
        ensRegistry: {
          address: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
        },
        ensUniversalResolver: {
          address: "0xce01f8eee7E479C928F8919abD53E553a36CeF67",
          blockCreated: 19258213
        },
        multicall3: {
          address: "0xca11bde05977b3631167028862be2a173976ca11",
          blockCreated: 14353601
        }
      }
    }
  },
  contract_address: "0x9876543210987654321098765432109876543210",
  deployer_address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  scheduled_delete_at: "2024-12-31T23:59:59Z",
  public_urls: [
    {
      app: "https://app.example.com",
      instance: "https://instance.example.com",
    },
  ],
  gateway_domain: "gateway.example.com",
};

describe("getCvmInfo", () => {
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

  describe("getCvmInfo", () => {
    it("should return CVM info data successfully with id", async () => {
      mockGet.mockResolvedValue(mockCvmInfoData);

      const result = await getCvmInfo(client, { id: "test-cvm-id" });

      expect(mockGet).toHaveBeenCalledWith("/cvms/test-cvm-id");
      expect(result).toEqual(mockCvmInfoData);
      expect((result as CvmLegacyDetail).name).toBe("test-cvm");
      expect((result as CvmLegacyDetail).status).toBe("running");
    });

    it("should return CVM info data successfully with uuid", async () => {
      mockGet.mockResolvedValue(mockCvmInfoData);

      const result = await getCvmInfo(client, { uuid: "123e4567-e89b-42d3-a456-556642440000" });

      expect(mockGet).toHaveBeenCalledWith("/cvms/123e4567-e89b-42d3-a456-556642440000");
      expect(result).toEqual(mockCvmInfoData);
    });

    it("should return CVM info data successfully with appId", async () => {
      mockGet.mockResolvedValue(mockCvmInfoData);

      const app_id = "a".repeat(40);
      const result = await getCvmInfo(client, { app_id });

      expect(mockGet).toHaveBeenCalledWith(`/cvms/app_${app_id}`);
      expect(result).toEqual(mockCvmInfoData);
    });

    it("should return CVM info data successfully with instanceId", async () => {
      mockGet.mockResolvedValue(mockCvmInfoData);

      const instance_id = "b".repeat(40);
      const result = await getCvmInfo(client, { instance_id });

      expect(mockGet).toHaveBeenCalledWith(`/cvms/instance_${instance_id}`);
      expect(result).toEqual(mockCvmInfoData);
    });

    it("should validate request parameters", async () => {
      // No identifier provided
      await expect(getCvmInfo(client, {})).rejects.toThrow("One of id, uuid, app_id, or instance_id must be provided");

      // Invalid UUID format
      await expect(getCvmInfo(client, { uuid: "invalid-uuid" })).rejects.toThrow();

      // Invalid appId length
      await expect(getCvmInfo(client, { app_id: "short" })).rejects.toThrow("app_id should be 40 characters without prefix");

      // Invalid instanceId length
      await expect(getCvmInfo(client, { instance_id: "short" })).rejects.toThrow("instance_id should be 40 characters without prefix");

      // appId without prefix (should be transformed to add prefix)  
      mockGet.mockResolvedValue(mockCvmInfoData);
      const app_id = "a".repeat(40);
      await getCvmInfo(client, { app_id });
      expect(mockGet).toHaveBeenCalledWith(`/cvms/app_${app_id}`);

      // instanceId without prefix (should be transformed to add prefix)
      const instance_id = "b".repeat(40);
      await getCvmInfo(client, { instance_id });
      expect(mockGet).toHaveBeenCalledWith(`/cvms/instance_${instance_id}`);
    });

    it("should validate response data with zod schema", async () => {
      const invalidData = {
        name: 123, // should be string
        status: null, // should be string
      };

      mockGet.mockResolvedValue(invalidData);

      await expect(getCvmInfo(client, { id: "test-cvm-id" })).rejects.toThrow();
    });

    it("should handle API errors properly", async () => {
      const apiError = new Error("CVM not found");
      mockGet.mockRejectedValue(apiError);

      await expect(getCvmInfo(client, { id: "nonexistent-cvm" })).rejects.toThrow("CVM not found");
    });

    it("should return raw data when schema is false", async () => {
      const rawData = { some: "raw", data: 123 };
      mockGet.mockResolvedValue(rawData);

      const result = await getCvmInfo(client, { id: "test-cvm-id" }, { schema: false });

      expect(result).toEqual(rawData);
    });

    it("should use custom schema when provided", async () => {
      const customSchema = z.object({
        id: z.string(),
        custom: z.string(),
      });
      const customData = { id: "test-id", custom: "test" };

      mockGet.mockResolvedValue(customData);

      const result = await getCvmInfo(client, { id: "test-cvm-id" }, { schema: customSchema });

      expect(result).toEqual(customData);
    });

    it("should throw when custom schema validation fails", async () => {
      const customSchema = z.object({
        id: z.string(),
        custom: z.string(),
      });
      const invalidData = { id: 123, custom: "test" };

      mockGet.mockResolvedValue(invalidData);

      await expect(getCvmInfo(client, { id: "test-cvm-id" }, { schema: customSchema })).rejects.toThrow();
    });

    it("should handle partial CVM data correctly with schema disabled", async () => {
      const partialData = {
        name: "minimal-cvm",
        status: "stopped",
        listed: false,
      };

      mockGet.mockResolvedValue(partialData);

      const result = await getCvmInfo(client, { id: "test-cvm-id" }, { schema: false });

      expect(result).toEqual(partialData);
      expect(result.name).toBe("minimal-cvm");
    });
  });

  describe("safeGetCvmInfo", () => {
    it("should return success result when API call succeeds", async () => {
      mockGet.mockResolvedValue(mockCvmInfoData);

      const result = await safeGetCvmInfo(client, { id: "test-cvm-id" });

      expect(mockGet).toHaveBeenCalledWith("/cvms/test-cvm-id");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockCvmInfoData);
        expect((result.data as CvmLegacyDetail).name).toBe("test-cvm");
      }
    });

    it("should return error result when API call fails", async () => {
      const error = new Error("CVM not found");
      (error as any).isRequestError = true;
      (error as any).status = 404;
      (error as any).detail = "CVM not found";
      mockGet.mockRejectedValue(error);

      const result = await safeGetCvmInfo(client, { id: "nonexistent-cvm" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("CVM not found");
        if ("isRequestError" in result.error) {
          expect(result.error.isRequestError).toBe(true);
          expect(result.error.status).toBe(404);
        }
      }
    });

    it("should handle zod validation errors", async () => {
      const invalidData = {
        name: 123, // should be string
        status: null, // should be string
      };

      mockGet.mockResolvedValue(invalidData);

      const result = await safeGetCvmInfo(client, { id: "test-cvm-id" });

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

      const result = await safeGetCvmInfo(client, { id: "test-cvm-id" });

      expect(result.success).toBe(false);
      if (!result.success) {
        if ("isRequestError" in result.error) {
          expect(result.error.status).toBe(500);
        }
      }
    });

    it("should return raw data when schema is false", async () => {
      mockGet.mockResolvedValue(mockCvmInfoData);

      const result = await safeGetCvmInfo(client, { id: "test-cvm-id" }, { schema: false });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockCvmInfoData);
      }
    });

    it("should use custom schema when provided", async () => {
      const customSchema = z.object({
        id: z.string(),
        custom: z.string(),
      });
      const customData = { id: "test-id", custom: "test" };

      mockGet.mockResolvedValue(customData);

      const result = await safeGetCvmInfo(client, { id: "test-cvm-id" }, { schema: customSchema });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(customData);
      }
    });

    it("should return validation error when custom schema fails", async () => {
      const customSchema = z.object({
        id: z.string(),
        custom: z.string(),
      });
      const invalidData = { id: 123, custom: "test" };

      mockGet.mockResolvedValue(invalidData);

      const result = await safeGetCvmInfo(client, { id: "test-cvm-id" }, { schema: customSchema });

      expect(result.success).toBe(false);
      if (!result.success) {
        if (!("isRequestError" in result.error)) {
          expect(result.error.issues).toBeDefined();
        }
      }
    });

    it("should handle different CVM IDs correctly in safe version", async () => {
      mockGet.mockResolvedValue(mockCvmInfoData);

      await safeGetCvmInfo(client, { id: "special-cvm-123" });

      expect(mockGet).toHaveBeenCalledWith("/cvms/special-cvm-123");
    });

    it("should handle request validation errors in safe version", async () => {
      const result = await safeGetCvmInfo(client, {});
      expect(result.success).toBe(false);
      if (!result.success) {
        // @ts-expect-error: issues is not defined on RequestError
        expect(result.error.issues).toBeDefined();
      }
    });
  });

  describe("edge cases", () => {
    it("should handle empty string CVM ID", async () => {
      const result = await safeGetCvmInfo(client, { id: "" });
      expect(result.success).toBe(false);
    });

    it("should handle CVM ID with special characters", async () => {
      const specialId = "cvm-123-test_special.id";
      mockGet.mockResolvedValue(mockCvmInfoData);

      await getCvmInfo(client, { id: specialId });

      expect(mockGet).toHaveBeenCalledWith(`/cvms/${specialId}`);
    });

    it("should handle multiple identifiers", async () => {
      mockGet.mockResolvedValue(mockCvmInfoData);

      // When multiple identifiers are provided, it should use them in order: id > uuid > appId > instanceId
      const uuid = "123e4567-e89b-42d3-a456-556642440000";
      const app_id = "a".repeat(40);
      const instance_id = "b".repeat(40);

      await getCvmInfo(client, { id: "test-id", uuid, app_id, instance_id });
      expect(mockGet).toHaveBeenCalledWith("/cvms/test-id");

      await getCvmInfo(client, { uuid, app_id, instance_id });
      expect(mockGet).toHaveBeenCalledWith(`/cvms/${uuid}`);

      await getCvmInfo(client, { app_id, instance_id });
      expect(mockGet).toHaveBeenCalledWith(`/cvms/app_${app_id}`);

      await getCvmInfo(client, { instance_id });
      expect(mockGet).toHaveBeenCalledWith(`/cvms/instance_${instance_id}`);
    });
  });
}); 