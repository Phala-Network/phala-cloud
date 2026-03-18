import { describe, it, expect, vi, beforeEach } from "vitest";
import { patchCvm, safePatchCvm, PatchCvmRequestSchema } from "./patch_cvm";
import { PhalaCloudError } from "../../utils/errors";
import type { Client } from "../../client";

function make465Error() {
  return new PhalaCloudError("Compose hash registration required", {
    status: 465,
    statusText: "Hash Registration Required",
    detail: {
      error_code: "HASH_REGISTRATION_REQUIRED",
      message: "Compose hash registration required",
      details: [
        { field: "compose_hash", value: "0xabc123" },
        { field: "app_id", value: "0xdef456" },
        { field: "device_id", value: "0x789abc" },
        {
          field: "kms_info",
          value: {
            id: "1",
            slug: "ethereum",
            url: "https://kms.example.com",
            version: "1.0.0",
            chain_id: 8453,
            kms_contract_address: "0xkms123",
            gateway_app_id: "0xgateway123",
          },
        },
      ],
    },
  });
}

describe("patchCvm", () => {
  let mockClient: Client;

  beforeEach(() => {
    mockClient = {
      patch: vi.fn(),
    } as unknown as Client;
  });

  describe("PatchCvmRequestSchema", () => {
    it("should validate valid request with id", () => {
      const result = PatchCvmRequestSchema.safeParse({
        id: "test-cvm-id",
        docker_compose_file: "version: '3'",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty id", () => {
      const result = PatchCvmRequestSchema.safeParse({
        id: "",
        docker_compose_file: "version: '3'",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing CVM identifier", () => {
      const result = PatchCvmRequestSchema.safeParse({
        docker_compose_file: "version: '3'",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("patchCvm action", () => {
    it("should return accepted result on 202", async () => {
      (mockClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
        correlation_id: "corr-123",
      });

      const result = await patchCvm(mockClient, {
        id: "test-cvm-id",
        docker_compose_file: "version: '3'",
      });

      expect(result.requiresOnChainHash).toBe(false);
      if (!result.requiresOnChainHash) {
        expect(result.correlationId).toBe("corr-123");
      }
      expect(mockClient.patch).toHaveBeenCalledWith(
        "/cvms/test-cvm-id",
        expect.objectContaining({ docker_compose_file: "version: '3'" }),
      );
    });

    it("should return hash-required result on 465", async () => {
      (mockClient.patch as ReturnType<typeof vi.fn>).mockRejectedValue(make465Error());

      const result = await patchCvm(mockClient, {
        id: "test-cvm-id",
        docker_compose_file: "version: '3'",
      });

      expect(result.requiresOnChainHash).toBe(true);
      if (result.requiresOnChainHash) {
        expect(result.composeHash).toBe("0xabc123");
        expect(result.appId).toBe("0xdef456");
        expect(result.deviceId).toBe("0x789abc");
        expect(result.kmsInfo).toBeDefined();
      }
    });

    it("should throw on non-465 errors", async () => {
      const error = new PhalaCloudError("Not found", {
        status: 404,
        statusText: "Not Found",
        detail: "CVM not found",
      });
      (mockClient.patch as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(
        patchCvm(mockClient, { id: "test-cvm-id", docker_compose_file: "version: '3'" }),
      ).rejects.toThrow();
    });
  });

  describe("safePatchCvm", () => {
    it("should return success for accepted result", async () => {
      (mockClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
        correlation_id: "corr-123",
      });

      const result = await safePatchCvm(mockClient, {
        id: "test-cvm-id",
        docker_compose_file: "version: '3'",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requiresOnChainHash).toBe(false);
      }
    });

    it("should return success for 465 hash-required result", async () => {
      (mockClient.patch as ReturnType<typeof vi.fn>).mockRejectedValue(make465Error());

      const result = await safePatchCvm(mockClient, {
        id: "test-cvm-id",
        docker_compose_file: "version: '3'",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requiresOnChainHash).toBe(true);
      }
    });

    it("should return error for non-465 failures", async () => {
      const error = new PhalaCloudError("Not found", {
        status: 404,
        statusText: "Not Found",
        detail: "CVM not found",
      });
      (mockClient.patch as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      const result = await safePatchCvm(mockClient, {
        id: "test-cvm-id",
        docker_compose_file: "version: '3'",
      });

      expect(result.success).toBe(false);
    });

    it("should return error for invalid request", async () => {
      const result = await safePatchCvm(mockClient, { id: "" } as never);

      expect(result.success).toBe(false);
    });
  });
});
