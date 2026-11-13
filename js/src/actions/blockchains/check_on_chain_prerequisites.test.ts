import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";
import { ContractFunctionZeroDataError, type Address, type PublicClient } from "viem";
import { checkOnChainPrerequisites, safeCheckOnChainPrerequisites } from "./check_on_chain_prerequisites";
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
const COMPOSE_HASH = "22".repeat(32);
const COMPOSE_HASH_HEX = `0x${COMPOSE_HASH}`;

type ReadCall = { functionName: string; args?: readonly unknown[] };
type MulticallCall = { functionName: string; args?: readonly unknown[] };

interface ReaderOptions {
  generation: "legacy" | "epoch";
  currentAppEpoch?: number;
  allowAnyDevice?: boolean;
  deviceAllowed?: boolean;
  composeHashAllowed?: boolean;
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
      default:
        throw new Error(`unexpected read: ${call.functionName}`);
    }
  });

  const multicall = vi.fn(
    async ({ contracts }: { contracts: readonly MulticallCall[] }): Promise<unknown[]> => {
      return contracts.map((call) => {
        switch (call.functionName) {
          case "allowAnyDevice":
            return { status: "success" as const, result: options.allowAnyDevice ?? false };
          case "allowedDeviceIds":
          case "allowedDeviceIdsAtEpoch":
            return { status: "success" as const, result: options.deviceAllowed ?? false };
          case "allowedComposeHashes":
          case "allowedComposeHashesAtEpoch":
            return { status: "success" as const, result: options.composeHashAllowed ?? false };
          default:
            throw new Error(`unexpected multicall: ${call.functionName}`);
        }
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

describe("checkOnChainPrerequisites", () => {
  beforeEach(() => {
    clearAppEpochProbeCache();
  });

  it("uses the epoch-0 getters on a legacy contract", async () => {
    const publicClient = createPublicClientMock({
      generation: "legacy",
      deviceAllowed: true,
      composeHashAllowed: false,
    });

    const result = await checkOnChainPrerequisites({
      appAddress: APP_ADDRESS,
      deviceId: DEVICE_ID,
      composeHash: COMPOSE_HASH,
      publicClient,
    });

    expect(result).toEqual({
      allowAnyDevice: false,
      deviceAllowed: true,
      composeHashAllowed: false,
    });

    const [{ contracts }] = publicClient.multicall.mock.calls[0] as [
      { contracts: MulticallCall[] },
    ];
    expect(contracts.map((call) => call.functionName)).toEqual([
      "allowAnyDevice",
      "allowedDeviceIds",
      "allowedComposeHashes",
    ]);
    expect(contracts[1]?.args).toEqual([DEVICE_ID_HEX]);
    expect(contracts[2]?.args).toEqual([COMPOSE_HASH_HEX]);
  });

  it("uses the active epoch getters on an epoch-aware contract", async () => {
    const publicClient = createPublicClientMock({
      generation: "epoch",
      currentAppEpoch: 6,
      deviceAllowed: false,
      composeHashAllowed: true,
    });

    const result = await checkOnChainPrerequisites({
      appAddress: APP_ADDRESS,
      deviceId: DEVICE_ID,
      composeHash: COMPOSE_HASH,
      publicClient,
    });

    expect(result).toEqual({
      allowAnyDevice: false,
      deviceAllowed: false,
      composeHashAllowed: true,
    });

    const [{ contracts }] = publicClient.multicall.mock.calls[0] as [
      { contracts: MulticallCall[] },
    ];
    expect(contracts.map((call) => call.functionName)).toEqual([
      "allowAnyDevice",
      "allowedDeviceIdsAtEpoch",
      "allowedComposeHashesAtEpoch",
    ]);
    expect(contracts[1]?.args).toEqual([6n, DEVICE_ID_HEX]);
    expect(contracts[2]?.args).toEqual([6n, COMPOSE_HASH_HEX]);
  });

  it("treats allowAnyDevice as allowing the device on both generations", async () => {
    const publicClient = createPublicClientMock({
      generation: "epoch",
      currentAppEpoch: 1,
      allowAnyDevice: true,
      deviceAllowed: false,
    });

    const result = await checkOnChainPrerequisites({
      appAddress: APP_ADDRESS,
      deviceId: DEVICE_ID,
      composeHash: COMPOSE_HASH,
      publicClient,
    });

    expect(result.allowAnyDevice).toBe(true);
    expect(result.deviceAllowed).toBe(true);
  });

  it("treats a failed read as not allowed", async () => {
    const publicClient = {
      readContract: vi.fn(async (call: ReadCall) => {
        if (call.functionName === "supportsInterface") {
          return call.args?.[0] === APP_AUTH_BASIC_MANAGEMENT_INTERFACE_ID;
        }
        throw new Error(`unexpected read: ${call.functionName}`);
      }),
      multicall: vi.fn(async () => [
        { status: "failure", error: new Error("reverted") },
        { status: "success", result: true },
        { status: "failure", error: new Error("reverted") },
      ]),
    } as unknown as PublicClient;

    const result = await checkOnChainPrerequisites({
      appAddress: APP_ADDRESS,
      deviceId: DEVICE_ID,
      composeHash: COMPOSE_HASH,
      publicClient,
    });

    expect(result).toEqual({
      allowAnyDevice: false,
      deviceAllowed: true,
      composeHashAllowed: false,
    });
  });

  it("surfaces probe failures through the safe variant", async () => {
    const publicClient = {
      readContract: vi.fn().mockRejectedValue(new Error("rpc unavailable")),
      multicall: vi.fn(),
    } as unknown as PublicClient;

    const result = await safeCheckOnChainPrerequisites({
      appAddress: APP_ADDRESS,
      deviceId: DEVICE_ID,
      composeHash: COMPOSE_HASH,
      publicClient,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("rpc unavailable");
    }
  });
});
