import { describe, it, expect, vi } from "vitest";
import { createClient, type Client } from "./client";
import { getCurrentUser, CurrentUser } from "./actions/get_current_user";
import { getCvmList } from "./actions/get_cvm_list";

describe("Client.extend()", () => {
  it("should extend client with action methods", () => {
    const client = createClient({
      apiKey: "test-key",
      baseURL: "https://api.test.com",
    });

    const testActions = {
      getCurrentUser,
      getCvmList,
    };

    const extended = client.extend(testActions);

    // Check methods exist
    expect(typeof extended.getCurrentUser).toBe("function");
    expect(typeof extended.getCvmList).toBe("function");
  });

  it("should allow chaining multiple extensions", () => {
    const customActions1 = (client: Client) => ({
      action1: () => "action1",
    });

    const customActions2 = (client: Client) => ({
      action2: () => "action2",
    });

    const client = createClient({ apiKey: "test-key" })
      .extend(customActions1)
      .extend(customActions2);

    expect(client.action1()).toBe("action1");
    expect(client.action2()).toBe("action2");
  });

  it("should bind actions to the client instance", async () => {
    const client = createClient({
      apiKey: "test-key",
      baseURL: "https://api.test.com",
    });

    // Mock the HTTP get method
    const mockGet = vi.spyOn(client, "get").mockResolvedValue({
      username: "test-user",
      email: "test@example.com",
      credits: 100,
      granted_credits: 0,
      avatar: "",
      team_name: "test-team",
      team_tier: "free",
    });

    const testActions = {
      getCurrentUser,
    };

    const extended = client.extend(testActions);

    await extended.getCurrentUser();

    expect(mockGet).toHaveBeenCalledWith("/auth/me");
  });

  it("should support function-style actions as decorator", () => {
    const myActions = {
      getCurrentUser,
    };

    const client = createClient({ apiKey: "test-key" }).extend(myActions);

    expect(typeof client.getCurrentUser).toBe("function");
  });
});

describe("Multiple extensions", () => {
  it("should support extending with multiple action sets", () => {
    const actions1 = {
      getCurrentUser,
    };

    const actions2 = {
      getCvmList,
    };

    const client = createClient({ apiKey: "test-key" })
      .extend(actions1)
      .extend(actions2);

    // Both action sets should be available
    expect(typeof client.getCurrentUser).toBe("function");
    expect(typeof client.getCvmList).toBe("function");
  });
});

describe("Type safety", () => {
  it("extended client should preserve type inference", async () => {
    const client = createClient({
      apiKey: "test-key",
      baseURL: "https://api.test.com",
    });

    const mockResponse = {
      username: "test-user",
      email: "test@example.com",
      credits: 100,
      granted_credits: 0,
      avatar: "",
      team_name: "test-team",
      team_tier: "free",
    };

    vi.spyOn(client, "get").mockResolvedValue(mockResponse);

    const testActions: {
      readonly getCurrentUser: (client: Client) => Promise<CurrentUser>;
    } = {
      getCurrentUser,
    };

    const extended = client.extend(testActions);

    const user = await extended.getCurrentUser();

    // Type inference should work
    expect(user.username).toBe("test-user");
    expect(user.credits).toBe(100);
  });
});
