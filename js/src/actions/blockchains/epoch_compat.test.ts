import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ContractFunctionZeroDataError,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import {
  APP_AUTH_BASIC_MANAGEMENT_INTERFACE_ID,
  APP_EPOCH_MANAGEMENT_INTERFACE_ID,
  clearAppEpochProbeCache,
  epochsWritten,
  resolveAppEpochPlan,
  resolveAppEpochWritePlan,
  writeComposeHashAllowlist,
  writeDeviceAllowlist,
  type AppEpochWritePlan,
  type AppPolicyWriteContext,
} from "./epoch_compat";

/** Simulate a call to a function the contract does not have: the node answers with empty data. */
function missingFunction(functionName: string): ContractFunctionZeroDataError {
  return new ContractFunctionZeroDataError({ functionName });
}

const APP_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678" as Address;
const OTHER_APP_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12" as Address;
const DEVICE_ID = `0x${"11".repeat(32)}` as Hex;
const COMPOSE_HASH = `0x${"22".repeat(32)}` as Hex;
const TX_HASH = `0x${"33".repeat(32)}` as Hex;
const SENDER = "0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb" as Address;

type ReadCall = { functionName: string; args?: readonly unknown[] };

interface ReaderOptions {
  /** Which generation the mocked contract reports. */
  generation: "legacy" | "epoch" | "silent";
  currentAppEpoch?: number;
  /** Chain id reported by the client; the probe cache is keyed by it. */
  chainId?: number;
  allowAnyDevice?: boolean;
  deviceAllowed?: boolean;
  composeHashAllowed?: boolean;
  /** Reject instead of answering, to model a contract without ERC-165. */
  failSupportsInterface?: boolean;
  failCurrentAppEpoch?: boolean;
}

function createPublicClientMock(options: ReaderOptions) {
  const readContract = vi.fn(async (call: ReadCall): Promise<unknown> => {
    switch (call.functionName) {
      case "supportsInterface": {
        if (options.failSupportsInterface) {
          return Promise.reject(missingFunction(call.functionName));
        }
        const interfaceId = call.args?.[0];
        if (options.generation === "epoch") {
          return interfaceId === APP_EPOCH_MANAGEMENT_INTERFACE_ID;
        }
        if (options.generation === "legacy") {
          return interfaceId === APP_AUTH_BASIC_MANAGEMENT_INTERFACE_ID;
        }
        return false;
      }
      case "currentAppEpoch": {
        if (options.generation === "legacy" || options.failCurrentAppEpoch) {
          return Promise.reject(missingFunction(call.functionName));
        }
        return BigInt(options.currentAppEpoch ?? 0);
      }
      case "allowAnyDevice":
        return options.allowAnyDevice ?? false;
      case "allowedDeviceIds":
      case "allowedDeviceIdsAtEpoch":
        return options.deviceAllowed ?? false;
      case "allowedComposeHashes":
      case "allowedComposeHashesAtEpoch":
        return options.composeHashAllowed ?? false;
      default:
        throw new Error(`unexpected read: ${call.functionName}`);
    }
  });

  const client = {
    readContract,
    getChainId: vi.fn(async () => options.chainId ?? 8453),
  } as unknown as PublicClient & {
    readContract: typeof readContract;
  };
  if (options.chainId !== undefined) {
    Object.assign(client, { chain: { id: options.chainId } });
  }
  return client;
}

function readCallsOf(publicClient: PublicClient, functionName: string): ReadCall[] {
  return (publicClient.readContract as unknown as { mock: { calls: [ReadCall][] } }).mock.calls
    .map(([call]) => call)
    .filter((call) => call.functionName === functionName);
}

/**
 * Pin the ERC-165 interface IDs to the selector sets documented in dstack.
 * A mismatch here means the on-chain interface changed and every probe in this
 * SDK silently falls back to the other generation.
 */
