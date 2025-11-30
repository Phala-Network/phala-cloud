import { describe, it, expect, vi, beforeEach } from "vitest";
import { type Client, type SafeResult } from "../../client";
import {
  getCvmComposeFile,
  safeGetCvmComposeFile,
  type GetCvmComposeFileResult,
} from "./get_cvm_compose_file";

describe("getCvmComposeFile", () => {
  let mockClient: Partial<Client>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      get: vi.fn(),
      safeGet: vi.fn(),
    };
  });

  const mockComposeFileResponse = {
    docker_compose_file: "version: '3.8'\nservices:\n  app:\n    image: nginx",
    allowed_envs: ["API_KEY", "DATABASE_URL"],
    features: ["kms"],
    name: "test-app",
    manifest_version: 1,
    kms_enabled: true,
    public_logs: false,
    public_sysinfo: false,
    tproxy_enabled: true,
    pre_launch_script: "#!/bin/bash\necho 'Starting app'",
  };

  describe("API routing & basic success", () => {
    it("should call correct endpoint with id", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockComposeFileResponse);

      const result = await getCvmComposeFile(mockClient as Client, { id: "cvm-123" });

      expect(mockClient.get).toHaveBeenCalledWith("/cvms/cvm-123/compose_file");
      expect(result).toMatchObject(mockComposeFileResponse);
      expect(result.getHash).toBeTypeOf("function");
      expect(result.toString).toBeTypeOf("function");
    });

    it("should call correct endpoint with uuid", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockComposeFileResponse);

      const result = await getCvmComposeFile(mockClient as Client, { uuid: "123e4567-e89b-42d3-a456-556642440000" });

      // UUID dashes are removed during transformation
      expect(mockClient.get).toHaveBeenCalledWith("/cvms/123e4567e89b42d3a456556642440000/compose_file");
      expect(result).toMatchObject(mockComposeFileResponse);
      expect(result.getHash).toBeTypeOf("function");
      expect(result.toString).toBeTypeOf("function");
    });

    it("should call correct endpoint with app_id (adds prefix)", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockComposeFileResponse);

      const appId = "a".repeat(40);
      const result = await getCvmComposeFile(mockClient as Client, { app_id: appId });

      expect(mockClient.get).toHaveBeenCalledWith(`/cvms/app_${appId}/compose_file`);
      expect(result).toMatchObject(mockComposeFileResponse);
      expect(result.getHash).toBeTypeOf("function");
      expect(result.toString).toBeTypeOf("function");
    });

    it("should call correct endpoint with instance_id (40-char hex detected as app_id)", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockComposeFileResponse);

      // 40-char hex will be auto-detected as app_id regardless of field name
      const instanceId = "b".repeat(40);
      const result = await getCvmComposeFile(mockClient as Client, { instance_id: instanceId });

      expect(mockClient.get).toHaveBeenCalledWith(`/cvms/app_${instanceId}/compose_file`);
      expect(result).toMatchObject(mockComposeFileResponse);
      expect(result.getHash).toBeTypeOf("function");
      expect(result.toString).toBeTypeOf("function");
    });
  });

  describe("request validation", () => {
    it("should validate identifier requirements", async () => {
      await expect(getCvmComposeFile(mockClient as Client, {})).rejects.toThrow("One of id, uuid, app_id, instance_id, or name must be provided");

      // Invalid UUID format
      await expect(getCvmComposeFile(mockClient as Client, { uuid: "invalid-uuid" })).rejects.toThrow("Invalid");

    });
  });

  describe("error handling", () => {
    it("should throw on API errors", async () => {
      const error = {
        isRequestError: true,
        message: "Not found",
        status: 404,
        detail: "CVM not found",
      };
      (mockClient.get as jest.Mock).mockRejectedValue(error);

      await expect(getCvmComposeFile(mockClient as Client, { id: "cvm-123" })).rejects.toEqual(error);
    });
  });

  describe("edge cases", () => {
    it("should allow extra fields for forward compatibility", async () => {
      const responseWithExtraFields = {
        ...mockComposeFileResponse,
        extra_field: "extra_value",
        future_feature: { nested: "data" },
      };
      (mockClient.get as jest.Mock).mockResolvedValue(responseWithExtraFields);

      const result = await getCvmComposeFile(mockClient as Client, { id: "cvm-123" });

      expect(result).toMatchObject(responseWithExtraFields);
      expect(result.getHash).toBeTypeOf("function");
      expect(result.toString).toBeTypeOf("function");
    });
  });

  describe("safeGetCvmComposeFile", () => {
    it("should return SafeResult on success", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockComposeFileResponse);

      const result = await safeGetCvmComposeFile(mockClient as Client, { id: "cvm-123" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatchObject(mockComposeFileResponse);
        expect(result.data.getHash).toBeTypeOf("function");
        expect(result.data.toString).toBeTypeOf("function");
      }
    });

    it("should return error when no identifier is provided", async () => {
      const result = await safeGetCvmComposeFile(mockClient as Client, {});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect("issues" in result.error).toBe(true);
      }
    });

    it("should return error for invalid identifier formats", async () => {
      // Invalid UUID format
      const uuidResult = await safeGetCvmComposeFile(mockClient as Client, { uuid: "invalid-uuid" });
      expect(uuidResult.success).toBe(false);
      if (!uuidResult.success) {
        expect("issues" in uuidResult.error).toBe(true);
      }

      // Invalid app_id length
      const appIdResult = await safeGetCvmComposeFile(mockClient as Client, { app_id: "short" });
      expect(appIdResult.success).toBe(false);
      if (!appIdResult.success) {
        expect("issues" in appIdResult.error).toBe(true);
      }

      // Invalid instance_id length
      const instanceIdResult = await safeGetCvmComposeFile(mockClient as Client, { instance_id: "short" });
      expect(instanceIdResult.success).toBe(false);
      if (!instanceIdResult.success) {
        expect("issues" in instanceIdResult.error).toBe(true);
      }
    });
  });
});
