import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  revokeCurrentApiToken,
  safeRevokeCurrentApiToken,
} from "./revoke_current_api_token";
import type { Client } from "../../client";

describe("revokeCurrentApiToken", () => {
  let mockClient: Client;

  beforeEach(() => {
    mockClient = {
      delete: vi.fn(),
    } as unknown as Client;
  });

  describe("revokeCurrentApiToken", () => {
    it("should call DELETE /tokens/self", async () => {
      vi.mocked(mockClient.delete).mockResolvedValue(undefined);

      const result = await revokeCurrentApiToken(mockClient);

      expect(mockClient.delete).toHaveBeenCalledWith("/tokens/self");
      expect(result).toBeUndefined();
    });
  });

  describe("safeRevokeCurrentApiToken", () => {
    it("should return success result", async () => {
      vi.mocked(mockClient.delete).mockResolvedValue(undefined);

      const result = await safeRevokeCurrentApiToken(mockClient);

      expect(result.success).toBe(true);
    });

    it("should return error result on failure", async () => {
      const requestError = Object.assign(new Error("Unauthorized"), { status: 401 });
      vi.mocked(mockClient.delete).mockRejectedValue(requestError);

      const result = await safeRevokeCurrentApiToken(mockClient);

      expect(result.success).toBe(false);
    });
  });
});
