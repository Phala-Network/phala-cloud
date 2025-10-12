import { describe, it, expect, vi, beforeEach } from "vitest";
import { type Client } from "../client";
import {
  commitCvmComposeFileUpdate,
  safeCommitCvmComposeFileUpdate,
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

  describe("API routing & basic success", () => {
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
  });

  describe("request validation", () => {
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

  describe("error handling", () => {
    it("should throw on API errors", async () => {
      const error = {
        isRequestError: true,
        message: "Bad request",
        status: 400,
        detail: "Compose file not found",
      };
      (mockClient.patch as jest.Mock).mockRejectedValue(error);

      await expect(commitCvmComposeFileUpdate(mockClient as Client, mockCommitRequest)).rejects.toEqual(error);
    });
  });

  describe("edge cases", () => {
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
  });

  describe("safeCommitCvmComposeFileUpdate", () => {
    it("should return SafeResult on success", async () => {
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
});
