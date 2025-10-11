import { describe, it, expect, vi } from "vitest";
import { createClient, type Client } from "./client";
import { getCurrentUser } from "./actions/get_current_user";
import { publicActions } from "./decorators/public";
import { createFullClient, createPublicClient, createCvmClient } from "./create-clients";

describe("Client.extend()", () => {
  it("should extend client with action methods", () => {
    const client = createClient({
      apiKey: "test-key",
      baseURL: "https://api.test.com",
    });

    const extended = client.extend(publicActions);

    // Check methods exist
    expect(typeof extended.getCurrentUser).toBe("function");
    expect(typeof extended.safeGetCurrentUser).toBe("function");
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

    const extended = client.extend(publicActions);

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

describe("Factory functions", () => {
  it("createFullClient should have all actions", () => {
    const client = createFullClient({ apiKey: "test-key" });

    // Public actions
    expect(typeof client.getCurrentUser).toBe("function");
    expect(typeof client.getCvmList).toBe("function");

    // CVM actions
    expect(typeof client.provisionCvm).toBe("function");
    expect(typeof client.commitCvmProvision).toBe("function");
  });

  it("createPublicClient should have only public actions", () => {
    const client = createPublicClient({ apiKey: "test-key" });

    // Should have public actions
    expect(typeof client.getCurrentUser).toBe("function");
    expect(typeof client.getCvmList).toBe("function");

    // Should NOT have CVM actions
    expect((client as any).provisionCvm).toBeUndefined();
  });

  it("createCvmClient should have only CVM actions", () => {
    const client = createCvmClient({ apiKey: "test-key" });

    // Should have CVM actions
    expect(typeof client.provisionCvm).toBe("function");
    expect(typeof client.commitCvmProvision).toBe("function");

    // Should NOT have public actions (except base client)
    expect((client as any).getCurrentUser).toBeUndefined();
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

    const extended = client.extend(publicActions);

    const user = await extended.getCurrentUser();

    // Type inference should work
    expect(user.username).toBe("test-user");
    expect(user.credits).toBe(100);
  });
});
