import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "../client";
import {
  getAvailableNodes,
  safeGetAvailableNodes,
  type AvailableNodes,
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

  describe("API routing & basic success", () => {
    it("should call correct endpoint and return data", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce(mockAvailableNodesData);

      const result = await getAvailableNodes(mockClient);

      expect(mockClient.get).toHaveBeenCalledWith("/teepods/available");
      expect(result).toEqual(mockAvailableNodesData);
    });
  });

  describe("error handling", () => {
    it("should throw on API errors", async () => {
      (mockClient.get as jest.Mock).mockRejectedValueOnce(new Error("API error"));

      await expect(getAvailableNodes(mockClient)).rejects.toThrow("API error");
    });
  });

  describe("edge cases", () => {
    it("should allow extra fields for forward compatibility", async () => {
      const extra = { ...mockAvailableNodesData, extra_field: "extra" };
      (mockClient.get as jest.Mock).mockResolvedValueOnce(extra);

      const result = await getAvailableNodes(mockClient);

      expect(result).toMatchObject({ ...mockAvailableNodesData, extra_field: "extra" });
    });

    it("should handle empty nodes array", async () => {
      const emptyNodes = { ...mockAvailableNodesData, nodes: [] };
      (mockClient.get as jest.Mock).mockResolvedValueOnce(emptyNodes);

      const result = await getAvailableNodes(mockClient);

      expect(result.nodes).toEqual([]);
    });
  });

  describe("safeGetAvailableNodes", () => {
    it("should return SafeResult on success", async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce(mockAvailableNodesData);

      const result = await safeGetAvailableNodes(mockClient);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockAvailableNodesData);
      }
    });

    it("should return error result on API failure", async () => {
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
  });
});
