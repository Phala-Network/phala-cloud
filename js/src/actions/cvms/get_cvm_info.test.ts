import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "../../client";
import {
  getCvmInfo,
  safeGetCvmInfo,
  type GetCvmInfoResponse,
} from "./get_cvm_info";
import type { CvmDetailV20251028 } from "../../types/cvm_info_v20251028";

// Mock response data matching the CvmDetailV20251028Schema structure
const mockCvmInfoData: CvmDetailV20251028 = {
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
    // Use v20251028 version since mock data is in that format
    client = createClient({
      apiKey: "test-api-key",
      baseURL: "https://api.test.com",
      version: "2025-10-28",
    });
    mockSafeGet = vi.spyOn(client, "safeGet");
    mockGet = vi.spyOn(client, "get");
  });

  describe("API routing & basic success", () => {
    it("should call correct endpoint with id", async () => {
      mockGet.mockResolvedValue(mockCvmInfoData);

      const result = await getCvmInfo(client, { id: "test-cvm-id" });

      expect(mockGet).toHaveBeenCalledWith("/cvms/test-cvm-id");
      expect(result).toMatchObject(mockCvmInfoData);
      expect((result as CvmDetailV20251028).name).toBe("test-cvm");
    });

    it("should call correct endpoint with uuid", async () => {
      mockGet.mockResolvedValue(mockCvmInfoData);

      const result = await getCvmInfo(client, { uuid: "123e4567-e89b-42d3-a456-556642440000" });

      // UUID dashes are removed during transformation
      expect(mockGet).toHaveBeenCalledWith("/cvms/123e4567e89b42d3a456556642440000");
      expect(result).toMatchObject(mockCvmInfoData);
    });

    it("should call correct endpoint with app_id (adds prefix)", async () => {
      mockGet.mockResolvedValue(mockCvmInfoData);

      const app_id = "a".repeat(40);
      const result = await getCvmInfo(client, { app_id });

      expect(mockGet).toHaveBeenCalledWith(`/cvms/app_${app_id}`);
      expect(result).toMatchObject(mockCvmInfoData);
    });

    it("should call correct endpoint with instance_id (40-char hex detected as app_id)", async () => {
      mockGet.mockResolvedValue(mockCvmInfoData);

      // 40-char hex will be auto-detected as app_id regardless of field name
      const instance_id = "b".repeat(40);
      const result = await getCvmInfo(client, { instance_id });

      expect(mockGet).toHaveBeenCalledWith(`/cvms/app_${instance_id}`);
      expect(result).toMatchObject(mockCvmInfoData);
    });

    it("should call correct endpoint with custom instance_id", async () => {
      mockGet.mockResolvedValue(mockCvmInfoData);

      const instance_id = "custom-instance-123";
      const result = await getCvmInfo(client, { instance_id });

      expect(mockGet).toHaveBeenCalledWith(`/cvms/${instance_id}`);
      expect(result).toMatchObject(mockCvmInfoData);
    });
  });

  describe("request validation", () => {
    it("should validate identifier requirements", async () => {
      // No identifier provided
      await expect(getCvmInfo(client, {})).rejects.toThrow("One of id, uuid, app_id, instance_id, or name must be provided");

      // Invalid UUID format
      await expect(getCvmInfo(client, { uuid: "invalid-uuid" })).rejects.toThrow();

    });
  });

  describe("error handling", () => {
    it("should throw on API errors", async () => {
      const apiError = new Error("CVM not found");
      mockGet.mockRejectedValue(apiError);

      await expect(getCvmInfo(client, { id: "nonexistent-cvm" })).rejects.toThrow("CVM not found");
    });
  });

  describe("edge cases", () => {
    it("should handle identifier priority when multiple provided", async () => {
      mockGet.mockResolvedValue(mockCvmInfoData);

      const uuid = "123e4567-e89b-42d3-a456-556642440000";
      const app_id = "a".repeat(40);
      const instance_id = "b".repeat(40);

      // id takes precedence over all
      await getCvmInfo(client, { id: "test-id", uuid, app_id, instance_id });
      expect(mockGet).toHaveBeenCalledWith("/cvms/test-id");

      // uuid takes precedence over app_id and instance_id
      await getCvmInfo(client, { uuid, app_id, instance_id });
      // UUID dashes are removed during transformation
      expect(mockGet).toHaveBeenCalledWith(`/cvms/${uuid.replace(/-/g, "")}`);

      // app_id takes precedence over instance_id
      await getCvmInfo(client, { app_id, instance_id });
      expect(mockGet).toHaveBeenCalledWith(`/cvms/app_${app_id}`);

      // instance_id when it's the only one (40-char hex detected as app_id)
      await getCvmInfo(client, { instance_id });
      expect(mockGet).toHaveBeenCalledWith(`/cvms/app_${instance_id}`);
    });

    it("should handle CVM ID with special characters", async () => {
      const specialId = "cvm-123-test_special.id";
      mockGet.mockResolvedValue(mockCvmInfoData);

      await getCvmInfo(client, { id: specialId });

      expect(mockGet).toHaveBeenCalledWith(`/cvms/${specialId}`);
    });
  });

  describe("safeGetCvmInfo", () => {
    it("should return SafeResult on success", async () => {
      mockGet.mockResolvedValue(mockCvmInfoData);

      const result = await safeGetCvmInfo(client, { id: "test-cvm-id" });

      expect(mockGet).toHaveBeenCalledWith("/cvms/test-cvm-id");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatchObject(mockCvmInfoData);
        expect((result.data as CvmDetailV20251028).name).toBe("test-cvm");
      }
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
});