describe("interface IDs", () => {
  function interfaceIdOf(signatures: string[]): string {
    let acc = 0n;
    for (const signature of signatures) {
      acc ^= BigInt(keccak256(stringToHex(signature)).slice(0, 10));
    }
    return `0x${acc.toString(16).padStart(8, "0")}`;
  }

  it("APP_EPOCH_MANAGEMENT_INTERFACE_ID is the XOR of the 11 IAppEpochManagement selectors", () => {
    const signatures = [
      "addComposeHashAtEpoch(uint256,bytes32)",
      "addComposeHashAtEpochs(uint256,uint256,bytes32)",
      "removeComposeHashAtEpoch(uint256,bytes32)",
      "removeComposeHashAtEpochs(uint256,uint256,bytes32)",
      "addDeviceAtEpoch(uint256,bytes32)",
      "addDeviceAtEpochs(uint256,uint256,bytes32)",
      "removeDeviceAtEpoch(uint256,bytes32)",
      "removeDeviceAtEpochs(uint256,uint256,bytes32)",
      "setAllowAnyDevice(bool)",
      "setAllowAnyTeeVariant(bool)",
      "setAllowedTeeVariants(string[])",
    ];

    expect(signatures).toHaveLength(11);
    expect(interfaceIdOf(signatures)).toBe(APP_EPOCH_MANAGEMENT_INTERFACE_ID);
    expect(APP_EPOCH_MANAGEMENT_INTERFACE_ID).toBe("0x8c0524c4");
  });

  it("APP_AUTH_BASIC_MANAGEMENT_INTERFACE_ID is the XOR of the 4 legacy selectors", () => {
    const signatures = [
      "addComposeHash(bytes32)",
      "removeComposeHash(bytes32)",
      "addDevice(bytes32)",
      "removeDevice(bytes32)",
    ];

    expect(interfaceIdOf(signatures)).toBe(APP_AUTH_BASIC_MANAGEMENT_INTERFACE_ID);
    expect(APP_AUTH_BASIC_MANAGEMENT_INTERFACE_ID).toBe("0x8fd37527");
  });
});

