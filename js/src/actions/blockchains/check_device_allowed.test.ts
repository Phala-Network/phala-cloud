import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";
import { ContractFunctionZeroDataError, type Address, type PublicClient } from "viem";
import { checkDeviceAllowed, safeCheckDeviceAllowed } from "./check_device_allowed";
import {
  APP_AUTH_BASIC_MANAGEMENT_INTERFACE_ID,
  APP_EPOCH_MANAGEMENT_INTERFACE_ID,
  clearAppEpochProbeCache,
} from "./epoch_compat";

/** Simulate a call to a function the contract does not have: the node answers with empty data. */
function missingFunction(functionName: string): ContractFunctionZeroDataError {
  return new ContractFunctionZeroDataError({ functionName });
}

const APP_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678" as Address;
const DEVICE_ID = "11".repeat(32);
const DEVICE_ID_HEX = `0x${DEVICE_ID}`;

type ReadCall = { functionName: string; args?: readonly unknown[] };

interface ReaderOptions {
  generation: "legacy" | "epoch";
  allowAnyDevice?: boolean;
  deviceAllowed?: boolean;
  currentAppEpoch?: number;
}

function createPublicClientMock(options: ReaderOptions) {
  const readContract = vi.fn(async (call: ReadCall): Promise<unknown> => {
    switch (call.functionName) {
      case "supportsInterface":
        return options.generation === "epoch"
          ? call.args?.[0] === APP_EPOCH_MANAGEMENT_INTERFACE_ID
          : call.args?.[0] === APP_AUTH_BASIC_MANAGEMENT_INTERFACE_ID;
      case "currentAppEpoch":
        if (options.generation === "legacy") {
          return Promise.reject(missingFunction(call.functionName));
        }
        return BigInt(options.currentAppEpoch ?? 0);
      case "allowAnyDevice":
        return options.allowAnyDevice ?? false;
      case "allowedDeviceIds":
      case "allowedDeviceIdsAtEpoch":
        return options.deviceAllowed ?? false;
      default:
        throw new Error(`unexpected read: ${call.functionName}`);
    }
  });

  return { readContract } as unknown as PublicClient & {
    readContract: MockedFunction<(call: ReadCall) => Promise<unknown>>;
  };
}

describe("checkDeviceAllowed", () => {
  beforeEach(() => {
    clearAppEpochProbeCache();
  });

  it("reads the epoch-0 mapping on a legacy contract", async () => {
    const publicClient = createPublicClientMock({ generation: "legacy", deviceAllowed: true });

    await expect(checkDeviceAllowed({ appAddress: APP_ADDRESS, deviceId: DEVICE_ID, publicClient }))
      .resolves.toBe(true);

    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "allowedDeviceIds",
        args: [DEVICE_ID_HEX],
      }),
    );
    expect(publicClient.readContract).not.toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "allowedDeviceIdsAtEpoch" }),
    );
  });

  it("reads the active epoch row on an epoch-aware contract", async () => {
    const publicClient = createPublicClientMock({
      generation: "epoch",
      currentAppEpoch: 2,
      deviceAllowed: true,
    });

    await expect(checkDeviceAllowed({ appAddress: APP_ADDRESS, deviceId: DEVICE_ID, publicClient }))
      .resolves.toBe(true);

    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "allowedDeviceIdsAtEpoch",
        args: [2n, DEVICE_ID_HEX],
      }),
    );
    expect(publicClient.readContract).not.toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "allowedDeviceIds" }),
    );
  });

  it("short-circuits when the contract allows any device", async () => {
    const publicClient = createPublicClientMock({
      generation: "epoch",
      currentAppEpoch: 2,
      allowAnyDevice: true,
      deviceAllowed: false,
    });

    await expect(checkDeviceAllowed({ appAddress: APP_ADDRESS, deviceId: DEVICE_ID, publicClient }))
      .resolves.toBe(true);

    expect(publicClient.readContract).not.toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "allowedDeviceIdsAtEpoch" }),
    );
  });

  it("returns false when the active epoch row is not allowed", async () => {
    const publicClient = createPublicClientMock({
      generation: "epoch",
      currentAppEpoch: 5,
      deviceAllowed: false,
    });

    await expect(checkDeviceAllowed({ appAddress: APP_ADDRESS, deviceId: DEVICE_ID, publicClient }))
      .resolves.toBe(false);
  });

  it("surfaces probe failures through the safe variant", async () => {
    const publicClient = {
      readContract: vi.fn().mockRejectedValue(new Error("rpc unavailable")),
    } as unknown as PublicClient;

    const result = await safeCheckDeviceAllowed({
      appAddress: APP_ADDRESS,
      deviceId: DEVICE_ID,
      publicClient,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("rpc unavailable");
    }
  });
});
