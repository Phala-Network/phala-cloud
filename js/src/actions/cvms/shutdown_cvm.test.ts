import { describe, it, expect, vi, beforeEach } from "vitest";
import { shutdownCvm, safeShutdownCvm, ShutdownCvmRequestSchema } from "./shutdown_cvm";
import type { Client } from "../../client";

describe("shutdownCvm", () => {
  let mockClient: Client;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
    } as unknown as Client;
  });

  describe("ShutdownCvmRequestSchema", () => {
    it("should validate valid request", () => {
      const result = ShutdownCvmRequestSchema.safeParse({ id: "test-cvm-id" });
      expect(result.success).toBe(true);
    });

    it("should reject empty id", () => {
      const result = ShutdownCvmRequestSchema.safeParse({ id: "" });
      expect(result.success).toBe(false);
    });

    it("should reject missing id", () => {
      const result = ShutdownCvmRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("shutdownCvm", () => {
    it("should call POST /cvms/{id}/shutdown", async () => {
      const mockResponse = {
        id: "cvm_1",
        name: "test-cvm",
        status: "shutting_down",
        teepod_id: 1,
        teepod: { id: 1, name: "test-node" },
        app_id: "app_test123",
        vm_uuid: "uuid-123",
        instance_id: null,
        vcpu: 2,
        memory: 2048,
        disk_size: 20,
        base_image: "ubuntu-22.04",
        created_at: "2025-01-01T00:00:00Z",
        encrypted_env_pubkey: null,
      };

      (mockClient.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await shutdownCvm(mockClient, { id: "test-cvm-id" });

      expect(mockClient.post).toHaveBeenCalledWith("/cvms/test-cvm-id/shutdown");
      expect(result.status).toBe("shutting_down");
    });

    it("should throw error for invalid id", async () => {
      await expect(shutdownCvm(mockClient, { id: "" })).rejects.toThrow();
    });
  });

  describe("safeShutdownCvm", () => {
    it("should return success result", async () => {
      const mockResponse = {
        id: "cvm_1",
        name: "test-cvm",
        status: "shutting_down",
        teepod_id: 1,
        teepod: { id: 1, name: "test-node" },
        app_id: "app_test123",
        vm_uuid: "uuid-123",
        instance_id: null,
        vcpu: 2,
        memory: 2048,
        disk_size: 20,
        base_image: "ubuntu-22.04",
        created_at: "2025-01-01T00:00:00Z",
        encrypted_env_pubkey: null,
      };

      (mockClient.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await safeShutdownCvm(mockClient, { id: "test-cvm-id" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("shutting_down");
      }
    });

    it("should return error result for invalid id", async () => {
      const result = await safeShutdownCvm(mockClient, { id: "" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it("should return error result for API failure", async () => {
      (mockClient.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API Error"));

      const result = await safeShutdownCvm(mockClient, { id: "test-cvm-id" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("API Error");
      }
    });
  });
});
