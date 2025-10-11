import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { createClient } from "../client";
import {
  getAvailableNodes,
  safeGetAvailableNodes,
  type AvailableNodes,
  AvailableNodesSchema,
} from "./get_available_nodes";
import type { Client } from "../client";
import { SUPPORTED_CHAINS } from "../types/supported_chains";

// Mock response data matching the API structure
const mockAvailableNodesData: AvailableNodes = {
  tier: "free",
  capacity: {
    max_instances: 16,
    max_vcpu: 16,
    max_memory: 32768,
    max_disk: 640,
  },
  nodes: [
    {
      teepod_id: 1,
      name: "teepod-1",
      listed: true,
      resource_score: 0.8,
      remaining_vcpu: 8,
      remaining_memory: 16000,
      remaining_cvm_slots: 4,
      images: [
        {
          name: "ubuntu",
          is_dev: false,
          version: [1, 0, 0],
          os_image_hash: null,
        },
      ],
      dedicated_for_team_id: null,
      support_onchain_kms: false,
      fmspc: null,
      device_id: null,
      kms_list: [],
    },
  ],
  kms_list: [
    {
      id: "kms_1",
      slug: "kms_1",
      url: "https://kms.example.com",
      version: "1.0.0",
      chain_id: 1,
      kms_contract_address: "0xabc" as any,
      gateway_app_id: "0xdef" as any,
      chain: SUPPORTED_CHAINS[1],
    },
  ],
};

