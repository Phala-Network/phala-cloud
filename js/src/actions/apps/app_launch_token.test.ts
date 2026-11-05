import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "../../client";
import { clearAppLaunchToken, setAppLaunchToken } from "./app_launch_token";

describe("app launch token", () => {
  const response = { launch_token: "t".repeat(32), launch_token_hash: "a".repeat(64) };
  let mockClient: Client;

  beforeEach(() => {
    mockClient = {
      post: vi.fn().mockResolvedValue(response),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as Client;
  });

  it("asks Phala Cloud to generate a token when none is given", async () => {
    const result = await setAppLaunchToken(mockClient, { appId: "abc123" });
    expect(mockClient.post).toHaveBeenCalledWith("/apps/abc123/launch-token", {});
    expect(result).toEqual(response);
  });

  it("sends a caller-supplied token", async () => {
    await setAppLaunchToken(mockClient, { appId: "abc123", launchToken: "t".repeat(32) });
    expect(mockClient.post).toHaveBeenCalledWith("/apps/abc123/launch-token", {
      launch_token: "t".repeat(32),
    });
  });

  it("clears the token with DELETE /apps/{app_id}/launch-token", async () => {
    await clearAppLaunchToken(mockClient, { appId: "abc123" });
    expect(mockClient.delete).toHaveBeenCalledWith("/apps/abc123/launch-token");
  });
});
