import { z } from "zod";
import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  type Account,
  type Address,
  type Chain,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { dstackAppAbi } from "./abi/dstack_app";

/**
 * Compatibility layer between the two generations of the DstackApp contract.
 *
 * dstack 0.6.4 replaced the epoch-less allowlist setters (`addDevice`,
 * `removeDevice`, `addComposeHash`, `removeComposeHash`) with per-epoch forms:
 *
 * - `…AtEpoch(epoch, value)` writes exactly one epoch;
 * - `…AtEpochs(fromEpoch, toEpoch, value)` writes a range, capped at
 *   `currentAppEpoch + 1`;
 * - `currentAppEpoch()` reports the active epoch;
 * - allowlist rows are not inherited across epochs, so the legacy getters
 *   (`allowedDeviceIds`, `allowedComposeHashes`) only ever report epoch-0 rows.
 *
 * Contracts shipped before 0.6.4 keep working through the legacy calls, so
 * every caller has to know which generation it is talking to. That is what the
 * probe below answers, cached per contract address for the process lifetime.
 */

/** ERC-165 interface ID of `IAppEpochManagement` (dstack >= 0.6.4). */
export const APP_EPOCH_MANAGEMENT_INTERFACE_ID = "0x8c0524c4";

/** ERC-165 interface ID of `IAppAuthBasicManagement` (dstack < 0.6.4). */
export const APP_AUTH_BASIC_MANAGEMENT_INTERFACE_ID = "0x8fd37527";

/**
 * The app epoch rows a write touched, as `[fromEpoch, toEpoch]`. A single-epoch
 * write reports the same epoch twice. `undefined` means the contract has no
 * epoch concept at all and the write used an epoch-less setter.
 */
export const EpochsWrittenSchema = z.tuple([z.number().int(), z.number().int()]);

export type EpochsWritten = [fromEpoch: number, toEpoch: number];

/** Which generation of the DstackApp contract an address runs. */
export type AppContractGeneration = "legacy" | "epoch";

/**
 * The contract generation plus, for epoch-aware contracts, the epoch that reads
 * and writes should target by default.
 */
export type AppEpochPlan = { kind: "legacy" } | { kind: "epoch"; currentAppEpoch: number };

/**
 * How a single allowlist value should be written:
 *
 * - `legacy` — epoch-less setter on a contract without epochs;
 * - `epoch` — `…AtEpoch(epoch, value)`, the caller named the epoch;
 * - `epochs` — `…AtEpochs(fromEpoch, toEpoch, value)`, the default range:
 *   `[currentAppEpoch, currentAppEpoch + 1]` for additions, and
 *   `[0, currentAppEpoch + 1]` for removals — the contract still authorizes
 *   any epoch ≤ current (`appEpoch > currentAppEpoch` is the only bound), so
 *   a removal that skips historical epochs leaves the old rows fetchable.
 */
export type AppEpochWritePlan =
  | { readonly kind: "legacy" }
  | { readonly kind: "epoch"; readonly epoch: number }
  | { readonly kind: "epochs"; readonly fromEpoch: number; readonly toEpoch: number };

/** Wallet-side context a policy write needs, mirroring the action clients. */
export type AppPolicyWriteContext = {
  readonly walletClient: WalletClient;
  readonly address: Address;
  readonly account: Account | Address;
  readonly chain: Chain | null;
};

/**
 * Probe verdicts are cached per `(chainId, address)`; the chain id comes from
 * the client's configured chain or `eth_chainId`. When neither is available
 * the verdict is not cached at all — an "unknown" bucket would leak verdicts
 * across networks.
 *
 * Two facts shape the cache:
 *
 * - Only the generation is cached: `currentAppEpoch` is a moving policy fact
 *   and is re-read on every resolve, so a cached plan can never write or read
 *   a stale epoch after `advanceAppEpoch`.
 * - An `"epoch"` verdict is permanent (upgrades only go legacy → epoch), but a
 *   `"legacy"` verdict expires after {@link LEGACY_VERDICT_TTL_MS} so a proxy
 *   upgrade is picked up by long-lived processes without a restart.
 */
const LEGACY_VERDICT_TTL_MS = 5 * 60 * 1000;

type CachedGeneration = {
  readonly generation: AppContractGeneration;
  readonly expiresAt: number;
};

const generationCache = new Map<string, CachedGeneration>();

function generationCacheKey(chainId: number | undefined, contractAddress: Address): string {
  return `${chainId ?? "unknown"}:${contractAddress.toLowerCase()}`;
}

/**
 * The network the client talks to: the configured chain, or `eth_chainId`
 * when the client was built without one. Returns `undefined` when the network
 * cannot be determined — callers must skip caching then, because an
 * unidentified `unknown:address` bucket would share verdicts across networks.
 */
async function resolveChainId(publicClient: PublicClient): Promise<number | undefined> {
  if (publicClient.chain?.id !== undefined) return publicClient.chain.id;
  try {
    return await publicClient.getChainId();
  } catch {
    return undefined;
  }
}

