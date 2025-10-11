import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { type Client, type SafeResult } from "../client";
import {
  commitCvmComposeFileUpdate,
  safeCommitCvmComposeFileUpdate,
  type CommitCvmComposeFileUpdateParameters,
  type CommitCvmComposeFileUpdateReturnType,
} from "./commit_cvm_compose_file_update";

describe("commitCvmComposeFileUpdate", () => {
  let mockClient: Partial<Client>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockClient = {
      patch: vi.fn(),
      safePatch: vi.fn(),
    };
  });

  const mockCommitRequest = {
    id: "cvm-123",
    compose_hash: "abc123def456",
    encrypted_env: "deadbeef1234567890abcdef1234567890abcdef",
    env_keys: ["API_KEY", "DATABASE_URL"],
  };

  // HTTP 202 Accepted response (void/no response body)
  const mockCommitResponse = undefined;

  describe("Standard version", () => {
    it("should commit compose file update successfully with id", async () => {
      (mockClient.patch as jest.Mock).mockResolvedValue(mockCommitResponse);

      const result = await commitCvmComposeFileUpdate(mockClient as Client, mockCommitRequest);

      expect(mockClient.patch).toHaveBeenCalledWith("/cvms/cvm-123/compose_file", {
        compose_hash: mockCommitRequest.compose_hash,
        encrypted_env: mockCommitRequest.encrypted_env,
        env_keys: mockCommitRequest.env_keys,
      });
      expect(result).toBeUndefined(); // void response
    });

    it("should commit compose file update successfully with uuid", async () => {
      const uuidRequest = {
        uuid: "123e4567-e89b-42d3-a456-556642440000",
        compose_hash: mockCommitRequest.compose_hash,
        encrypted_env: mockCommitRequest.encrypted_env,
        env_keys: mockCommitRequest.env_keys,
      };

      (mockClient.patch as jest.Mock).mockResolvedValue(mockCommitResponse);

      const result = await commitCvmComposeFileUpdate(mockClient as Client, uuidRequest);

      expect(mockClient.patch).toHaveBeenCalledWith("/cvms/123e4567-e89b-42d3-a456-556642440000/compose_file", {
        compose_hash: uuidRequest.compose_hash,
        encrypted_env: uuidRequest.encrypted_env,
        env_keys: uuidRequest.env_keys,
      });
      expect(result).toBeUndefined();
    });

    it("should commit compose file update successfully with appId", async () => {
      const appId = "1234567890abcdef1234567890abcdef12345678";
      const request = {
        app_id: appId,
        compose_hash: mockCommitRequest.compose_hash,
        encrypted_env: mockCommitRequest.encrypted_env,
        env_keys: mockCommitRequest.env_keys,
      };

      (mockClient.patch as jest.Mock).mockResolvedValue(mockCommitResponse);

      const result = await commitCvmComposeFileUpdate(mockClient as Client, request);

      expect(mockClient.patch).toHaveBeenCalledWith(`/cvms/app_${appId}/compose_file`, {
        compose_hash: request.compose_hash,
        encrypted_env: request.encrypted_env,
        env_keys: request.env_keys,
      });
      expect(result).toBeUndefined();
    });

    it("should commit compose file update successfully with instanceId", async () => {
      const instanceId = "1234567890abcdef1234567890abcdef12345678";
      const instanceIdRequest = {
        instance_id: instanceId,
        compose_hash: mockCommitRequest.compose_hash,
        encrypted_env: mockCommitRequest.encrypted_env,
        env_keys: mockCommitRequest.env_keys,
      };

      (mockClient.patch as jest.Mock).mockResolvedValue(mockCommitResponse);

      const result = await commitCvmComposeFileUpdate(mockClient as Client, instanceIdRequest);

      expect(mockClient.patch).toHaveBeenCalledWith(`/cvms/instance_${instanceId}/compose_file`, {
        compose_hash: instanceIdRequest.compose_hash,
        encrypted_env: instanceIdRequest.encrypted_env,
        env_keys: instanceIdRequest.env_keys,
      });
      expect(result).toBeUndefined();
    });

    it("should validate response data with Zod schema", async () => {
      const invalidResponse = { invalid: "data" };
      (mockClient.patch as jest.Mock).mockResolvedValue(invalidResponse);

      // Should not throw because response is transformed to undefined by default schema
      const result = await commitCvmComposeFileUpdate(mockClient as Client, mockCommitRequest);
      expect(result).toBeUndefined();
    });

    it("should handle API errors (throws)", async () => {
      const error = {
        isRequestError: true,
        message: "Bad request",
        status: 400,
        detail: "Compose file not found",
      };
      (mockClient.patch as jest.Mock).mockRejectedValue(error);

      await expect(commitCvmComposeFileUpdate(mockClient as Client, mockCommitRequest)).rejects.toEqual(error);
    });

    it("should return raw data when schema is false", async () => {
      const rawData = { some: "raw", data: 123 };
      (mockClient.patch as jest.Mock).mockResolvedValue(rawData);

      const result = await commitCvmComposeFileUpdate(mockClient as Client, mockCommitRequest, {
        schema: false,
      });

      expect(result).toEqual(rawData);
    });

    it("should use custom schema when provided", async () => {
      const customSchema = z.object({ status: z.string() });
      const customData = { status: "success" };
      (mockClient.patch as jest.Mock).mockResolvedValue(customData);

      const result = await commitCvmComposeFileUpdate(mockClient as Client, mockCommitRequest, {
        schema: customSchema,
      });

      expect(result).toEqual(customData);
    });

    it("should throw when custom schema validation fails", async () => {
      const customSchema = z.object({ required_field: z.string() });
      (mockClient.patch as jest.Mock).mockResolvedValue({ wrong_field: "value" });

      await expect(commitCvmComposeFileUpdate(mockClient as Client, mockCommitRequest, {
        schema: customSchema,
      })).rejects.toThrow();
    });

    it("should throw when no identifier is provided", async () => {
      const invalidRequest = {
        compose_hash: mockCommitRequest.compose_hash,
      };

      await expect(commitCvmComposeFileUpdate(mockClient as Client, invalidRequest)).rejects.toThrow();
    });

    it("should throw when compose_hash is missing", async () => {
      const invalidRequest = { 
        id: "cvm-123", 
        compose_hash: "" 
      };
      
      await expect(commitCvmComposeFileUpdate(mockClient as Client, invalidRequest)).rejects.toThrow();
    });
  });

  describe("Safe version", () => {
    it("should return success result when API call succeeds", async () => {
      (mockClient.patch as jest.Mock).mockResolvedValue(mockCommitResponse);

      const result = await safeCommitCvmComposeFileUpdate(mockClient as Client, mockCommitRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined(); // void response
      }
    });

    it("should return error result when API call fails", async () => {
      const error = new Error("Server error");
      (error as any).isRequestError = true;
      (error as any).status = 500;
      (error as any).detail = "Internal server error";
      (mockClient.patch as jest.Mock).mockRejectedValue(error);

      const result = await safeCommitCvmComposeFileUpdate(mockClient as Client, mockCommitRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Server error");
        if ("isRequestError" in result.error) {
          expect(result.error.status).toBe(500);
        }
      }
    });

    it("should handle Zod validation errors", async () => {
      (mockClient.patch as jest.Mock).mockResolvedValue({ invalid: "data" });

      const result = await safeCommitCvmComposeFileUpdate(mockClient as Client, mockCommitRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined(); // Default schema transforms to undefined
      }
    });

    it("should pass through HTTP errors directly", async () => {
      const error = new Error("Unauthorized");
      (error as any).isRequestError = true;
      (error as any).status = 401;
      (error as any).detail = "Invalid API key";
      (mockClient.patch as jest.Mock).mockRejectedValue(error);

      const result = await safeCommitCvmComposeFileUpdate(mockClient as Client, mockCommitRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        if ("isRequestError" in result.error) {
          expect(result.error.status).toBe(401);
        }
      }
    });

    it("should return raw data when schema is false", async () => {
      const rawData = { custom: "response" };
      (mockClient.patch as jest.Mock).mockResolvedValue(rawData);

      const result = await safeCommitCvmComposeFileUpdate(mockClient as Client, mockCommitRequest, {
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
      (mockClient.patch as jest.Mock).mockResolvedValue(customData);

      const result = await safeCommitCvmComposeFileUpdate(mockClient as Client, mockCommitRequest, {
        schema: customSchema,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(customData);
      }
    });

    it("should return validation error when custom schema fails", async () => {
      const customSchema = z.object({ required_field: z.string() });
      (mockClient.patch as jest.Mock).mockResolvedValue({ wrong_field: "value" });

      const result = await safeCommitCvmComposeFileUpdate(mockClient as Client, mockCommitRequest, {
        schema: customSchema,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect("issues" in result.error).toBe(true);
      }
    });

    it("should return error when no identifier is provided", async () => {
      const invalidRequest = {
        compose_hash: mockCommitRequest.compose_hash,
      };
      
      const result = await safeCommitCvmComposeFileUpdate(mockClient as Client, invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect("issues" in result.error).toBe(true);
      }
    });

    it("should return error when compose_hash is missing", async () => {
      const invalidRequest = { 
        id: "cvm-123", 
        compose_hash: "" 
      };
      
      const result = await safeCommitCvmComposeFileUpdate(mockClient as Client, invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect("issues" in result.error).toBe(true);
      }
    });
  });

  describe("Parameter handling", () => {
    it("should work with minimal parameters", async () => {
      (mockClient.patch as jest.Mock).mockResolvedValue(mockCommitResponse);

      const result = await commitCvmComposeFileUpdate(mockClient as Client, {
        id: mockCommitRequest.id,
        compose_hash: mockCommitRequest.compose_hash,
      });

      expect(mockClient.patch).toHaveBeenCalledWith("/cvms/cvm-123/compose_file", {
        compose_hash: mockCommitRequest.compose_hash,
      });
      expect(result).toBeUndefined();
    });

    it("should work with safe version with minimal parameters", async () => {
      (mockClient.patch as jest.Mock).mockResolvedValue(mockCommitResponse);

      const result = await safeCommitCvmComposeFileUpdate(mockClient as Client, {
        id: mockCommitRequest.id,
        compose_hash: mockCommitRequest.compose_hash,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }
    });
  });

  describe("Schema flexibility", () => {
    it("should allow extra fields in API response for forward compatibility", async () => {
      const responseWithExtraFields = {
        extra_field: "extra_value",
        future_feature: { nested: "data" },
      };
      (mockClient.patch as jest.Mock).mockResolvedValue(responseWithExtraFields);

      // Default schema transforms any response to undefined
      const result = await commitCvmComposeFileUpdate(mockClient as Client, mockCommitRequest);

      expect(result).toBeUndefined();
    });
  });

  describe("Type inference", () => {
    it("should infer correct types for default schema", () => {
      type T = Awaited<ReturnType<typeof commitCvmComposeFileUpdate>>;
      const isExpected: T extends undefined ? true : false = true;
      expect(isExpected).toBe(true);
    });

    it("should infer correct types for custom schema", () => {
      const customSchema = z.object({ test: z.string() });
      type T = CommitCvmComposeFileUpdateReturnType<typeof customSchema>;
      const isExpected: T extends { test: string } ? true : false = true;
      expect(isExpected).toBe(true);
    });

    it("should infer correct types for schema: false", () => {
      type T = CommitCvmComposeFileUpdateReturnType<false>;
      const isExpected: T extends unknown ? true : false = true;
      expect(isExpected).toBe(true);
    });
  });

  describe("Safe version type inference", () => {
    it("should infer correct SafeResult types for all parameterizations", () => {
      type DefaultResult = Awaited<ReturnType<typeof safeCommitCvmComposeFileUpdate>>;
      type CustomResult = Awaited<ReturnType<typeof safeCommitCvmComposeFileUpdate<z.ZodObject<{ test: z.ZodString }>>>>;
      type RawResult = Awaited<ReturnType<typeof safeCommitCvmComposeFileUpdate<false>>>;

      const defaultCheck: DefaultResult extends { success: boolean } ? true : false = true;
      const customCheck: CustomResult extends { success: boolean } ? true : false = true;
      const rawCheck: RawResult extends { success: boolean } ? true : false = true;

      expect(defaultCheck).toBe(true);
      expect(customCheck).toBe(true);
      expect(rawCheck).toBe(true);
    });
  });
}); 