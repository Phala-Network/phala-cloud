import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";
import { ContractFunctionZeroDataError, type Address, type PublicClient } from "viem";
import { checkComposeHashAllowed, safeCheckComposeHashAllowed } from "./check_compose_hash_allowed";
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
const COMPOSE_HASH = "22".repeat(32);
const COMPOSE_HASH_HEX = `0x${COMPOSE_HASH}`;

type ReadCall = { functionName: string; args?: readonly unknown[] };

interface ReaderOptions {
  generation: "legacy" | "epoch";
  composeHashAllowed?: boolean;
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
      case "allowedComposeHashes":
      case "allowedComposeHashesAtEpoch":
        return options.composeHashAllowed ?? false;
      default:
        throw new Error(`unexpected read: ${call.functionName}`);
    }
  });

  return { readContract } as unknown as PublicClient & {
    readContract: MockedFunction<(call: ReadCall) => Promise<unknown>>;
  };
}

describe("checkComposeHashAllowed", () => {
  beforeEach(() => {
    clearAppEpochProbeCache();
  });

  it("reads the epoch-0 mapping on a legacy contract", async () => {
    const publicClient = createPublicClientMock({ generation: "legacy", composeHashAllowed: true });

    await expect(
      checkComposeHashAllowed({ appAddress: APP_ADDRESS, composeHash: COMPOSE_HASH, publicClient }),
    ).resolves.toBe(true);

    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "allowedComposeHashes",
        args: [COMPOSE_HASH_HEX],
      }),
    );
    expect(publicClient.readContract).not.toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "allowedComposeHashesAtEpoch" }),
    );
  });

  it("reads the active epoch row on an epoch-aware contract", async () => {
    const publicClient = createPublicClientMock({
      generation: "epoch",
      currentAppEpoch: 4,
      composeHashAllowed: true,
    });

    await expect(
      checkComposeHashAllowed({ appAddress: APP_ADDRESS, composeHash: COMPOSE_HASH, publicClient }),
    ).resolves.toBe(true);

    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "allowedComposeHashesAtEpoch",
        args: [4n, COMPOSE_HASH_HEX],
      }),
    );
    expect(publicClient.readContract).not.toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "allowedComposeHashes" }),
    );
  });

  it("returns false when the active epoch row is not allowed", async () => {
    const publicClient = createPublicClientMock({
      generation: "epoch",
      currentAppEpoch: 1,
      composeHashAllowed: false,
    });

    await expect(
      checkComposeHashAllowed({ appAddress: APP_ADDRESS, composeHash: COMPOSE_HASH, publicClient }),
    ).resolves.toBe(false);
  });

  it("surfaces probe failures through the safe variant", async () => {
    const publicClient = {
      readContract: vi.fn().mockRejectedValue(new Error("rpc unavailable")),
    } as unknown as PublicClient;

    const result = await safeCheckComposeHashAllowed({
      appAddress: APP_ADDRESS,
      composeHash: COMPOSE_HASH,
      publicClient,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("rpc unavailable");
    }
  });
});
