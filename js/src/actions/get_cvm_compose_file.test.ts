import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { type Client, type SafeResult } from "../client";
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

  const mockComposeFileResponse: GetCvmComposeFileResult = {
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

  describe("Standard version", () => {
    it("should return compose file data successfully with id", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockComposeFileResponse);

      const result = await getCvmComposeFile(mockClient as Client, { id: "cvm-123" });

      expect(mockClient.get).toHaveBeenCalledWith("/cvms/cvm-123/compose_file");
      expect(result).toEqual(mockComposeFileResponse);
    });

    it("should return compose file data successfully with uuid", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockComposeFileResponse);

      const result = await getCvmComposeFile(mockClient as Client, { uuid: "123e4567-e89b-42d3-a456-556642440000" });

      expect(mockClient.get).toHaveBeenCalledWith("/cvms/123e4567-e89b-42d3-a456-556642440000/compose_file");
      expect(result).toEqual(mockComposeFileResponse);
    });

    it("should return compose file data successfully with appId", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockComposeFileResponse);

      const appId = "a".repeat(40);
      const result = await getCvmComposeFile(mockClient as Client, { app_id: appId });

      expect(mockClient.get).toHaveBeenCalledWith(`/cvms/app_${appId}/compose_file`);
      expect(result).toEqual(mockComposeFileResponse);
    });

    it("should return compose file data successfully with instanceId", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockComposeFileResponse);

      const instanceId = "b".repeat(40);
      const result = await getCvmComposeFile(mockClient as Client, { instance_id: instanceId });

      expect(mockClient.get).toHaveBeenCalledWith(`/cvms/instance_${instanceId}/compose_file`);
      expect(result).toEqual(mockComposeFileResponse);
    });

    it("should validate response data with Zod schema", async () => {
      const invalidResponse = { invalid: "data" };
      (mockClient.get as jest.Mock).mockResolvedValue(invalidResponse);

      await expect(getCvmComposeFile(mockClient as Client, { id: "cvm-123" })).rejects.toThrow();
    });

    it("should handle API errors (throws)", async () => {
      const error = {
        isRequestError: true,
        message: "Not found",
        status: 404,
        detail: "CVM not found",
      };
      (mockClient.get as jest.Mock).mockRejectedValue(error);

      await expect(getCvmComposeFile(mockClient as Client, { id: "cvm-123" })).rejects.toEqual(error);
    });

    it("should return raw data when schema is false", async () => {
      const rawData = { some: "raw", data: 123 };
      (mockClient.get as jest.Mock).mockResolvedValue(rawData);

      const result = await getCvmComposeFile(mockClient as Client, { id: "cvm-123" }, { schema: false });

      expect(result).toEqual(rawData);
    });

    it("should use custom schema when provided", async () => {
      const customSchema = z.object({ docker_compose_file: z.string() });
      const customData = { docker_compose_file: "custom data" };
      (mockClient.get as jest.Mock).mockResolvedValue(customData);

      const result = await getCvmComposeFile(mockClient as Client, { id: "cvm-123" }, { schema: customSchema });

      expect(result).toEqual(customData);
    });

    it("should throw when custom schema validation fails", async () => {
      const customSchema = z.object({ required_field: z.string() });
      (mockClient.get as jest.Mock).mockResolvedValue({ wrong_field: "value" });

      await expect(getCvmComposeFile(mockClient as Client, { id: "cvm-123" }, { schema: customSchema })).rejects.toThrow();
    });

    it("should throw when no identifier is provided", async () => {
      await expect(getCvmComposeFile(mockClient as Client, {})).rejects.toThrow("One of id, uuid, app_id, or instance_id must be provided");
    });

    it("should validate identifier formats", async () => {
      // Invalid UUID format
      await expect(getCvmComposeFile(mockClient as Client, { uuid: "invalid-uuid" })).rejects.toThrow("Invalid");

      // Invalid appId length
      await expect(getCvmComposeFile(mockClient as Client, { app_id: "short" })).rejects.toThrow("app_id should be 40 characters without prefix");

      // Invalid instanceId length
      await expect(getCvmComposeFile(mockClient as Client, { instance_id: "short" })).rejects.toThrow("instance_id should be 40 characters without prefix");
    });
  });

  describe("Safe version", () => {
    it("should return success result when API call succeeds", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockComposeFileResponse);

      const result = await safeGetCvmComposeFile(mockClient as Client, { id: "cvm-123" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockComposeFileResponse);
      }
    });

    it("should return error result when API call fails", async () => {
      const error = new Error("Server error");
      (error as any).isRequestError = true;
      (error as any).status = 500;
      (error as any).detail = "Internal server error";
      (mockClient.get as jest.Mock).mockRejectedValue(error);

      const result = await safeGetCvmComposeFile(mockClient as Client, { id: "cvm-123" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Server error");
        if ("isRequestError" in result.error) {
          expect(result.error.status).toBe(500);
        }
      }
    });

    it("should handle Zod validation errors", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue({ invalid: "data" });

      const result = await safeGetCvmComposeFile(mockClient as Client, { id: "cvm-123" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect("issues" in result.error).toBe(true);
      }
    });

    it("should pass through HTTP errors directly", async () => {
      const error = new Error("Unauthorized");
      (error as any).isRequestError = true;
      (error as any).status = 401;
      (error as any).detail = "Invalid API key";
      (mockClient.get as jest.Mock).mockRejectedValue(error);

      const result = await safeGetCvmComposeFile(mockClient as Client, { id: "cvm-123" });

      expect(result.success).toBe(false);
      if (!result.success) {
        if ("isRequestError" in result.error) {
          expect(result.error.status).toBe(401);
        }
      }
    });

    it("should return raw data when schema is false", async () => {
      const rawData = { custom: "response" };
      (mockClient.get as jest.Mock).mockResolvedValue(rawData);

      const result = await safeGetCvmComposeFile(mockClient as Client, { id: "cvm-123" }, { schema: false });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(rawData);
      }
    });

    it("should use custom schema when provided", async () => {
      const customSchema = z.object({ custom_field: z.string() });
      const customData = { custom_field: "value" };
      (mockClient.get as jest.Mock).mockResolvedValue(customData);

      const result = await safeGetCvmComposeFile(mockClient as Client, { id: "cvm-123" }, { schema: customSchema });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(customData);
      }
    });

    it("should return validation error when custom schema fails", async () => {
      const customSchema = z.object({ required_field: z.string() });
      (mockClient.get as jest.Mock).mockResolvedValue({ wrong_field: "value" });

      const result = await safeGetCvmComposeFile(mockClient as Client, { id: "cvm-123" }, { schema: customSchema });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect("issues" in result.error).toBe(true);
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

      // Invalid appId length
      const appIdResult = await safeGetCvmComposeFile(mockClient as Client, { app_id: "short" });
      expect(appIdResult.success).toBe(false);
      if (!appIdResult.success) {
        expect("issues" in appIdResult.error).toBe(true);
      }

      // Invalid instanceId length
      const instanceIdResult = await safeGetCvmComposeFile(mockClient as Client, { instance_id: "short" });
      expect(instanceIdResult.success).toBe(false);
      if (!instanceIdResult.success) {
        expect("issues" in instanceIdResult.error).toBe(true);
      }
    });
  });

  describe("Parameter handling", () => {
    it("should work with minimal parameters", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockComposeFileResponse);

      const result = await getCvmComposeFile(mockClient as Client, { id: "cvm-123" });

      expect(mockClient.get).toHaveBeenCalledWith("/cvms/cvm-123/compose_file");
      expect(result).toEqual(mockComposeFileResponse);
    });

    it("should work with safe version with minimal parameters", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockComposeFileResponse);

      const result = await safeGetCvmComposeFile(mockClient as Client, { id: "cvm-123" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockComposeFileResponse);
      }
    });
  });

  describe("Schema flexibility", () => {
    it("should allow extra fields in API response for forward compatibility", async () => {
      const responseWithExtraFields = {
        ...mockComposeFileResponse,
        extra_field: "extra_value",
        future_feature: { nested: "data" },
      };
      (mockClient.get as jest.Mock).mockResolvedValue(responseWithExtraFields);

      const result = await getCvmComposeFile(mockClient as Client, { id: "cvm-123" });

      expect(result).toEqual(responseWithExtraFields);
    });
  });

  describe("Type inference", () => {
    it("should infer correct types for default schema", () => {
      type T = Awaited<ReturnType<typeof getCvmComposeFile>>;
      type _Assert = T extends { docker_compose_file: string } ? true : false;
      const assert: _Assert = true;
      expect(assert).toBe(true);
    });

    it("should infer correct types for custom schema", () => {
      const customSchema = z.object({ test: z.string() });
      type T = Awaited<ReturnType<typeof getCvmComposeFile<typeof customSchema>>>;
      type _Assert = T extends { test: string } ? true : false;
      const assert: _Assert = true;
      expect(assert).toBe(true);
    });

    it("should infer correct types for schema: false", () => {
      type T = Awaited<ReturnType<typeof getCvmComposeFile<false>>>;
      type _Assert = T extends unknown ? true : false;
      const assert: _Assert = true;
      expect(assert).toBe(true);
    });
  });

  describe("Safe version type inference", () => {
    it("should infer correct SafeResult types for all parameterizations", () => {
      type DefaultResult = Awaited<ReturnType<typeof safeGetCvmComposeFile>>;
      type CustomSchema = z.ZodObject<{ test: z.ZodString }>;
      type CustomResult = Awaited<ReturnType<typeof safeGetCvmComposeFile<CustomSchema>>>;
      type RawResult = Awaited<ReturnType<typeof safeGetCvmComposeFile<false>>>;

      type DefaultAssert = DefaultResult extends { success: true; data: { docker_compose_file: string } } | { success: false; error: any } ? true : false;
      type CustomAssert = CustomResult extends { success: true; data: { test: string } } | { success: false; error: any } ? true : false;
      type RawAssert = RawResult extends { success: true; data: unknown } | { success: false; error: any } ? true : false;

      const defaultCheck: DefaultAssert = true;
      const customCheck: CustomAssert = true;
      const rawCheck: RawAssert = true;

      expect(defaultCheck).toBe(true);
      expect(customCheck).toBe(true);
      expect(rawCheck).toBe(true);
    });
  });
}); 