/** Drop cached probe verdicts; meant for tests and long-lived processes. */
export function clearAppEpochProbeCache(): void {
  generationCache.clear();
}

/**
 * Whether the call failed because of the contract itself — it reverted, or it
 * has no such function so the node answered with empty data.
 *
 * Transport failures (timeouts, rate limits, unreachable RPC) are *not*
 * contract rejections: answering is impossible, and guessing "legacy" there
 * would make read paths silently return stale epoch-0 rows.
 */
function isContractRejection(error: unknown): boolean {
  if (!(error instanceof BaseError)) return false;
  return (
    error.walk(
      (nested) =>
        nested instanceof ContractFunctionRevertedError ||
        nested instanceof ContractFunctionZeroDataError,
    ) !== null
  );
}

/**
 * Read one ERC-165 marker: `true`/`false` when the contract answered, and a
 * contract rejection downgraded to `false` because "does not implement it" and
 * "reverted" are the same verdict for a probe.
 */
async function supportsInterface(
  publicClient: PublicClient,
  contractAddress: Address,
  interfaceId: Hex,
): Promise<boolean> {
  try {
    const supported = await publicClient.readContract({
      address: contractAddress,
      abi: dstackAppAbi,
      functionName: "supportsInterface",
      args: [interfaceId],
    });
    return supported === true;
  } catch (error) {
    if (isContractRejection(error)) return false;
    throw error;
  }
}

async function readCurrentAppEpoch(
  publicClient: PublicClient,
  contractAddress: Address,
): Promise<number> {
  const epoch = await publicClient.readContract({
    address: contractAddress,
    abi: dstackAppAbi,
    functionName: "currentAppEpoch",
  });
  return Number(epoch);
}

async function probeGeneration(
  publicClient: PublicClient,
  contractAddress: Address,
): Promise<AppContractGeneration> {
  if (await supportsInterface(publicClient, contractAddress, APP_EPOCH_MANAGEMENT_INTERFACE_ID)) {
    return "epoch";
  }
  if (
    await supportsInterface(publicClient, contractAddress, APP_AUTH_BASIC_MANAGEMENT_INTERFACE_ID)
  ) {
    return "legacy";
  }
  // Neither marker: fall back to the epoch getter, which only the epoch-aware
  // contract implements. A contract rejection means legacy; anything else is a
  // transport problem we must not turn into a verdict.
  try {
    await readCurrentAppEpoch(publicClient, contractAddress);
    return "epoch";
  } catch (error) {
    if (isContractRejection(error)) return "legacy";
    throw error;
  }
}

/**
 * Resolve which DstackApp generation `appContractAddress` runs, and for
 * epoch-aware contracts the epoch to target.
 *
 * Probes `supportsInterface(0x8c0524c4)` (epoch-aware), then
 * `supportsInterface(0x8fd37527)` (legacy), and finally falls back to
 * `currentAppEpoch()`, treating a contract rejection as legacy. Transport
 * failures are rethrown instead of being cached as a verdict.
 */
export async function resolveAppEpochPlan(
  publicClient: PublicClient,
  appContractAddress: Address,
): Promise<AppEpochPlan> {
  const chainId = await resolveChainId(publicClient);
  // Without a reliable chain identity the verdict must not be shared across
  // clients: an "unknown" bucket would leak verdicts across networks.
  const cacheable = chainId !== undefined;
  const cacheKey = generationCacheKey(chainId, appContractAddress);

  const cached = cacheable ? generationCache.get(cacheKey) : undefined;
  let generation =
    cached && (cached.generation === "epoch" || cached.expiresAt > Date.now())
      ? cached.generation
      : undefined;
  if (generation === undefined) {
    generation = await probeGeneration(publicClient, appContractAddress);
    if (cacheable) {
      generationCache.set(cacheKey, {
        generation,
        expiresAt: Date.now() + LEGACY_VERDICT_TTL_MS,
      });
    }
  }

  if (generation === "legacy") return { kind: "legacy" };

  return {
    kind: "epoch",
    currentAppEpoch: await readCurrentAppEpoch(publicClient, appContractAddress),
  };
}

function requireWritableEpoch(
  epoch: number,
  currentAppEpoch: number,
  contractAddress: Address,
): void {
  if (!Number.isInteger(epoch) || epoch < 0) {
    throw new Error(`Epoch must be a non-negative integer, received ${epoch}`);
  }
  if (epoch > currentAppEpoch + 1) {
    throw new Error(
      `Epoch ${epoch} is not writable on contract ${contractAddress}: ` +
        `the writable range is 0..${currentAppEpoch + 1} (currentAppEpoch is ${currentAppEpoch})`,
    );
  }
}

