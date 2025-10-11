import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { createClient } from "../client";
import {
  getCvmList,
  safeGetCvmList,
  GetCvmListSchema,
  type GetCvmListResponse,
} from "./get_cvm_list";
import type { CvmInfo } from "../types/cvm_info";

// Mock response data matching the API structure
const mockCvmData: CvmInfo = {
  hosted: {
    id: "vm-123",
    name: "test-vm",
    status: "running",
    uptime: "24h",
    app_url: "https://app.example.com",
    app_id: "app-123",
    instance_id: "instance-123",
    configuration: {},
    exited_at: null,
    boot_progress: null,
    boot_error: null,
    shutdown_progress: null,
    image_version: "1.0.0",
  },
  name: "test-cvm",
  managed_user: {
    id: 1,
    username: "testuser",
  },
  node: {
    id: 1,
    name: "test-node",
    region_identifier: "us-west-1",
  },
  listed: true,
  status: "running",
  in_progress: false,
  dapp_dashboard_url: "https://dashboard.example.com",
  syslog_endpoint: "https://syslog.example.com",
  allow_upgrade: true,
  project_id: "project-123",
  project_type: "webapp",
  billing_period: "monthly",
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
  vcpu: 2,
  memory: 4096,
  disk_size: 40,
  gateway_domain: "gateway.example.com",
  public_urls: [
    {
      app: "https://app.example.com",
      instance: "https://instance.example.com",
    },
  ],
};

const mockCvmListData: GetCvmListResponse = {
  items: [mockCvmData],
  total: 1,
  page: 1,
  page_size: 10,
  pages: 1,
};

describe("getCvmList", () => {
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

  describe("getCvmList", () => {
    it("should return CVM list data successfully", async () => {
      mockGet.mockResolvedValue(mockCvmListData);

      const result = await getCvmList(client);

      expect(mockGet).toHaveBeenCalledWith("/cvms/paginated", { params: {} });
      expect(result).toEqual(mockCvmListData);
      expect((result as GetCvmListResponse).items).toHaveLength(1);
      expect((result as GetCvmListResponse).total).toBe(1);
    });

    it("should handle query parameters correctly", async () => {
      mockGet.mockResolvedValue(mockCvmListData);

      await getCvmList(client, {
        page: 2,
        page_size: 20,
        node_id: 123,
      });

      expect(mockGet).toHaveBeenCalledWith("/cvms/paginated", {
        params: {
          page: 2,
          page_size: 20,
          node_id: 123,
        },
      });
    });

    it("should handle partial query parameters", async () => {
      mockGet.mockResolvedValue(mockCvmListData);

      await getCvmList(client, { page: 1 });

      expect(mockGet).toHaveBeenCalledWith("/cvms/paginated", {
        params: { page: 1 },
      });
    });

    it("should validate response data with zod schema", async () => {
      const invalidData = {
        items: "invalid", // should be array
        total: "invalid", // should be number
      };

      mockGet.mockResolvedValue(invalidData);

      await expect(getCvmList(client)).rejects.toThrow();
    });

    it("should handle API errors properly", async () => {
      const apiError = new Error("API Error");
      mockGet.mockRejectedValue(apiError);

      await expect(getCvmList(client)).rejects.toThrow("API Error");
    });

    it("should return raw data when schema is false", async () => {
      const rawData = { some: "raw", data: 123 };
      mockGet.mockResolvedValue(rawData);

      const result = await getCvmList(client, undefined, { schema: false });

      expect(result).toEqual(rawData);
    });

    it("should use custom schema when provided", async () => {
      const customSchema = z.object({
        custom: z.string(),
      });
      const customData = { custom: "test" };

      mockGet.mockResolvedValue(customData);

      const result = await getCvmList(client, undefined, { schema: customSchema });

      expect(result).toEqual(customData);
    });

    it("should throw when custom schema validation fails", async () => {
      const customSchema = z.object({
        custom: z.string(),
      });
      const invalidData = { custom: 123 };

      mockGet.mockResolvedValue(invalidData);

      await expect(getCvmList(client, undefined, { schema: customSchema })).rejects.toThrow();
    });
  });

  describe("safeGetCvmList", () => {
    it("should return success result when API call succeeds", async () => {
      mockGet.mockResolvedValue(mockCvmListData);

      const result = await safeGetCvmList(client);

      expect(mockGet).toHaveBeenCalledWith("/cvms/paginated", { params: {} });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockCvmListData);
        expect((result.data as GetCvmListResponse).items).toHaveLength(1);
      }
    });

    it("should return error result when API call fails", async () => {
      const apiError = new Error("Network Error");
      (apiError as any).isRequestError = true;
      mockGet.mockRejectedValue(apiError);

      const result = await safeGetCvmList(client);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Network Error");
        if ("isRequestError" in result.error) {
          expect(result.error.isRequestError).toBe(true);
        }
      }
    });

    it("should handle zod validation errors", async () => {
      const invalidData = {
        items: "invalid", // should be array
        total: "invalid", // should be number
      };

      mockGet.mockResolvedValue(invalidData);

      const result = await safeGetCvmList(client);

      expect(result.success).toBe(false);
      if (!result.success) {
        if (!("isRequestError" in result.error)) {
          expect(result.error.issues).toBeDefined();
        }
      }
    });

    it("should pass through HTTP errors directly", async () => {
      const error = new Error("bad request");
      (error as any).isRequestError = true;
      (error as any).status = 400;
      mockGet.mockRejectedValue(error);

      const result = await safeGetCvmList(client);

      expect(result.success).toBe(false);
      if (!result.success) {
        if ("isRequestError" in result.error) {
          expect(result.error.status).toBe(400);
        }
      }
    });

    it("should return raw data when schema is false", async () => {
      mockGet.mockResolvedValue(mockCvmListData);

      const result = await safeGetCvmList(client, undefined, { schema: false });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockCvmListData);
      }
    });

    it("should use custom schema when provided", async () => {
      const customSchema = z.object({
        custom: z.string(),
      });
      const customData = { custom: "test" };

      mockGet.mockResolvedValue(customData);

      const result = await safeGetCvmList(client, undefined, { schema: customSchema });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(customData);
      }
    });

    it("should return validation error when custom schema fails", async () => {
      const customSchema = z.object({
        custom: z.string(),
      });
      const invalidData = { custom: 123 };

      mockGet.mockResolvedValue(invalidData);

      const result = await safeGetCvmList(client, { schema: customSchema });

      expect(result.success).toBe(false);
      if (!result.success) {
        if (!("isRequestError" in result.error)) {
          expect(result.error.issues).toBeDefined();
        }
      }
    });

    it("should handle query parameters correctly in safe version", async () => {
      mockGet.mockResolvedValue(mockCvmListData);

      await safeGetCvmList(client, {
        page: 2,
        page_size: 20,
        node_id: 123,
      });

      expect(mockGet).toHaveBeenCalledWith("/cvms/paginated", {
        params: {
          page: 2,
          page_size: 20,
          node_id: 123,
        },
      });
    });
  });

  describe("parameter handling", () => {
    it("should work without parameters", async () => {
      mockGet.mockResolvedValue(mockCvmListData);

      await expect(getCvmList(client)).resolves.toBeDefined();
      expect(mockGet).toHaveBeenCalledWith("/cvms/paginated", { params: {} });
    });

    it("should handle undefined parameters gracefully", async () => {
      mockGet.mockResolvedValue(mockCvmListData);

      await getCvmList(client, undefined);

      expect(mockGet).toHaveBeenCalledWith("/cvms/paginated", { params: {} });
    });
  });
}); 