import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "../client";
import {
  provisionCvm,
  safeProvisionCvm,
  ProvisionCvmRequest,
} from "./provision_cvm";

const mockAppCompose: ProvisionCvmRequest = {
  node_id: 1,
  name: "test-vm",
  image: "dstack-dev-0.5.1",
  vcpu: 2,
  memory: 4096,
  disk_size: 40,
  compose_file: {
    features: ["kms"],
    name: "compose-name",
  },
};

const mockProvisionData = {
  app_id: "test-app-id",
  app_env_encrypt_pubkey: "test-pubkey",
  compose_hash: "test-hash",
  fmspc: "test-fmspc",
  device_id: "test-device",
  os_image_hash: "test-os-hash",
  node_id: 1, // Transformed from teepod_id
};

describe("provisionCvm", () => {
  let client: ReturnType<typeof createClient>;
  let mockPost: any;

  beforeEach(() => {
    client = createClient({ apiKey: "test-api-key", baseURL: "https://api.test.com" });
    mockPost = vi.spyOn(client, "post");
  });

  describe("API routing & basic success", () => {
    it("should call correct endpoint and transform teepod_id to node_id", async () => {
      // Mock backend response with teepod_id
      const backendResponse = { ...mockProvisionData, teepod_id: 1 };
      delete (backendResponse as any).node_id;
      mockPost.mockResolvedValueOnce(backendResponse);

      const result = await provisionCvm(client, mockAppCompose);

      expect(mockPost).toHaveBeenCalledWith(
        "/cvms/provision",
        expect.objectContaining({ teepod_id: mockAppCompose.node_id })
      );
      expect(result).toEqual(mockProvisionData); // Should have node_id, not teepod_id
      expect(result).toHaveProperty("node_id", 1);
      expect(result).not.toHaveProperty("teepod_id");
    });
  });


  describe("special business logic", () => {
    it("should transform teepod_id to node_id in response with default schema", async () => {
      const backendResponse = {
        app_id: "test-app",
        compose_hash: "test-hash",
        teepod_id: 123
      };
      mockPost.mockResolvedValueOnce(backendResponse);

      const result = await provisionCvm(client, mockAppCompose);
      expect(result).toHaveProperty("node_id", 123);
      expect(result).not.toHaveProperty("teepod_id");
    });

    it("should NOT transform teepod_id when schema is false", async () => {
      const backendResponse = {
        app_id: "test-app",
        compose_hash: "test-hash",
        teepod_id: 123
      };
      mockPost.mockResolvedValueOnce(backendResponse);

      const result = await provisionCvm(client, mockAppCompose, { schema: false });
      expect(result).toHaveProperty("teepod_id", 123);
      expect(result).not.toHaveProperty("node_id");
    });

    it("should print warning if deprecated teepod_id is used in request", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const req = { ...mockAppCompose, node_id: undefined, teepod_id: 2 };
      const backendResponse = { ...mockProvisionData, teepod_id: 2 };
      delete (backendResponse as any).node_id;
      mockPost.mockResolvedValueOnce(backendResponse);

      await provisionCvm(client, req);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("teepod_id is deprecated")
      );
      warnSpy.mockRestore();
    });

    it("should prefer node_id over teepod_id if both are present in request", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const req = { ...mockAppCompose, teepod_id: 999 };
      const backendResponse = { ...mockProvisionData, teepod_id: 1 };
      delete (backendResponse as any).node_id;
      mockPost.mockResolvedValueOnce(backendResponse);

      await provisionCvm(client, req);

      // Should not warn, should use node_id
      expect(warnSpy).not.toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledWith(
        "/cvms/provision",
        expect.objectContaining({ teepod_id: mockAppCompose.node_id })
      );
      warnSpy.mockRestore();
    });

    it("should convert tproxy_enabled to gateway_enabled and show warning", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const configWithTproxy = {
        ...mockAppCompose,
        compose_file: {
          ...mockAppCompose.compose_file,
          tproxy_enabled: true,
        },
      };
      delete (configWithTproxy.compose_file as any).gateway_enabled;

      const backendResponse = { ...mockProvisionData, teepod_id: 1 };
      delete (backendResponse as any).node_id;
      mockPost.mockResolvedValueOnce(backendResponse);

      await provisionCvm(client, configWithTproxy);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("tproxy_enabled is deprecated")
      );
      expect(mockPost).toHaveBeenCalledWith(
        "/cvms/provision",
        expect.objectContaining({
          compose_file: expect.objectContaining({
            gateway_enabled: true,
          }),
        })
      );
      expect(mockPost).toHaveBeenCalledWith(
        "/cvms/provision",
        expect.not.objectContaining({
          compose_file: expect.objectContaining({
            tproxy_enabled: expect.anything(),
          }),
        })
      );
      warnSpy.mockRestore();
    });

    it("should prefer gateway_enabled over tproxy_enabled when both are provided", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const configWithBoth = {
        ...mockAppCompose,
        compose_file: {
          ...mockAppCompose.compose_file,
          gateway_enabled: false,
          tproxy_enabled: true,
        },
      };

      const backendResponse = { ...mockProvisionData, teepod_id: 1 };
      delete (backendResponse as any).node_id;
      mockPost.mockResolvedValueOnce(backendResponse);

      await provisionCvm(client, configWithBoth);

      // Should not warn when gateway_enabled is present
      expect(warnSpy).not.toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledWith(
        "/cvms/provision",
        expect.objectContaining({
          compose_file: expect.objectContaining({
            gateway_enabled: false,
          }),
        })
      );
      warnSpy.mockRestore();
    });
  });

  describe("error handling", () => {
    it("should throw on API errors", async () => {
      const apiError = new Error("API error");
      mockPost.mockRejectedValueOnce(apiError);

      await expect(provisionCvm(client, mockAppCompose)).rejects.toThrow("API error");
    });
  });

  describe("edge cases", () => {
    it("should handle response without teepod_id field gracefully", async () => {
      const backendResponse = {
        app_id: "test-app",
        compose_hash: "test-hash"
        // No teepod_id field
      };
      mockPost.mockResolvedValueOnce(backendResponse);

      const result = await provisionCvm(client, mockAppCompose);
      expect(result).toHaveProperty("app_id", "test-app");
      expect(result).not.toHaveProperty("teepod_id");
      expect(result).not.toHaveProperty("node_id");
    });

    it("should handle missing compose_file gracefully", async () => {
      const configWithoutComposeFile = {
        ...mockAppCompose,
      };
      delete (configWithoutComposeFile as any).compose_file;

      const backendResponse = { ...mockProvisionData, teepod_id: 1 };
      delete (backendResponse as any).node_id;
      mockPost.mockResolvedValueOnce(backendResponse);

      await expect(provisionCvm(client, configWithoutComposeFile)).resolves.toBeDefined();
    });

    it("should allow extra fields in API response for forward compatibility", async () => {
      const extraData = { ...mockProvisionData, teepod_id: 1, extra_field: "extra" };
      delete (extraData as any).node_id;
      mockPost.mockResolvedValueOnce(extraData);

      const result = await provisionCvm(client, mockAppCompose);
      expect(result).toHaveProperty("extra_field");
      expect(result).toHaveProperty("node_id", 1);
      expect(result).not.toHaveProperty("teepod_id");
    });
  });

  describe("safeProvisionCvm", () => {
    it("should return SafeResult on success with teepod_id transformation", async () => {
      const backendResponse = { ...mockProvisionData, teepod_id: 1 };
      delete (backendResponse as any).node_id;
      mockPost.mockResolvedValueOnce(backendResponse);

      const result = await safeProvisionCvm(client, mockAppCompose);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockProvisionData);
        expect(result.data).toHaveProperty("node_id", 1);
        expect(result.data).not.toHaveProperty("teepod_id");
      }
    });

    it("should return error result when API call fails", async () => {
      const error = new Error("fail");
      (error as any).isRequestError = true;
      (error as any).status = 500;
      mockPost.mockRejectedValueOnce(error);

      const result = await safeProvisionCvm(client, mockAppCompose);

      expect(result.success).toBe(false);
      if (!result.success) {
        if ("isRequestError" in result.error) {
          expect(result.error.isRequestError).toBe(true);
        }
      }
    });

    it("should NOT transform teepod_id when schema is false", async () => {
      const backendResponse = {
        app_id: "test-app",
        compose_hash: "test-hash",
        teepod_id: 456
      };
      mockPost.mockResolvedValueOnce(backendResponse);

      const result = await safeProvisionCvm(client, mockAppCompose, { schema: false });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty("teepod_id", 456);
        expect(result.data).not.toHaveProperty("node_id");
      }
    });
  });
});
