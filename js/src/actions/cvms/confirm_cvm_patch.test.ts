import { describe, it, expect, vi, beforeEach } from "vitest";
import { confirmCvmPatch, safeConfirmCvmPatch, ConfirmCvmPatchRequestSchema } from "./confirm_cvm_patch";
import type { Client } from "../../client";

describe("confirmCvmPatch", () => {
  let mockClient: Client;

  beforeEach(() => {
    mockClient = {
      patch: vi.fn(),
    } as unknown as Client;
  });

  describe("ConfirmCvmPatchRequestSchema", () => {
    it("should validate valid request", () => {
      const result = ConfirmCvmPatchRequestSchema.safeParse({
        id: "test-cvm-id",
        composeHash: "0xabc123",
        transactionHash: "0xdef456",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing composeHash", () => {
      const result = ConfirmCvmPatchRequestSchema.safeParse({
        id: "test-cvm-id",
        transactionHash: "0xdef456",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing transactionHash", () => {
      const result = ConfirmCvmPatchRequestSchema.safeParse({
        id: "test-cvm-id",
        composeHash: "0xabc123",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("confirmCvmPatch action", () => {
    it("should return correlationId on success", async () => {
      (mockClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
        correlation_id: "corr-456",
      });

      const result = await confirmCvmPatch(mockClient, {
        id: "test-cvm-id",
        composeHash: "0xabc123",
        transactionHash: "0xdef456",
      });

      expect(result.correlationId).toBe("corr-456");
    });

    it("should send empty body with correct headers", async () => {
      (mockClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
        correlation_id: "corr-456",
      });

      await confirmCvmPatch(mockClient, {
        id: "test-cvm-id",
        composeHash: "0xabc123",
        transactionHash: "0xdef456",
      });

      expect(mockClient.patch).toHaveBeenCalledWith(
        "/cvms/test-cvm-id",
        {},
        {
          headers: {
            "X-Compose-Hash": "0xabc123",
            "X-Transaction-Hash": "0xdef456",
          },
        },
      );
    });

    it("should throw on API error", async () => {
      (mockClient.patch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("466 error"));

      await expect(
        confirmCvmPatch(mockClient, {
          id: "test-cvm-id",
          composeHash: "0xabc123",
          transactionHash: "0xdef456",
        }),
      ).rejects.toThrow();
    });
  });

  describe("safeConfirmCvmPatch", () => {
    it("should return success result", async () => {
      (mockClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
        correlation_id: "corr-456",
      });

      const result = await safeConfirmCvmPatch(mockClient, {
        id: "test-cvm-id",
        composeHash: "0xabc123",
        transactionHash: "0xdef456",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.correlationId).toBe("corr-456");
      }
    });

    it("should return error result on failure", async () => {
      (mockClient.patch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API Error"));

      const result = await safeConfirmCvmPatch(mockClient, {
        id: "test-cvm-id",
        composeHash: "0xabc123",
        transactionHash: "0xdef456",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("API Error");
      }
    });

    it("should return error for invalid request", async () => {
      const result = await safeConfirmCvmPatch(mockClient, {
        id: "",
        composeHash: "0xabc123",
        transactionHash: "0xdef456",
      });

      expect(result.success).toBe(false);
    });
  });
});