describe("getAvailableNodes", () => {
  let mockClient: Client;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockClient = {
      get: vi.fn(),
      safeGet: vi.fn(),
    } as unknown as Client;
  });

  describe("getAvailableNodes", () => {
    it("should return data successfully", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce(mockAvailableNodesData);
      const result = await getAvailableNodes(mockClient);
      expect(result).toEqual(mockAvailableNodesData);
    });

    it("should validate response data with zod schema", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce(mockAvailableNodesData);
      const result = await getAvailableNodes(mockClient);
      expect(AvailableNodesSchema.parse(result)).toEqual(mockAvailableNodesData);
    });

    it("should handle API errors properly", async () => {
      (mockClient.get as jest.Mock).mockRejectedValueOnce(new Error("API error"));
      await expect(getAvailableNodes(mockClient)).rejects.toThrow("API error");
    });

    it("should return raw data when schema is false", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce(mockAvailableNodesData);
      const result = await getAvailableNodes(mockClient, { schema: false });
      expect(result).toEqual(mockAvailableNodesData);
    });

    it("should use custom schema when provided", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce({ tier: "free" });
      const customSchema = z.object({ tier: z.string() });
      const result = await getAvailableNodes(mockClient, { schema: customSchema });
      expect(result).toEqual({ tier: "free" });
    });

    it("should throw when custom schema validation fails", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce({ foo: "bar" });
      const customSchema = z.object({ tier: z.string() });
      await expect(getAvailableNodes(mockClient, { schema: customSchema })).rejects.toThrow();
    });
  });

  describe("safeGetAvailableNodes", () => {
    it("should return success result when API call succeeds", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce(mockAvailableNodesData);
      const result = await safeGetAvailableNodes(mockClient);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockAvailableNodesData);
      }
    });

    it("should return error result when API call fails", async () => {
      const error = new Error("fail");
      (error as any).isRequestError = true;
      (error as any).status = 500;
      (mockClient.get as jest.Mock).mockRejectedValueOnce(error);
      const result = await safeGetAvailableNodes(mockClient);
      expect(result.success).toBe(false);
      if (!result.success) {
        if ("isRequestError" in result.error) {
          expect(result.error.isRequestError).toBe(true);
        }
      }
    });

    it("should handle zod validation errors", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce({ foo: "bar" });
      const result = await safeGetAvailableNodes(mockClient);
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
      (mockClient.get as jest.Mock).mockRejectedValueOnce(error);
      const result = await safeGetAvailableNodes(mockClient);
      expect(result.success).toBe(false);
      if (!result.success) {
        if ("isRequestError" in result.error) {
          expect(result.error.status).toBe(400);
        }
      }
    });

    it("should return raw data when schema is false", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce(mockAvailableNodesData);
      const result = await safeGetAvailableNodes(mockClient, { schema: false });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockAvailableNodesData);
      }
    });

    it("should use custom schema when provided", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce({ tier: "free" });
      const customSchema = z.object({ tier: z.string() });
      const result = await safeGetAvailableNodes(mockClient, { schema: customSchema });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ tier: "free" });
      }
    });

    it("should return validation error when custom schema fails", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce({ foo: "bar" });
      const customSchema = z.object({ tier: z.string() });
      const result = await safeGetAvailableNodes(mockClient, { schema: customSchema });
      expect(result.success).toBe(false);
      if (!result.success) {
        if (!("isRequestError" in result.error)) {
          expect(result.error.issues).toBeDefined();
        }
      }
    });
  });

  describe("parameter handling", () => {
    it("should work without parameters", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce(mockAvailableNodesData);
      await expect(getAvailableNodes(mockClient)).resolves.toBeDefined();
    });

    it("should work with empty parameters object", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce(mockAvailableNodesData);
      await expect(getAvailableNodes(mockClient, {})).resolves.toBeDefined();
    });

    it("should work with safe version without parameters", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce(mockAvailableNodesData);
      await expect(safeGetAvailableNodes(mockClient)).resolves.toBeDefined();
    });

    it("should work with safe version with empty parameters object", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce(mockAvailableNodesData);
      await expect(safeGetAvailableNodes(mockClient, {})).resolves.toBeDefined();
    });
  });

  describe("schema flexibility", () => {
    it("should allow extra fields in API response for forward compatibility", async () => {
      const extra = { ...mockAvailableNodesData, extra_field: "extra" };
      (mockClient.get as jest.Mock).mockResolvedValueOnce(extra);
      const result = await getAvailableNodes(mockClient);
      expect(result).toMatchObject({ ...mockAvailableNodesData, extra_field: "extra" });
    });
  });

  describe("type inference", () => {
    it("should infer AvailableNodes type when no schema provided", async () => {
      type T = Awaited<ReturnType<typeof getAvailableNodes>>;
      type _Assert = T extends AvailableNodes ? true : false;
      const assert: _Assert = true;
      expect(assert).toBe(true);
    });

    it("should infer unknown type when schema is false", async () => {
      type T = Awaited<ReturnType<typeof getAvailableNodes<false>>>;
      type _Assert = T extends unknown ? true : false;
      const assert: _Assert = true;
      expect(assert).toBe(true);
    });

    it("should infer custom schema type when provided", async () => {
      const customSchema = z.object({ tier: z.string() });
      type T = Awaited<ReturnType<typeof getAvailableNodes<typeof customSchema>>>;
      type _Assert = T extends { tier: string } ? true : false;
      const assert: _Assert = true;
      expect(assert).toBe(true);
    });
  });

  describe("safe version type inference", () => {
    it("should infer SafeResult<AvailableNodes> when no schema provided", async () => {
      type T = Awaited<ReturnType<typeof safeGetAvailableNodes>>;
      type _Assert = T extends { success: true; data: AvailableNodes } | { success: false; error: any } ? true : false;
      const assert: _Assert = true;
      expect(assert).toBe(true);
    });

    it("should infer SafeResult<unknown> when schema is false", async () => {
      type T = Awaited<ReturnType<typeof safeGetAvailableNodes<false>>>;
      type _Assert = T extends { success: true; data: unknown } | { success: false; error: any } ? true : false;
      const assert: _Assert = true;
      expect(assert).toBe(true);
    });

    it("should infer custom type when custom schema provided", async () => {
      const customSchema = z.object({ tier: z.string() });
      type T = Awaited<ReturnType<typeof safeGetAvailableNodes<typeof customSchema>>>;
      type _Assert = T extends { success: true; data: { tier: string } } | { success: false; error: any } ? true : false;
      const assert: _Assert = true;
      expect(assert).toBe(true);
    });
  });
}); 