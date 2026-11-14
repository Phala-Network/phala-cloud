import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";
import {
  ContractFunctionZeroDataError,
  type Address,
  type Hash,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import { base } from "viem/chains";
import {
  createTransactionTracker,
  type NetworkClients,
  type TransactionTracker,
} from "../../utils";
import { addDevice, safeAddDevice, type AddDeviceRequest } from "./add_device";
import {
  APP_AUTH_BASIC_MANAGEMENT_INTERFACE_ID,
  APP_EPOCH_MANAGEMENT_INTERFACE_ID,
  clearAppEpochProbeCache,
} from "./epoch_compat";

/** Simulate a call to a function the contract does not have: the node answers with empty data. */
function missingFunction(functionName: string): ContractFunctionZeroDataError {
  return new ContractFunctionZeroDataError({ functionName });
}

vi.mock("../../utils", async () => {
  const actual = await vi.importActual<typeof import("../../utils")>("../../utils");
  return { ...actual, createTransactionTracker: vi.fn() };
});

const mockCreateTransactionTracker = createTransactionTracker as MockedFunction<
  typeof createTransactionTracker
>;

const APP_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678" as Address;
const SENDER = "0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb" as Address;
const DEVICE_ID = "11".repeat(32);
const DEVICE_ID_HEX = `0x${DEVICE_ID}` as Hash;
const TX_HASH = `0x${"33".repeat(32)}` as Hash;

const RECEIPT = {
  transactionHash: TX_HASH,
  blockNumber: 1234567n,
  gasUsed: 21000n,
  logs: [],
  status: "success",
} as unknown as TransactionReceipt;

type PublicClientMock = PublicClient & {
  readContract: MockedFunction<
    (call: { functionName: string; args?: readonly unknown[] }) => Promise<unknown>
  >;
};

interface ContractOptions {
  generation: "legacy" | "epoch";
  currentAppEpoch?: number;
}

function createPublicClientMock(options: ContractOptions): PublicClientMock {
  const readContract = vi.fn(async (call: { functionName: string; args?: readonly unknown[] }) => {
    switch (call.functionName) {
      case "supportsInterface":
        return options.generation === "epoch"
          ? call.args?.[0] === APP_EPOCH_MANAGEMENT_INTERFACE_ID
          : call.args?.[0] === APP_AUTH_BASIC_MANAGEMENT_INTERFACE_ID;
      case "owner":
        return SENDER;
      case "currentAppEpoch":
        if (options.generation === "legacy") {
          return Promise.reject(missingFunction(call.functionName));
        }
        return BigInt(options.currentAppEpoch ?? 0);
      default:
        throw new Error(`unexpected read: ${call.functionName}`);
    }
  });

  return { readContract } as unknown as PublicClientMock;
}

describe("addDevice", () => {
  let publicClient: PublicClientMock;
  let walletClient: WalletClient;
  let writeContract: MockedFunction<(call: Record<string, unknown>) => Promise<Hash>>;
  let request: AddDeviceRequest;

  function useGeneration(options: ContractOptions): void {
    // The probe caches per address; a new generation per test needs a clean cache.
    clearAppEpochProbeCache();
    publicClient = createPublicClientMock(options);
    request = {
      chain: base,
      appAddress: APP_ADDRESS,
      deviceId: DEVICE_ID,
      privateKey: undefined,
      walletClient,
      publicClient,
      skipPrerequisiteChecks: true,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    writeContract = vi.fn().mockResolvedValue(TX_HASH);
    walletClient = {
      account: { address: SENDER },
      chain: base,
      writeContract,
    } as unknown as WalletClient;

    mockCreateTransactionTracker.mockReturnValue({
      status: { state: "idle" },
      isComplete: false,
      execute: async (
        operation: (clients: NetworkClients) => Promise<Hash>,
        clients: NetworkClients,
      ) => {
        await operation(clients);
        return { hash: TX_HASH, receipt: RECEIPT, success: true };
      },
    } as unknown as TransactionTracker);

    useGeneration({ generation: "legacy" });
  });

  it("uses the epoch-less setter on a legacy contract", async () => {
    const result = await addDevice(request);

    expect(writeContract).toHaveBeenCalledTimes(1);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: APP_ADDRESS,
        functionName: "addDevice",
        args: [DEVICE_ID_HEX],
        account: expect.objectContaining({ address: SENDER }),
        chain: base,
      }),
    );
    expect(result.epochsWritten).toBeUndefined();
    expect(result.deviceId).toBe(DEVICE_ID_HEX);
  });

  it("rejects an explicit epoch on a legacy contract without sending a transaction", async () => {
    await expect(addDevice({ ...request, epoch: 1 })).rejects.toThrow(
      "does not support app epochs",
    );

    expect(writeContract).not.toHaveBeenCalled();
  });

  it("writes the current and next epoch when no epoch is requested", async () => {
    useGeneration({ generation: "epoch", currentAppEpoch: 3 });

    const result = await addDevice(request);

    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "addDeviceAtEpochs",
        args: [3n, 4n, DEVICE_ID_HEX],
      }),
    );
    expect(result.epochsWritten).toEqual([3, 4]);
  });

  it("writes exactly the requested epoch", async () => {
    useGeneration({ generation: "epoch", currentAppEpoch: 3 });

    const result = await addDevice({ ...request, epoch: 2 });

    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "addDeviceAtEpoch",
        args: [2n, DEVICE_ID_HEX],
      }),
    );
    expect(result.epochsWritten).toEqual([2, 2]);
  });

  it("refuses an epoch outside the writable range", async () => {
    useGeneration({ generation: "epoch", currentAppEpoch: 1 });

    await expect(addDevice({ ...request, epoch: 3 })).rejects.toThrow("is not writable");

    expect(writeContract).not.toHaveBeenCalled();
  });

  it("reports the epoch rejection through the safe variant", async () => {
    const result = await safeAddDevice({ ...request, epoch: 1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("does not support app epochs");
    }
  });
});
