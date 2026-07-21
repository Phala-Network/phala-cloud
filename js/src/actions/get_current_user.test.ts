import { describe, it, expect, vi, beforeEach } from "vitest";
import { type Client } from "../client";
import {
  getCurrentUser,
  safeGetCurrentUser,
  type AuthResponse,
  type CurrentUser,
  CurrentUserSchema,
} from "./get_current_user";

// Mock v20260121 three-layer response
const mockAuthResponse: AuthResponse = {
  user: {
    username: "testuser",
    email: "testuser@phala.network",
    role: "user",
    avatar: "/default-avatar.png",
    email_verified: true,
    totp_enabled: false,
    has_backup_codes: false,
    flag_has_password: true,
  },
  workspace: {
    id: "ws-abc123",
    name: "Test Team",
    slug: "test-team",
    tier: "PRO",
    role: "OWNER",
  },
  credits: {
    balance: 1000,
    granted_balance: 500,
    is_post_paid: false,
    outstanding_amount: null,
  },
  features: [],
};

// Mock v20251028 flat response
const mockLegacyResponse: CurrentUser = {
  username: "testuser",
  email: "testuser@phala.network",
  credits: 1000,
  granted_credits: 500,
  avatar: "/default-avatar.png",
  team_name: "Test Team",
  team_tier: "PRO",
};

function createMockClient(version: string = "2026-01-21"): Partial<Client> {
  return {
    get: vi.fn(),
    safeGet: vi.fn(),
    config: { version } as Client["config"],
  };
}

describe("getCurrentUser", () => {
  let mockClient: Partial<Client>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient("2026-01-21");
  });

  describe("v20260121 (default) - three-layer response", () => {
    it("should call correct endpoint and return auth response", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockAuthResponse);

      const result = await getCurrentUser(mockClient as Client);

      expect(mockClient.get).toHaveBeenCalledWith("/auth/me");
      expect(result).toEqual(mockAuthResponse);
      expect(result.user.username).toBe("testuser");
      expect(result.workspace.name).toBe("Test Team");
      expect(result.credits.balance).toBe(1000);
    });

    it("should validate response data with zod schema", async () => {
      const invalidData = {
        user: {
          username: "testuser",
          // missing required fields
        },
      };

      (mockClient.get as jest.Mock).mockResolvedValue(invalidData);

      await expect(getCurrentUser(mockClient as Client)).rejects.toThrow();
    });

    it("should allow extra fields in API response for forward compatibility", async () => {
      const responseWithExtraFields = {
        ...mockAuthResponse,
        new_feature: "some_value",
        user: {
          ...mockAuthResponse.user,
          some_future_field: true,
        },
      };

      (mockClient.get as jest.Mock).mockResolvedValue(responseWithExtraFields);

      const result = await getCurrentUser(mockClient as Client);

      expect(result.user.username).toBe(mockAuthResponse.user.username);
      expect(result.workspace.name).toBe(mockAuthResponse.workspace.name);
      expect(result.credits.balance).toBe(mockAuthResponse.credits.balance);

      // Should also include the extra fields (due to passthrough())
      expect((result as Record<string, unknown>).new_feature).toBe("some_value");
    });
  });

  describe("v20251028 (legacy) - flat response", () => {
    let legacyClient: Partial<Client>;

    beforeEach(() => {
      legacyClient = createMockClient("2025-10-28");
    });

    it("should use CurrentUserSchema for v20251028 client", async () => {
      (legacyClient.get as jest.Mock).mockResolvedValue(mockLegacyResponse);

      const result = await getCurrentUser(legacyClient as Client<"2025-10-28">);

      expect(legacyClient.get).toHaveBeenCalledWith("/auth/me");
      expect(result.username).toBe("testuser");
      expect(result.credits).toBe(1000);
      expect(result.team_name).toBe("Test Team");
    });

    it("should reject three-layer response when using v20251028 client", async () => {
      (legacyClient.get as jest.Mock).mockResolvedValue(mockAuthResponse);

      // Three-layer response should fail flat schema validation
      await expect(getCurrentUser(legacyClient as Client<"2025-10-28">)).rejects.toThrow();
    });
  });

  describe("schema override", () => {
    it("should use explicit schema when provided", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockLegacyResponse);

      const result = await getCurrentUser(mockClient as Client, {
        schema: CurrentUserSchema,
      });

      expect(result.username).toBe("testuser");
      expect(result.credits).toBe(1000);
      expect(result.team_name).toBe("Test Team");
    });

    it("should return raw data when schema is false", async () => {
      const rawData = { arbitrary: "data" };
      (mockClient.get as jest.Mock).mockResolvedValue(rawData);

      const result = await getCurrentUser(mockClient as Client, { schema: false });

      expect(result).toEqual(rawData);
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

  describe("safeGetCurrentUser", () => {
    it("should return SafeResult on success", async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(mockAuthResponse);

      const result = await safeGetCurrentUser(mockClient as Client);

      expect(mockClient.get).toHaveBeenCalledWith("/auth/me");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockAuthResponse);
        expect(result.data.user.username).toBe("testuser");
        expect(result.data.workspace.name).toBe("Test Team");
        expect(result.data.credits.balance).toBe(1000);
      }
    });

    it("should return error result on API failure", async () => {
      const apiError = {
        name: "RequestError",
        message: "Network Error",
        detail: "Network Error",
        isRequestError: true,
        status: 500,
      };

      (mockClient.get as jest.Mock).mockRejectedValue(apiError);

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
        user: { username: 123 }, // should be string
      };

      (mockClient.get as jest.Mock).mockResolvedValue(invalidData);

      const result = await safeGetCurrentUser(mockClient as Client);

      expect(result.success).toBe(false);
      if (!result.success) {
        if (!("isRequestError" in result.error)) {
          expect(result.error.name).toBe("ZodError");
          expect(result.error.issues).toBeDefined();
          expect(result.error.issues.length).toBeGreaterThan(0);
        }
      }
    });

    it("should work with v20251028 client", async () => {
      const legacyClient = createMockClient("2025-10-28");
      (legacyClient.get as jest.Mock).mockResolvedValue(mockLegacyResponse);

      const result = await safeGetCurrentUser(legacyClient as Client<"2025-10-28">);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as CurrentUser;
        expect(data.username).toBe("testuser");
        expect(data.credits).toBe(1000);
      }
    });
  });
});
