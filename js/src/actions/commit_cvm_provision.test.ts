import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "../client";
import {
  commitCvmProvision,
  safeCommitCvmProvision,
  CommitCvmProvision,
  CommitCvmProvisionRequest,
} from "./commit_cvm_provision";

const mockPayload: CommitCvmProvisionRequest = {
  encrypted_env: "hex_encoded_encrypted_environment_data",
  app_id: "test-app-id",
  compose_hash: "test-compose-hash",
  kms_id: "test-kms-id",
  contract_address: "0x123456789abcdef",
  deployer_address: "0xfedcba987654321",
};

const mockCvmData: CommitCvmProvision = {
  id: 123,
  name: "test-vm",
  status: "running",
  teepod_id: 1,
  teepod: {
    id: 1,
    name: "test-teepod",
  },
  user_id: 456,
  app_id: "test-app-id",
  vm_uuid: "vm-uuid-123",
  instance_id: "instance-123",
  app_url: "https://test-app.phala.network",
  base_image: "dstack-dev-0.5.1",
  vcpu: 2,
  memory: 4096,
  disk_size: 40,
  manifest_version: 1,
  version: "1.0.0",
  runner: "docker",
  docker_compose_file: "version: '3'\nservices:\n  demo:\n    image: alpine\n",
  features: ["kms"],
  created_at: "2024-01-01T00:00:00Z",
  encrypted_env_pubkey: "test-pubkey",
  app_auth_contract_address: "0x123456789abcdef",
  deployer_address: "0xfedcba987654321",
};

describe("commitCvmProvision", () => {
  let client: ReturnType<typeof createClient>;
  let mockPost: any;

  beforeEach(() => {
    client = createClient({ apiKey: "test-api-key", baseURL: "https://api.test.com" });
    mockPost = vi.spyOn(client, "post");
  });

  describe("API routing & basic success", () => {
    it("should call correct endpoint and return CVM data", async () => {
      mockPost.mockResolvedValueOnce(mockCvmData);

      const result = await commitCvmProvision(client, mockPayload);

      expect(mockPost).toHaveBeenCalledWith("/cvms", mockPayload);
      expect(result).toEqual(mockCvmData);
    });
  });

  describe("request validation", () => {
    it("should validate response data with Zod schema", async () => {
      mockPost.mockResolvedValueOnce(mockCvmData);

      const result = await commitCvmProvision(client, mockPayload);
      expect(result).toEqual(mockCvmData);
    });
  });

  describe("error handling", () => {
    it("should throw on API errors", async () => {
      const apiError = new Error("Validation error");
      mockPost.mockRejectedValueOnce(apiError);

      await expect(commitCvmProvision(client, mockPayload)).rejects.toThrow("Validation error");
    });
  });

  describe("edge cases", () => {
    it("should allow extra fields in API response for forward compatibility", async () => {
      const responseWithExtraFields = {
        ...mockCvmData,
        future_field: "future_value",
        another_new_field: 42
      };
      mockPost.mockResolvedValueOnce(responseWithExtraFields);

      const result = await commitCvmProvision(client, mockPayload);
      expect(result).toEqual(responseWithExtraFields);
    });
  });

  describe("safeCommitCvmProvision", () => {
    it("should return SafeResult on success", async () => {
      mockPost.mockResolvedValueOnce(mockCvmData);

      const result = await safeCommitCvmProvision(client, mockPayload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockCvmData);
      }
    });

    it("should return error result when API call fails", async () => {
      const error = new Error("Validation error");
      (error as any).isRequestError = true;
      (error as any).status = 422;
      mockPost.mockRejectedValueOnce(error);

      const result = await safeCommitCvmProvision(client, mockPayload);

      expect(result.success).toBe(false);
      if (!result.success) {
        if ("isRequestError" in result.error) {
          expect(result.error.isRequestError).toBe(true);
          expect(result.error.status).toBe(422);
        }
      }
    });

    it("should handle Zod validation errors", async () => {
      mockPost.mockResolvedValueOnce({ invalid: "data" });

      const result = await safeCommitCvmProvision(client, mockPayload);

      expect(result.success).toBe(false);
      if (!result.success) {
        if (!("isRequestError" in result.error)) {
          expect(result.error.issues).toBeDefined();
        }
      }
    });
  });
});
