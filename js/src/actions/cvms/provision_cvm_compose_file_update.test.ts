import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "../../client";
import { SUPPORTED_CHAINS } from "../../types/supported_chains";
import {
  provisionCvmComposeFileUpdate,
  safeProvisionCvmComposeFileUpdate,
  type ProvisionCvmComposeFileUpdateResult,
  ProvisionCvmComposeFileUpdateRequestSchema,
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
    compose_hash_registered: false,
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

  describe("API routing & basic success", () => {
    it("should call correct endpoint with id parameter", async () => {
      (mockClient.post as any).mockResolvedValue(mockProvisionResponse);

      const result = await provisionCvmComposeFileUpdate(mockClient, mockProvisionRequest);

      expect(mockClient.post).toHaveBeenCalledWith("/cvms/cvm-123/compose_file/provision", {
        ...mockAppCompose,
        update_env_vars: undefined
      });
      expect(result).toEqual(mockProvisionResponse);
    });

    it("should include update_env_vars=true in request body when specified", async () => {
      (mockClient.post as any).mockResolvedValue(mockProvisionResponse);

      const requestWithUpdateEnvVars = {
        ...mockProvisionRequest,
        update_env_vars: true,
      };

      await provisionCvmComposeFileUpdate(mockClient, requestWithUpdateEnvVars);

      expect(mockClient.post).toHaveBeenCalledWith("/cvms/cvm-123/compose_file/provision", {
        ...mockAppCompose,
        update_env_vars: true
      });
    });

    it("should include update_env_vars=false in request body when specified", async () => {
      (mockClient.post as any).mockResolvedValue(mockProvisionResponse);

      const requestWithUpdateEnvVars = {
        ...mockProvisionRequest,
        update_env_vars: false,
      };

      await provisionCvmComposeFileUpdate(mockClient, requestWithUpdateEnvVars);

      expect(mockClient.post).toHaveBeenCalledWith("/cvms/cvm-123/compose_file/provision", {
        ...mockAppCompose,
        update_env_vars: false
      });
    });

    it("should include update_env_vars=null in request body when explicitly null", async () => {
      (mockClient.post as any).mockResolvedValue(mockProvisionResponse);

      const requestWithUpdateEnvVars = {
        ...mockProvisionRequest,
        update_env_vars: null,
      };

      await provisionCvmComposeFileUpdate(mockClient, requestWithUpdateEnvVars);

      expect(mockClient.post).toHaveBeenCalledWith("/cvms/cvm-123/compose_file/provision", {
        ...mockAppCompose,
        update_env_vars: null
      });
    });
  });

  describe("request validation", () => {
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

    it("should validate response data with Zod schema", async () => {
      const invalidResponse = { invalid: "data" };
      (mockClient.post as any).mockResolvedValue(invalidResponse);

      await expect(provisionCvmComposeFileUpdate(mockClient, mockProvisionRequest)).rejects.toThrow();
    });
  });

  describe("error handling", () => {
    it("should throw on API errors", async () => {
      const error = {
        isRequestError: true,
        message: "invalid identifier",
        status: 400,
        detail: "Docker compose file is invalid",
      };
      (mockClient.post as any).mockRejectedValue(error);

      await expect(provisionCvmComposeFileUpdate(mockClient, mockProvisionRequest)).rejects.toEqual(error);
    });
  });

  describe("edge cases", () => {
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

  describe("safeProvisionCvmComposeFileUpdate", () => {
    it("should return SafeResult on success", async () => {
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

  describe("ProvisionCvmComposeFileUpdateRequestSchema", () => {
    const baseAppCompose = {
      docker_compose_file: "version: '3.8'\nservices:\n  app:\n    image: nginx",
      name: "test-app",
    };

    describe("ID parameter validation", () => {
      it("should accept id parameter", () => {
        const input = {
          id: "cvm-123",
          app_compose: baseAppCompose,
        };

        const result = ProvisionCvmComposeFileUpdateRequestSchema.parse(input);

        expect(result.cvmId).toBe("cvm-123");
        expect(result._raw).toEqual(input);
      });

      it("should accept uuid parameter", () => {
        const input = {
          uuid: "12345678-1234-4234-8234-123456789abc",
          app_compose: baseAppCompose,
        };

        const result = ProvisionCvmComposeFileUpdateRequestSchema.parse(input);

        expect(result.cvmId).toBe("12345678-1234-4234-8234-123456789abc");
      });

      it("should accept app_id parameter without prefix", () => {
        const input = {
          app_id: "1234567890abcdef1234567890abcdef12345678",
          app_compose: baseAppCompose,
        };

        const result = ProvisionCvmComposeFileUpdateRequestSchema.parse(input);

        expect(result.cvmId).toBe("app_1234567890abcdef1234567890abcdef12345678");
      });

      it("should reject app_id parameter with prefix", () => {
        const input = {
          app_id: "app_1234567890abcdef1234567890abcdef12345678",
          app_compose: baseAppCompose,
        };

        expect(() => ProvisionCvmComposeFileUpdateRequestSchema.parse(input)).toThrow();
      });

      it("should accept instance_id parameter without prefix", () => {
        const input = {
          instance_id: "1234567890abcdef1234567890abcdef12345678",
          app_compose: baseAppCompose,
        };

        const result = ProvisionCvmComposeFileUpdateRequestSchema.parse(input);

        expect(result.cvmId).toBe("instance_1234567890abcdef1234567890abcdef12345678");
      });

      it("should reject instance_id parameter with prefix", () => {
        const input = {
          instance_id: "instance_1234567890abcdef1234567890abcdef12345678",
          app_compose: baseAppCompose,
        };

        expect(() => ProvisionCvmComposeFileUpdateRequestSchema.parse(input)).toThrow();
      });

      it("should throw when no ID parameter is provided", () => {
        const input = {
          app_compose: baseAppCompose,
        };

        expect(() => ProvisionCvmComposeFileUpdateRequestSchema.parse(input)).toThrow();
      });

      it("should prioritize id over other parameters", () => {
        const input = {
          id: "cvm-123",
          uuid: "12345678-1234-4234-8234-123456789abc",
          app_id: "1234567890abcdef1234567890abcdef12345678",
          app_compose: baseAppCompose,
        };

        const result = ProvisionCvmComposeFileUpdateRequestSchema.parse(input);

        expect(result.cvmId).toBe("cvm-123");
      });
    });

    describe("update_env_vars handling", () => {
      it("should include update_env_vars in request object when true", () => {
        const input = {
          id: "cvm-123",
          app_compose: baseAppCompose,
          update_env_vars: true,
        };

        const result = ProvisionCvmComposeFileUpdateRequestSchema.parse(input);

        expect(result.request).toHaveProperty("update_env_vars", true);
        expect(result.request.docker_compose_file).toBe(baseAppCompose.docker_compose_file);
        expect(result.request.name).toBe(baseAppCompose.name);
      });

      it("should include update_env_vars in request object when false", () => {
        const input = {
          id: "cvm-123",
          app_compose: baseAppCompose,
          update_env_vars: false,
        };

        const result = ProvisionCvmComposeFileUpdateRequestSchema.parse(input);

        expect(result.request).toHaveProperty("update_env_vars", false);
      });

      it("should include update_env_vars as undefined when not provided", () => {
        const input = {
          id: "cvm-123",
          app_compose: baseAppCompose,
        };

        const result = ProvisionCvmComposeFileUpdateRequestSchema.parse(input);

        expect(result.request).toHaveProperty("update_env_vars", undefined);
      });

      it("should include update_env_vars as null when explicitly null", () => {
        const input = {
          id: "cvm-123",
          app_compose: baseAppCompose,
          update_env_vars: null,
        };

        const result = ProvisionCvmComposeFileUpdateRequestSchema.parse(input);

        expect(result.request.update_env_vars).toBeNull();
      });
    });

    describe("app_compose transformation", () => {
      it("should spread app_compose fields into request object", () => {
        const input = {
          id: "cvm-123",
          app_compose: {
            ...baseAppCompose,
            allowed_envs: ["API_KEY", "DATABASE_URL"],
          },
        };

        const result = ProvisionCvmComposeFileUpdateRequestSchema.parse(input);

        expect(result.request.docker_compose_file).toBe(baseAppCompose.docker_compose_file);
        expect(result.request.name).toBe(baseAppCompose.name);
        expect(result.request.allowed_envs).toEqual(["API_KEY", "DATABASE_URL"]);
      });

      it("should merge app_compose with update_env_vars in request", () => {
        const input = {
          id: "cvm-123",
          app_compose: {
            ...baseAppCompose,
            allowed_envs: ["API_KEY"],
          },
          update_env_vars: true,
        };

        const result = ProvisionCvmComposeFileUpdateRequestSchema.parse(input);

        expect(result.request).toEqual({
          docker_compose_file: baseAppCompose.docker_compose_file,
          name: baseAppCompose.name,
          allowed_envs: ["API_KEY"],
          update_env_vars: true,
        });
      });
    });

    describe("transform output structure", () => {
      it("should produce correct structure with all fields", () => {
        const input = {
          id: "cvm-123",
          app_compose: baseAppCompose,
          update_env_vars: true,
        };

        const result = ProvisionCvmComposeFileUpdateRequestSchema.parse(input);

        expect(result).toHaveProperty("cvmId");
        expect(result).toHaveProperty("request");
        expect(result).toHaveProperty("_raw");
        expect(result._raw).toEqual(input);
      });
    });
  });
});
