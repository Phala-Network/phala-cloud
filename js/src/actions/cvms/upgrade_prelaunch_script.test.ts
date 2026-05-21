import { describe, it, expect, beforeEach, vi } from "vitest";
import { createClient } from "../../client";
import { PhalaCloudError } from "../../utils/errors";
import { upgradePreLaunchScript } from "./upgrade_prelaunch_script";

describe("upgradePreLaunchScript", () => {
  let client: ReturnType<typeof createClient>;
  let mockPost: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = createClient({ apiKey: "test-api-key", baseURL: "https://api.test.com" });
    mockPost = vi.spyOn(client, "post");
  });

  it("POSTs to the upgrade endpoint with no body when there are no Phase-2 headers", async () => {
    mockPost.mockResolvedValue({
      status: "in_progress",
      message: "Pre-launch script update initiated",
      correlation_id: "corr-1",
    });

    const result = await upgradePreLaunchScript(client, { id: "cvm-1" });

    expect(mockPost).toHaveBeenCalledWith(
      "/cvms/cvm-1/pre-launch-script/upgrade-to-latest-official",
      undefined,
      { headers: {} },
    );
    expect(result).toEqual({
      status: "in_progress",
      message: "Pre-launch script update initiated",
      correlation_id: "corr-1",
    });
  });

  it("forwards compose_hash and transaction_hash via Phase-2 headers", async () => {
    mockPost.mockResolvedValue({
      status: "in_progress",
      message: "ok",
      correlation_id: "corr-2",
    });

    await upgradePreLaunchScript(client, {
      id: "cvm-2",
      compose_hash: "0xabc",
      transaction_hash: "0xdef",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/cvms/cvm-2/pre-launch-script/upgrade-to-latest-official",
      undefined,
      {
        headers: {
          "X-Compose-Hash": "0xabc",
          "X-Transaction-Hash": "0xdef",
        },
      },
    );
  });

  it("maps a 465 StructuredError into precondition_required", async () => {
    const err = new PhalaCloudError("Compose hash registration required", {
      status: 465,
      detail: {
        message: "Compose hash registration required",
        details: [
          { field: "compose_hash", value: "0xhash" },
          { field: "app_id", value: "app-1" },
          { field: "device_id", value: "device-1" },
          {
            field: "kms_info",
            value: {
              id: "kms-1",
              slug: "kms-1",
              url: "https://kms.example.com",
              version: "1.0.0",
              chain_id: 1,
              kms_contract_address: "0xkms",
              gateway_app_id: "0xgateway",
            },
          },
        ],
      },
    });
    mockPost.mockRejectedValue(err);

    const result = await upgradePreLaunchScript(client, { id: "cvm-3" });

    expect(result.status).toBe("precondition_required");
    if (result.status === "precondition_required") {
      expect(result.compose_hash).toBe("0xhash");
      expect(result.app_id).toBe("app-1");
      expect(result.device_id).toBe("device-1");
    }
  });

  it("re-throws non-465 errors", async () => {
    const err = new PhalaCloudError("Conflict", { status: 409 });
    mockPost.mockRejectedValue(err);

    await expect(upgradePreLaunchScript(client, { id: "cvm-4" })).rejects.toThrow(err);
  });
});