/**
 * Decide how to write an allowlist value.
 *
 * - legacy contract — the epoch-less setter; an explicit `epoch` is an error
 *   because the contract cannot express it;
 * - epoch-aware contract with `epoch` — write exactly that epoch;
 * - epoch-aware contract without `epoch` — additions write
 *   `[currentAppEpoch, currentAppEpoch + 1]` (the contract caps writes at
 *   `currentAppEpoch + 1`), removals write `[0, currentAppEpoch + 1]` because
 *   the contract still authorizes every epoch ≤ current, so skipping history
 *   would leave the revoked value fetchable at older epochs.
 *
 * The plan is computed from a `currentAppEpoch` read taken before signing. An
 * `advanceAppEpoch` landing between the read and execution is not detectable
 * on-chain (historical epochs stay writable), so the guarantee is "current
 * and next as of planning time", not as of execution.
 */
export async function resolveAppEpochWritePlan(
  publicClient: PublicClient,
  appContractAddress: Address,
  requestedEpoch?: number,
  change: "add" | "remove" = "add",
): Promise<AppEpochWritePlan> {
  const plan = await resolveAppEpochPlan(publicClient, appContractAddress);

  if (plan.kind === "legacy") {
    if (requestedEpoch !== undefined) {
      throw new Error(
        `Contract ${appContractAddress} does not support app epochs; ` +
          `omit 'epoch' to use the epoch-less setter`,
      );
    }
    return { kind: "legacy" };
  }

  if (requestedEpoch === undefined) {
    return {
      kind: "epochs",
      fromEpoch: change === "remove" ? 0 : plan.currentAppEpoch,
      toEpoch: plan.currentAppEpoch + 1,
    };
  }

  requireWritableEpoch(requestedEpoch, plan.currentAppEpoch, appContractAddress);
  return { kind: "epoch", epoch: requestedEpoch };
}

/** The epoch rows a write plan touches, for result metadata. */
export function epochsWritten(plan: AppEpochWritePlan): EpochsWritten | undefined {
  switch (plan.kind) {
    case "legacy":
      return undefined;
    case "epoch":
      return [plan.epoch, plan.epoch];
    case "epochs":
      return [plan.fromEpoch, plan.toEpoch];
  }
}

/** Write a device row through the generation-appropriate setter. */
export async function writeDeviceAllowlist(
  context: AppPolicyWriteContext,
  change: "add" | "remove",
  plan: AppEpochWritePlan,
  deviceId: Hex,
): Promise<Hash> {
  const { walletClient, address, account, chain } = context;
  const common = { address, abi: dstackAppAbi, account, chain } as const;

  if (change === "add") {
    switch (plan.kind) {
      case "legacy":
        return walletClient.writeContract({
          ...common,
          functionName: "addDevice",
          args: [deviceId],
        });
      case "epoch":
        return walletClient.writeContract({
          ...common,
          functionName: "addDeviceAtEpoch",
          args: [BigInt(plan.epoch), deviceId],
        });
      case "epochs":
        return walletClient.writeContract({
          ...common,
          functionName: "addDeviceAtEpochs",
          args: [BigInt(plan.fromEpoch), BigInt(plan.toEpoch), deviceId],
        });
    }
  }

  switch (plan.kind) {
    case "legacy":
      return walletClient.writeContract({
        ...common,
        functionName: "removeDevice",
        args: [deviceId],
      });
    case "epoch":
      return walletClient.writeContract({
        ...common,
        functionName: "removeDeviceAtEpoch",
        args: [BigInt(plan.epoch), deviceId],
      });
    case "epochs":
      return walletClient.writeContract({
        ...common,
        functionName: "removeDeviceAtEpochs",
        args: [BigInt(plan.fromEpoch), BigInt(plan.toEpoch), deviceId],
      });
  }
}

/** Write a compose-hash row through the generation-appropriate setter. */
export async function writeComposeHashAllowlist(
  context: AppPolicyWriteContext,
  change: "add" | "remove",
  plan: AppEpochWritePlan,
  composeHash: Hex,
): Promise<Hash> {
  const { walletClient, address, account, chain } = context;
  const common = { address, abi: dstackAppAbi, account, chain } as const;

  if (change === "add") {
    switch (plan.kind) {
      case "legacy":
        return walletClient.writeContract({
          ...common,
          functionName: "addComposeHash",
          args: [composeHash],
        });
      case "epoch":
        return walletClient.writeContract({
          ...common,
          functionName: "addComposeHashAtEpoch",
          args: [BigInt(plan.epoch), composeHash],
        });
      case "epochs":
        return walletClient.writeContract({
          ...common,
          functionName: "addComposeHashAtEpochs",
          args: [BigInt(plan.fromEpoch), BigInt(plan.toEpoch), composeHash],
        });
    }
  }

  switch (plan.kind) {
    case "legacy":
      return walletClient.writeContract({
        ...common,
        functionName: "removeComposeHash",
        args: [composeHash],
      });
    case "epoch":
      return walletClient.writeContract({
        ...common,
        functionName: "removeComposeHashAtEpoch",
        args: [BigInt(plan.epoch), composeHash],
      });
    case "epochs":
      return walletClient.writeContract({
        ...common,
        functionName: "removeComposeHashAtEpochs",
        args: [BigInt(plan.fromEpoch), BigInt(plan.toEpoch), composeHash],
      });
  }
}
