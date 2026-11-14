import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";
import { ContractFunctionZeroDataError, type Address, type PublicClient } from "viem";
import { getAllowedDevices, safeGetAllowedDevices } from "./get_allowed_devices";
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
const OWNER = "0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb" as Address;
const ALLOWED_DEVICE = "11".repeat(32);
const BLOCKED_DEVICE = "22".repeat(32);
const ALLOWED_DEVICE_HEX = `0x${ALLOWED_DEVICE}`;

type ReadCall = { functionName: string; args?: readonly unknown[] };
type MulticallCall = { functionName: string; args?: readonly unknown[] };

interface ReaderOptions {
  generation: "legacy" | "epoch";
  allowAnyDevice?: boolean;
  allowedDeviceIds?: string[];
  currentAppEpoch?: number;
}

function createPublicClientMock(options: ReaderOptions) {
  const allowedHexIds = new Set((options.allowedDeviceIds ?? []).map((id) => `0x${id}`));

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
      case "owner":
        return OWNER;
      default:
        throw new Error(`unexpected read: ${call.functionName}`);
    }
  });

  const multicall = vi.fn(
    async ({ contracts }: { contracts: readonly MulticallCall[] }): Promise<unknown[]> => {
      return contracts.map((call) => {
        // The device id is the last argument in both getter generations.
        const deviceId = call.args?.[call.args.length - 1];
        return {
          status: "success" as const,
          result: allowedHexIds.has(deviceId as string),
        };
      });
    },
  );

  return { readContract, multicall } as unknown as PublicClient & {
    readContract: MockedFunction<(call: ReadCall) => Promise<unknown>>;
    multicall: MockedFunction<
      (input: { contracts: readonly MulticallCall[] }) => Promise<unknown[]>
    >;
  };
}

describe("getAllowedDevices", () => {
  beforeEach(() => {
    clearAppEpochProbeCache();
  });

  it("batch-reads the epoch-0 mapping on a legacy contract", async () => {
    const publicClient = createPublicClientMock({
      generation: "legacy",
      allowedDeviceIds: [ALLOWED_DEVICE],
    });

    const result = await getAllowedDevices({
      appAddress: APP_ADDRESS,
      deviceIds: [ALLOWED_DEVICE, BLOCKED_DEVICE],
      publicClient,
    });

    expect(result).toEqual({
      appAddress: APP_ADDRESS,
      owner: OWNER,
      allowAnyDevice: false,
      devices: [ALLOWED_DEVICE_HEX],
    });

    const [{ contracts }] = publicClient.multicall.mock.calls[0] as [
      { contracts: MulticallCall[] },
    ];
    expect(contracts.map((call) => call.functionName)).toEqual([
      "allowedDeviceIds",
      "allowedDeviceIds",
    ]);
    expect(contracts[0]?.args).toEqual([ALLOWED_DEVICE_HEX]);
  });

  it("batch-reads the active epoch rows on an epoch-aware contract", async () => {
    const publicClient = createPublicClientMock({
      generation: "epoch",
      currentAppEpoch: 2,
      allowedDeviceIds: [ALLOWED_DEVICE],
    });

    const result = await getAllowedDevices({
      appAddress: APP_ADDRESS,
      deviceIds: [ALLOWED_DEVICE, BLOCKED_DEVICE],
      publicClient,
    });

    expect(result.devices).toEqual([ALLOWED_DEVICE_HEX]);

    const [{ contracts }] = publicClient.multicall.mock.calls[0] as [
      { contracts: MulticallCall[] },
    ];
    expect(contracts.map((call) => call.functionName)).toEqual([
      "allowedDeviceIdsAtEpoch",
      "allowedDeviceIdsAtEpoch",
    ]);
    expect(contracts[0]?.args).toEqual([2n, ALLOWED_DEVICE_HEX]);
  });

  it("skips the row reads when the contract allows any device", async () => {
    const publicClient = createPublicClientMock({
      generation: "epoch",
      currentAppEpoch: 2,
      allowAnyDevice: true,
    });

    const result = await getAllowedDevices({
      appAddress: APP_ADDRESS,
      deviceIds: [ALLOWED_DEVICE, BLOCKED_DEVICE],
      publicClient,
    });

    expect(result.allowAnyDevice).toBe(true);
    expect(result.devices).toEqual([ALLOWED_DEVICE_HEX, `0x${BLOCKED_DEVICE}`]);
    expect(publicClient.multicall).not.toHaveBeenCalled();
  });

  it("does not read rows when no candidate devices are given", async () => {
    const publicClient = createPublicClientMock({ generation: "epoch", currentAppEpoch: 2 });

    const result = await getAllowedDevices({
      appAddress: APP_ADDRESS,
      deviceIds: [],
      publicClient,
    });

    expect(result.devices).toEqual([]);
    expect(publicClient.multicall).not.toHaveBeenCalled();
  });

  it("surfaces probe failures through the safe variant", async () => {
    const publicClient = {
      readContract: vi.fn().mockRejectedValue(new Error("rpc unavailable")),
      multicall: vi.fn(),
    } as unknown as PublicClient;

    const result = await safeGetAllowedDevices({
      appAddress: APP_ADDRESS,
      deviceIds: [ALLOWED_DEVICE],
      publicClient,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("rpc unavailable");
    }
  });
});
