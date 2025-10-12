import { describe, it, expect, vi, beforeEach } from "vitest";
import { type Client } from "../client";
import { getCurrentUser, safeGetCurrentUser, type CurrentUser } from "./get_current_user";

// Mock response data matching the API structure
const mockUserData: CurrentUser = {
  username: "testuser",
  email: "testuser@phala.network",
  credits: 1000,
  granted_credits: 500,
  avatar: "/default-avatar.png",
  team_name: "Test Team",
  team_tier: "pro",
};

describe("getCurrentUser", () => {
  let mockClient: Partial<Client>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      get: vi.fn(),
      safeGet: vi.fn(),
    };
  });

  describe("API routing & basic success", () => {
    it("should call correct endpoint and return user data", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockUserData);

      const result = await getCurrentUser(mockClient as Client);

      expect(mockClient.get).toHaveBeenCalledWith("/auth/me");
      expect(result).toEqual(mockUserData);
      expect((result as CurrentUser).username).toBe("testuser");
      expect((result as CurrentUser).credits).toBe(1000);
    });
  });

  describe("request validation", () => {
    it("should validate response data with zod schema", async () => {
      const invalidData = {
        username: "testuser",
        email: "testuser@phala.network",
        credits: "invalid", // should be number
        // missing required fields
      };

      (mockClient.get as jest.Mock).mockResolvedValue(invalidData);

      await expect(getCurrentUser(mockClient as Client)).rejects.toThrow();
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const apiError = new Error("API Error");
      (mockClient.get as jest.Mock).mockRejectedValue(apiError);

      await expect(getCurrentUser(mockClient as Client)).rejects.toThrow("API Error");
    });

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("Request timed out");
      timeoutError.name = "TimeoutError";
      (mockClient.get as jest.Mock).mockRejectedValue(timeoutError);

      await expect(getCurrentUser(mockClient as Client)).rejects.toThrow("Request timed out");
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network error");
      networkError.name = "NetworkError";
      (mockClient.get as jest.Mock).mockRejectedValue(networkError);

      await expect(getCurrentUser(mockClient as Client)).rejects.toThrow("Network error");
    });
  });

  describe("edge cases", () => {
    it("should allow extra fields in API response for forward compatibility", async () => {
      const responseWithExtraFields = {
        ...mockUserData,
        // Extra fields that might be added in future API versions
        new_feature: "some_value",
        premium_features: {
          enabled: true,
          plan: "pro",
        },
        metadata: {
          last_login: "2024-01-01T00:00:00Z",
          preferences: {
            theme: "dark",
            language: "en",
          },
        },
      };

      (mockClient.get as jest.Mock).mockResolvedValue(responseWithExtraFields);

      const result = await getCurrentUser(mockClient as Client);

      // Should include the core fields
      expect((result as CurrentUser).username).toBe(mockUserData.username);
      expect((result as CurrentUser).email).toBe(mockUserData.email);
      expect((result as CurrentUser).credits).toBe(mockUserData.credits);

      // Should also include the extra fields (due to passthrough())
      expect((result as any).new_feature).toBe("some_value");
      expect((result as any).premium_features).toEqual({
        enabled: true,
        plan: "pro",
      });
    });

    it("should work without parameters", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockUserData);

      const result = await getCurrentUser(mockClient as Client);
      expect(result).toEqual(mockUserData);
    });
  });

  describe("safeGetCurrentUser", () => {
    it("should return SafeResult on success", async () => {
      (mockClient.safeGet as jest.Mock).mockResolvedValue({
        success: true,
        data: mockUserData,
      });

      const result = await safeGetCurrentUser(mockClient as Client);

      expect(mockClient.safeGet).toHaveBeenCalledWith("/auth/me");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockUserData);
        expect((result.data as CurrentUser).username).toBe("testuser");
      }
    });

    it("should return error result on API failure", async () => {
      const apiError = {
        success: false,
        error: {
          name: "RequestError",
          message: "Network Error",
          detail: "Network Error",
          isRequestError: true,
          status: 500,
        },
      };

      (mockClient.safeGet as jest.Mock).mockResolvedValue(apiError);

      const result = await safeGetCurrentUser(mockClient as Client);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Network Error");
        if ("isRequestError" in result.error) {
          expect(result.error.isRequestError).toBe(true);
          expect(result.error.status).toBe(500);
        }
      }
    });

    it("should handle zod validation errors", async () => {
      const invalidData = {
        username: 123, // should be string
        email: "testuser@phala.network",
      };

      (mockClient.safeGet as jest.Mock).mockResolvedValue({
        success: true,
        data: invalidData,
      });

      const result = await safeGetCurrentUser(mockClient as Client);

      expect(result.success).toBe(false);
      if (!result.success) {
        // If it doesn't have isRequestError, it's a ZodError
        if (!("isRequestError" in result.error)) {
          expect(result.error.name).toBe("ZodError");
          expect(result.error.issues).toBeDefined();
          expect(result.error.issues.length).toBeGreaterThan(0);
          expect(result.error.issues[0].path).toEqual(["username"]);
          expect(result.error.issues[0].code).toBe("invalid_type");
        }
      }
    });
  });
});
