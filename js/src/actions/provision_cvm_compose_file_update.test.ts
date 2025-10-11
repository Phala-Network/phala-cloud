import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { Client } from "../client";
import { SUPPORTED_CHAINS } from "../types/supported_chains";
import {
  provisionCvmComposeFileUpdate,
  safeProvisionCvmComposeFileUpdate,
  type ProvisionCvmComposeFileUpdateResult,
} from "./provision_cvm_compose_file_update";

describe("provisionCvmComposeFileUpdate", () => {
  let mockClient: Client;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockClient = {
      post: vi.fn(),
      safePost: vi.fn(),
    } as unknown as Client;
  });

  const mockAppCompose = {
    docker_compose_file: "version: '3.8'\nservices:\n  app:\n    image: nginx",
    allowed_envs: ["API_KEY", "DATABASE_URL"],
    name: "test-app",
  };

  const mockProvisionRequest = {
    id: "cvm-123",
    app_compose: mockAppCompose,
  };

  const mockProvisionResponse = {
    app_id: "app-123",
    device_id: "device-456",
    compose_hash: "abc123def456",
    kms_info: {
      id: "kms-123",
      slug: "test-kms",
      url: "https://kms.example.com",
      version: "1.0.0",
      chain_id: 1,
      kms_contract_address: "0x1234567890abcdef",
      gateway_app_id: "0x123456789abcdef",
      chain: SUPPORTED_CHAINS[1],
    },
  };

  describe("Standard version", () => {
    it("should return provision data successfully", async () => {
      (mockClient.post as any).mockResolvedValue(mockProvisionResponse);

      const result = await provisionCvmComposeFileUpdate(mockClient, mockProvisionRequest);

      expect(mockClient.post).toHaveBeenCalledWith("/cvms/cvm-123/compose_file/provision", mockAppCompose);
      expect(result).toEqual(mockProvisionResponse);
    });

    it("should validate response data with Zod schema", async () => {
      const invalidResponse = { invalid: "data" };
      (mockClient.post as any).mockResolvedValue(invalidResponse);

      await expect(provisionCvmComposeFileUpdate(mockClient, mockProvisionRequest)).rejects.toThrow();
    });

    it("should handle API errors (throws)", async () => {
      const error = {
        isRequestError: true,
        message: "invalid identifier",
        status: 400,
        detail: "Docker compose file is invalid",
      };
      (mockClient.post as any).mockRejectedValue(error);

      await expect(provisionCvmComposeFileUpdate(mockClient, mockProvisionRequest)).rejects.toEqual(error);
    });

    it("should return raw data when schema is false", async () => {
      const rawData = { some: "raw", data: 123 };
      (mockClient.post as any).mockResolvedValue(rawData);

      const result = await provisionCvmComposeFileUpdate(mockClient, mockProvisionRequest, {
        schema: false,
      });

      expect(result).toEqual(rawData);
    });

    it("should use custom schema when provided", async () => {
      const customSchema = z.object({ compose_hash: z.string() });
      const customData = { compose_hash: "custom-hash" };
      (mockClient.post as any).mockResolvedValue(customData);

      const result = await provisionCvmComposeFileUpdate(mockClient, mockProvisionRequest, {
        schema: customSchema,
      });

      expect(result).toEqual(customData);
    });

    it("should throw when custom schema validation fails", async () => {
      const customSchema = z.object({ required_field: z.string() });
      (mockClient.post as any).mockResolvedValue({ wrong_field: "value" });

      await expect(provisionCvmComposeFileUpdate(mockClient, mockProvisionRequest, {
        schema: customSchema,
      })).rejects.toThrow();
    });

    it("should throw when cvm_id is missing", async () => {
      const invalidRequest = { ...mockProvisionRequest };
      delete invalidRequest.id;

      await expect(provisionCvmComposeFileUpdate(mockClient, invalidRequest)).rejects.toThrow();
    });

    it("should throw when docker_compose_file is missing", async () => {
      const invalidRequest = { 
        ...mockProvisionRequest, 
        app_compose: { ...mockAppCompose, docker_compose_file: "" }
      };
      
      await expect(provisionCvmComposeFileUpdate(mockClient, invalidRequest)).rejects.toThrow();
    });
  });

  describe("Safe version", () => {
    it("should return success result when API call succeeds", async () => {
      (mockClient.post as any).mockResolvedValue(mockProvisionResponse);

      const result = await safeProvisionCvmComposeFileUpdate(mockClient, mockProvisionRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockProvisionResponse);
      }
    });

    it("should return error result when API call fails", async () => {
      const error = new Error("Server error");
      (error as any).isRequestError = true;
      (error as any).status = 500;
      (error as any).detail = "Internal server error";
      (mockClient.post as any).mockRejectedValue(error);

      const result = await safeProvisionCvmComposeFileUpdate(mockClient, mockProvisionRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Server error");
        if ("isRequestError" in result.error) {
          expect(result.error.status).toBe(500);
        }
      }
    });

    it("should handle Zod validation errors", async () => {
      (mockClient.post as any).mockResolvedValue({ invalid: "data" });

      const result = await safeProvisionCvmComposeFileUpdate(mockClient, mockProvisionRequest);

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
      (mockClient.post as any).mockRejectedValue(error);

      const result = await safeProvisionCvmComposeFileUpdate(mockClient, mockProvisionRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        if ("isRequestError" in result.error) {
          expect(result.error.status).toBe(401);
        }
      }
    });

    it("should return raw data when schema is false", async () => {
      const rawData = { custom: "response" };
      (mockClient.post as any).mockResolvedValue(rawData);

      const result = await safeProvisionCvmComposeFileUpdate(mockClient, mockProvisionRequest, {
        schema: false,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(rawData);
      }
    });

    it("should use custom schema when provided", async () => {
      const customSchema = z.object({ custom_field: z.string() });
      const customData = { custom_field: "value" };
      (mockClient.post as any).mockResolvedValue(customData);

      const result = await safeProvisionCvmComposeFileUpdate(mockClient, mockProvisionRequest, {
        schema: customSchema,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(customData);
      }
    });

    it("should return validation error when custom schema fails", async () => {
      const customSchema = z.object({ required_field: z.string() });
      (mockClient.post as any).mockResolvedValue({ wrong_field: "value" });

      const result = await safeProvisionCvmComposeFileUpdate(mockClient, mockProvisionRequest, {
        schema: customSchema,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect("issues" in result.error).toBe(true);
      }
    });

    it("should return error when cvm_id is missing", async () => {
      const invalidRequest = { ...mockProvisionRequest };
      delete invalidRequest.id;

      const result = await safeProvisionCvmComposeFileUpdate(mockClient, invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect("issues" in result.error).toBe(true);
      }
    });

    it("should return error when docker_compose_file is missing", async () => {
      const invalidRequest = {
        ...mockProvisionRequest,
        app_compose: { ...mockAppCompose, docker_compose_file: "" }
      };

      // Mock backend validation error
      const error = new Error("Docker compose file is required");
      (error as any).isRequestError = true;
      (error as any).status = 400;
      (mockClient.post as any).mockRejectedValue(error);

      const result = await safeProvisionCvmComposeFileUpdate(mockClient, invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect("isRequestError" in result.error).toBe(true);
      }
    });
  });

  describe("Parameter handling", () => {
    it("should work with cvm_id and request parameters", async () => {
      (mockClient.post as any).mockResolvedValue(mockProvisionResponse);

      const result = await provisionCvmComposeFileUpdate(mockClient, mockProvisionRequest);

      expect(mockClient.post).toHaveBeenCalledWith("/cvms/cvm-123/compose_file/provision", mockAppCompose);
      expect(result).toEqual(mockProvisionResponse);
    });

    it("should work with safe version with parameters", async () => {
      (mockClient.post as any).mockResolvedValue(mockProvisionResponse);

      const result = await safeProvisionCvmComposeFileUpdate(mockClient, mockProvisionRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockProvisionResponse);
      }
    });
  });

  describe("Schema flexibility", () => {
    it("should allow extra fields in API response for forward compatibility", async () => {
      const responseWithExtraFields = {
        ...mockProvisionResponse,
        extra_field: "extra_value",
        future_feature: { nested: "data" },
      };
      (mockClient.post as any).mockResolvedValue(responseWithExtraFields);

      const result = await provisionCvmComposeFileUpdate(mockClient, mockProvisionRequest);

      expect(result).toEqual(responseWithExtraFields);
    });
  });

  describe("Type inference", () => {
    it("should infer correct types for default schema", () => {
      type T = Awaited<ReturnType<typeof provisionCvmComposeFileUpdate>>;
      const isExpected: T extends ProvisionCvmComposeFileUpdateResult ? true : false = true;
      expect(isExpected).toBe(true);
    });

    it("should infer correct types for custom schema", () => {
      const customSchema = z.object({ test: z.string() });
      type T = Awaited<ReturnType<typeof provisionCvmComposeFileUpdate<typeof customSchema>>>;
      const isExpected: T extends { test: string } ? true : false = true;
      expect(isExpected).toBe(true);
    });

    it("should infer correct types for schema: false", () => {
      type T = Awaited<ReturnType<typeof provisionCvmComposeFileUpdate<false>>>;
      const isExpected: T extends unknown ? true : false = true;
      expect(isExpected).toBe(true);
    });
  });

  describe("Safe version type inference", () => {
    it("should infer correct SafeResult types for all parameterizations", () => {
      type DefaultResult = Awaited<ReturnType<typeof safeProvisionCvmComposeFileUpdate>>;
      type CustomResult = Awaited<ReturnType<typeof safeProvisionCvmComposeFileUpdate<z.ZodObject<{ test: z.ZodString }>>>>;
      type RawResult = Awaited<ReturnType<typeof safeProvisionCvmComposeFileUpdate<false>>>;

      const defaultCheck: DefaultResult extends { success: boolean } ? true : false = true;
      const customCheck: CustomResult extends { success: boolean } ? true : false = true;
      const rawCheck: RawResult extends { success: boolean } ? true : false = true;

      expect(defaultCheck).toBe(true);
      expect(customCheck).toBe(true);
      expect(rawCheck).toBe(true);
    });
  });
}); 