describe("resolveAppEpochPlan", () => {
  beforeEach(() => {
    clearAppEpochProbeCache();
  });

  it("detects an epoch-aware contract through IAppEpochManagement", async () => {
    const publicClient = createPublicClientMock({ generation: "epoch", currentAppEpoch: 3 });

    await expect(resolveAppEpochPlan(publicClient, APP_ADDRESS)).resolves.toEqual({
      kind: "epoch",
      currentAppEpoch: 3,
    });

    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: APP_ADDRESS,
        functionName: "supportsInterface",
        args: [APP_EPOCH_MANAGEMENT_INTERFACE_ID],
      }),
    );
    // The legacy marker is never asked once the epoch marker answers.
    expect(readCallsOf(publicClient, "supportsInterface")).toHaveLength(1);
  });

  it("detects a legacy contract through IAppAuthBasicManagement", async () => {
    const publicClient = createPublicClientMock({ generation: "legacy" });

    await expect(resolveAppEpochPlan(publicClient, APP_ADDRESS)).resolves.toEqual({
      kind: "legacy",
    });

    expect(readCallsOf(publicClient, "supportsInterface").map((call) => call.args?.[0])).toEqual([
      APP_EPOCH_MANAGEMENT_INTERFACE_ID,
      APP_AUTH_BASIC_MANAGEMENT_INTERFACE_ID,
    ]);
    expect(readCallsOf(publicClient, "currentAppEpoch")).toHaveLength(0);
  });

  it("treats a reverting supportsInterface as no marker and falls back to currentAppEpoch", async () => {
    const publicClient = createPublicClientMock({
      generation: "epoch",
      currentAppEpoch: 1,
      failSupportsInterface: true,
    });

    await expect(resolveAppEpochPlan(publicClient, APP_ADDRESS)).resolves.toEqual({
      kind: "epoch",
      currentAppEpoch: 1,
    });
    expect(readCallsOf(publicClient, "currentAppEpoch")).toHaveLength(2);
  });

  it("treats a reverting currentAppEpoch as legacy", async () => {
    const publicClient = createPublicClientMock({
      generation: "silent",
      failCurrentAppEpoch: true,
    });

    await expect(resolveAppEpochPlan(publicClient, APP_ADDRESS)).resolves.toEqual({
      kind: "legacy",
    });
  });

  it("caches the probe verdict per address but re-reads currentAppEpoch", async () => {
    const publicClient = createPublicClientMock({ generation: "epoch", currentAppEpoch: 2 });

    await resolveAppEpochPlan(publicClient, APP_ADDRESS);
    await resolveAppEpochPlan(publicClient, APP_ADDRESS);

    expect(readCallsOf(publicClient, "supportsInterface")).toHaveLength(1);
    expect(readCallsOf(publicClient, "currentAppEpoch")).toHaveLength(2);
  });

  it("caches per address, not globally", async () => {
    const epochClient = createPublicClientMock({ generation: "epoch", currentAppEpoch: 0 });
    const legacyClient = createPublicClientMock({ generation: "legacy" });

    await expect(resolveAppEpochPlan(epochClient, APP_ADDRESS)).resolves.toEqual({
      kind: "epoch",
      currentAppEpoch: 0,
    });
    await expect(resolveAppEpochPlan(legacyClient, OTHER_APP_ADDRESS)).resolves.toEqual({
      kind: "legacy",
    });
  });

  it("scopes the verdict cache by chain id: same address on two chains probes twice", async () => {
    const baseClient = createPublicClientMock({ generation: "legacy", chainId: 8453 });
    const ethClient = createPublicClientMock({ generation: "epoch", currentAppEpoch: 2, chainId: 1 });

    await expect(resolveAppEpochPlan(baseClient, APP_ADDRESS)).resolves.toEqual({
      kind: "legacy",
    });
    await expect(resolveAppEpochPlan(ethClient, APP_ADDRESS)).resolves.toEqual({
      kind: "epoch",
      currentAppEpoch: 2,
    });

    // The legacy verdict costs two probe reads (epoch marker, then legacy
    // marker); the epoch verdict stops after the first marker. Both chains
    // probed independently — a shared cache entry would have skipped one.
    expect(readCallsOf(baseClient, "supportsInterface")).toHaveLength(2);
    expect(readCallsOf(ethClient, "supportsInterface")).toHaveLength(1);
  });

  it("picks up a legacy → epoch proxy upgrade after the legacy verdict expires", async () => {
    vi.useFakeTimers();
    try {
      const upgraded = { generation: "legacy" as "legacy" | "epoch", currentAppEpoch: 1 };
      const publicClient = createPublicClientMock({
        get generation() {
          return upgraded.generation;
        },
        currentAppEpoch: 1,
      });

      await expect(resolveAppEpochPlan(publicClient, APP_ADDRESS)).resolves.toEqual({
        kind: "legacy",
      });

      // The proxy is upgraded: the same address now answers as epoch-aware.
      upgraded.generation = "epoch";

      // Within the TTL the stale legacy verdict is still served…
      await expect(resolveAppEpochPlan(publicClient, APP_ADDRESS)).resolves.toEqual({
        kind: "legacy",
      });

      // …and after it the contract is re-probed.
      vi.setSystemTime(Date.now() + 6 * 60 * 1000);
      await expect(resolveAppEpochPlan(publicClient, APP_ADDRESS)).resolves.toEqual({
        kind: "epoch",
        currentAppEpoch: 1,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not cache when the network identity is unknown", async () => {
    const epochClient = createPublicClientMock({ generation: "epoch", currentAppEpoch: 0 });
    // No configured chain and no eth_chainId answer: nothing may be cached,
    // or the verdict would leak into an "unknown" bucket shared by networks.
    (epochClient as { getChainId: () => Promise<number> }).getChainId = vi.fn(
      async () => {
        throw new Error("no chain id");
      },
    );

    await resolveAppEpochPlan(epochClient, APP_ADDRESS);
    await resolveAppEpochPlan(epochClient, APP_ADDRESS);

    expect(readCallsOf(epochClient, "supportsInterface")).toHaveLength(2);
  });

  it("never expires an epoch verdict: generations only move legacy → epoch", async () => {
    vi.useFakeTimers();
    try {
      const publicClient = createPublicClientMock({ generation: "epoch", currentAppEpoch: 0 });

      await resolveAppEpochPlan(publicClient, APP_ADDRESS);
      vi.setSystemTime(Date.now() + 60 * 60 * 1000);
      await resolveAppEpochPlan(publicClient, APP_ADDRESS);

      expect(readCallsOf(publicClient, "supportsInterface")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("forgets verdicts when the cache is cleared", async () => {
    const publicClient = createPublicClientMock({ generation: "epoch", currentAppEpoch: 0 });

    await resolveAppEpochPlan(publicClient, APP_ADDRESS);
    clearAppEpochProbeCache();
    await resolveAppEpochPlan(publicClient, APP_ADDRESS);

    expect(readCallsOf(publicClient, "supportsInterface")).toHaveLength(2);
  });

  it("rethrows transport failures instead of caching a wrong verdict", async () => {
    const readContract = vi.fn().mockRejectedValue(new Error("rpc unavailable"));
    const publicClient = { readContract } as unknown as PublicClient;

    await expect(resolveAppEpochPlan(publicClient, APP_ADDRESS)).rejects.toThrow(
      "rpc unavailable",
    );
    // Nothing was cached, so the next call probes again rather than trusting a guess.
    await expect(resolveAppEpochPlan(publicClient, APP_ADDRESS)).rejects.toThrow(
      "rpc unavailable",
    );
    expect(readContract).toHaveBeenCalledTimes(2);
  });
});

describe("resolveAppEpochWritePlan", () => {
  beforeEach(() => {
    clearAppEpochProbeCache();
  });

  it("keeps the epoch-less setter on a legacy contract", async () => {
    const publicClient = createPublicClientMock({ generation: "legacy" });

    await expect(resolveAppEpochWritePlan(publicClient, APP_ADDRESS)).resolves.toEqual({
      kind: "legacy",
    });
  });

  it("rejects an explicit epoch on a legacy contract", async () => {
    const publicClient = createPublicClientMock({ generation: "legacy" });

    await expect(resolveAppEpochWritePlan(publicClient, APP_ADDRESS, 1)).rejects.toThrow(
      `Contract ${APP_ADDRESS} does not support app epochs`,
    );
  });

  it("writes the current and next epoch when no epoch is requested", async () => {
    const publicClient = createPublicClientMock({ generation: "epoch", currentAppEpoch: 4 });

    await expect(resolveAppEpochWritePlan(publicClient, APP_ADDRESS)).resolves.toEqual({
      kind: "epochs",
      fromEpoch: 4,
      toEpoch: 5,
    });
  });

  it("removals default to every writable epoch, history included", async () => {
    const publicClient = createPublicClientMock({ generation: "epoch", currentAppEpoch: 4 });

    // The contract still authorizes any epoch ≤ current, so a removal that
    // skipped history would leave the value fetchable at older epochs.
    await expect(
      resolveAppEpochWritePlan(publicClient, APP_ADDRESS, undefined, "remove"),
    ).resolves.toEqual({
      kind: "epochs",
      fromEpoch: 0,
      toEpoch: 5,
    });
  });

  it("an explicit epoch scopes even a removal to that epoch", async () => {
    const publicClient = createPublicClientMock({ generation: "epoch", currentAppEpoch: 4 });

    await expect(
      resolveAppEpochWritePlan(publicClient, APP_ADDRESS, 2, "remove"),
    ).resolves.toEqual({ kind: "epoch", epoch: 2 });
  });

  it("writes exactly the requested epoch", async () => {
    const publicClient = createPublicClientMock({ generation: "epoch", currentAppEpoch: 4 });

    await expect(resolveAppEpochWritePlan(publicClient, APP_ADDRESS, 0)).resolves.toEqual({
      kind: "epoch",
      epoch: 0,
    });
  });

  it("accepts the contract's writable upper bound", async () => {
    const publicClient = createPublicClientMock({ generation: "epoch", currentAppEpoch: 4 });

    await expect(resolveAppEpochWritePlan(publicClient, APP_ADDRESS, 5)).resolves.toEqual({
      kind: "epoch",
      epoch: 5,
    });
  });

  it("rejects an epoch past currentAppEpoch + 1 before sending a doomed transaction", async () => {
    const publicClient = createPublicClientMock({ generation: "epoch", currentAppEpoch: 4 });

    await expect(resolveAppEpochWritePlan(publicClient, APP_ADDRESS, 6)).rejects.toThrow(
      "Epoch 6 is not writable on contract",
    );
  });

  it("rejects a negative epoch", async () => {
    const publicClient = createPublicClientMock({ generation: "epoch", currentAppEpoch: 4 });

    await expect(resolveAppEpochWritePlan(publicClient, APP_ADDRESS, -1)).rejects.toThrow(
      "Epoch must be a non-negative integer",
    );
  });
});

describe("epochsWritten", () => {
  it("reports nothing for a legacy write", () => {
    expect(epochsWritten({ kind: "legacy" })).toBeUndefined();
  });

  it("reports a single epoch twice", () => {
    expect(epochsWritten({ kind: "epoch", epoch: 3 })).toEqual([3, 3]);
  });

  it("reports the written range", () => {
    expect(epochsWritten({ kind: "epochs", fromEpoch: 3, toEpoch: 4 })).toEqual([3, 4]);
  });
});

describe("allowlist writes", () => {
  function createWriteContext(): {
    context: AppPolicyWriteContext;
    writeContract: ReturnType<typeof vi.fn>;
  } {
    const writeContract = vi.fn().mockResolvedValue(TX_HASH);
    const walletClient = {
      account: { address: SENDER },
      writeContract,
    } as unknown as WalletClient;
    return {
      context: { walletClient, address: APP_ADDRESS, account: SENDER, chain: null },
      writeContract,
    };
  }

  const plans: Array<[AppEpochWritePlan, string, readonly unknown[]]> = [
    [{ kind: "legacy" }, "addDevice", [DEVICE_ID]],
    [{ kind: "epoch", epoch: 2 }, "addDeviceAtEpoch", [2n, DEVICE_ID]],
    [
      { kind: "epochs", fromEpoch: 2, toEpoch: 3 },
      "addDeviceAtEpochs",
      [2n, 3n, DEVICE_ID],
    ],
  ];

  it.each(plans)("adds a device with plan %j", async (plan, functionName, args) => {
    const { context, writeContract } = createWriteContext();

    await writeDeviceAllowlist(context, "add", plan, DEVICE_ID);

    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: APP_ADDRESS,
        functionName,
        args: [...args],
        chain: null,
      }),
    );
  });

  const removePlans: Array<[AppEpochWritePlan, string, readonly unknown[]]> = [
    [{ kind: "legacy" }, "removeDevice", [DEVICE_ID]],
    [{ kind: "epoch", epoch: 2 }, "removeDeviceAtEpoch", [2n, DEVICE_ID]],
    [
      { kind: "epochs", fromEpoch: 2, toEpoch: 3 },
      "removeDeviceAtEpochs",
      [2n, 3n, DEVICE_ID],
    ],
  ];

  it.each(removePlans)("removes a device with plan %j", async (plan, functionName, args) => {
    const { context, writeContract } = createWriteContext();

    await writeDeviceAllowlist(context, "remove", plan, DEVICE_ID);

    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName, args: [...args] }),
    );
  });

  const composeAddPlans: Array<[AppEpochWritePlan, string, readonly unknown[]]> = [
    [{ kind: "legacy" }, "addComposeHash", [COMPOSE_HASH]],
    [{ kind: "epoch", epoch: 1 }, "addComposeHashAtEpoch", [1n, COMPOSE_HASH]],
    [
      { kind: "epochs", fromEpoch: 1, toEpoch: 2 },
      "addComposeHashAtEpochs",
      [1n, 2n, COMPOSE_HASH],
    ],
  ];

  it.each(composeAddPlans)("adds a compose hash with plan %j", async (plan, functionName, args) => {
    const { context, writeContract } = createWriteContext();

    await writeComposeHashAllowlist(context, "add", plan, COMPOSE_HASH);

    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName, args: [...args] }),
    );
  });

  const composeRemovePlans: Array<[AppEpochWritePlan, string, readonly unknown[]]> = [
    [{ kind: "legacy" }, "removeComposeHash", [COMPOSE_HASH]],
    [{ kind: "epoch", epoch: 1 }, "removeComposeHashAtEpoch", [1n, COMPOSE_HASH]],
    [
      { kind: "epochs", fromEpoch: 1, toEpoch: 2 },
      "removeComposeHashAtEpochs",
      [1n, 2n, COMPOSE_HASH],
    ],
  ];

  it.each(composeRemovePlans)(
    "removes a compose hash with plan %j",
    async (plan, functionName, args) => {
      const { context, writeContract } = createWriteContext();

      await writeComposeHashAllowlist(context, "remove", plan, COMPOSE_HASH);

      expect(writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName, args: [...args] }),
      );
    },
  );
});
