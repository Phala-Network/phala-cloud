import { z } from "zod";
import { callbackSchema } from "../../types/common";
import {
  type Chain,
  type Address,
  type Hash,
  type Hex,
  type TransactionReceipt,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  asHex,
  type NetworkClients,
  validateNetworkPrerequisites,
  type TransactionTracker,
  createTransactionTracker,
  type RetryOptions,
  executeTransactionWithRetry,
  type TransactionOptions,
} from "../../utils";
import { dstackAppAbi } from "./abi/dstack_app";
import {
  type EpochsWritten,
  EpochsWrittenSchema,
  epochsWritten,
  resolveAppEpochWritePlan,
  writeDeviceAllowlist,
} from "./epoch_compat";

/**
 * Remove a device from a DstackApp contract's allowlist.
 *
 * @group Actions
 * @since 0.6.0
 *
 * ## Usage
 *
 * ```typescript
 * import { removeDevice } from '@phala/cloud'
 * import { base } from 'viem/chains'
 *
 * const result = await removeDevice({
 *   chain: base,
 *   appAddress: "0x1234...abcd",
 *   deviceId: "0xaabbccdd...",
 *   privateKey: "0x...",
 * })
 * ```
 *
 * ## Epoch handling
 *
 * The contract generation is probed before writing. On a contract without app
 * epochs the epoch-less `removeDevice` setter is used and `epoch` must be
 * omitted. On an epoch-aware contract, `epoch` pins the write to that epoch, and
 * an omitted `epoch` writes `[currentAppEpoch, currentAppEpoch + 1]` because
 * allowlist rows are not inherited across epochs. The written rows are reported
 * as `epochsWritten`.
 */

// ── Request ────────────────────────────────────────────────────────

const RemoveDeviceRequestSchema = z
  .object({
    chain: z.unknown().optional(),
    rpcUrl: z.string().optional(),
    appAddress: z.string(),
    deviceId: z.string(),
    epoch: z.number().int().optional(),
    privateKey: z.string().optional(),
    walletClient: z.unknown().optional(),
    publicClient: z.unknown().optional(),
    skipPrerequisiteChecks: z.boolean().optional().default(false),
    minBalance: z.string().optional(),
    timeout: z.number().optional().default(120000),
    retryOptions: z.unknown().optional(),
    signal: z.unknown().optional(),
    onTransactionStateChange: callbackSchema.optional(),
    onTransactionSubmitted: callbackSchema.optional(),
    onTransactionConfirmed: callbackSchema.optional(),
  })
  .passthrough()
  .refine((data) => !!data.privateKey !== !!data.walletClient, {
    message: "Either 'privateKey' or 'walletClient' must be provided, but not both",
    path: ["privateKey", "walletClient"],
  })
  .refine(
    (data) => {
      if (!!data.publicClient && !!data.walletClient) return true;
      return !!data.chain;
    },
    {
      message: "Chain is required when publicClient or walletClient is not provided",
      path: ["chain"],
    },
  );

export type RemoveDeviceRequest = {
  chain?: Chain;
  rpcUrl?: string;
  appAddress: Address;
  deviceId: string;
  /**
   * App epoch to write, on epoch-aware contracts. Omit to write
   * `[currentAppEpoch, currentAppEpoch + 1]`. Unsupported (and rejected) on
   * contracts that predate app epochs.
   */
  epoch?: number;
  privateKey?: Hex;
  walletClient?: WalletClient;
  publicClient?: PublicClient;
  skipPrerequisiteChecks?: boolean;
  minBalance?: string;
  timeout?: number;
  retryOptions?: RetryOptions;
  signal?: AbortSignal;
  onTransactionStateChange?: (state: TransactionTracker["status"]) => void;
  onTransactionSubmitted?: (hash: Hash) => void;
  onTransactionConfirmed?: (receipt: TransactionReceipt) => void;
};

// ── Response ───────────────────────────────────────────────────────

export const RemoveDeviceSchema = z
  .object({
    appAddress: z.string(),
    deviceId: z.string(),
    transactionHash: z.string(),
    blockNumber: z.bigint().optional(),
    gasUsed: z.bigint().optional(),
    /** Epoch rows written, absent when the contract has no app epochs. */
    epochsWritten: EpochsWrittenSchema.optional(),
  })
  .passthrough();

export type RemoveDevice = z.infer<typeof RemoveDeviceSchema>;

export type RemoveDeviceParameters<T = undefined> = T extends z.ZodTypeAny
  ? { schema: T }
  : T extends false
    ? { schema: false }
    : { schema?: z.ZodTypeAny | false };

export type RemoveDeviceReturnType<T = undefined> = T extends z.ZodTypeAny
  ? z.infer<T>
  : T extends false
    ? unknown
    : RemoveDevice;

// ── Implementation ─────────────────────────────────────────────────

export async function removeDevice<T extends z.ZodTypeAny | false | undefined = undefined>(
  request: RemoveDeviceRequest,
  parameters?: RemoveDeviceParameters<T>,
): Promise<RemoveDeviceReturnType<T>> {
  const validatedRequest = RemoveDeviceRequestSchema.parse(request);

  const {
    chain,
    rpcUrl,
    appAddress,
    deviceId,
    epoch,
    privateKey,
    walletClient: providedWalletClient,
    publicClient: providedPublicClient,
    timeout = 120000,
    retryOptions,
    signal,
    onTransactionStateChange,
    onTransactionSubmitted,
    onTransactionConfirmed,
    skipPrerequisiteChecks = false,
    minBalance,
  } = validatedRequest;

  const contractAddress = (appAddress.startsWith("0x") ? appAddress : `0x${appAddress}`) as Address;
  const deviceIdHex = asHex(deviceId);

  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let address: Address;
  let chainId: number;

  if (privateKey) {
    const account = privateKeyToAccount(privateKey as Hex);
    const transport = http(rpcUrl, { timeout: timeout as number });
    publicClient = providedPublicClient
      ? (providedPublicClient as PublicClient)
      : createPublicClient({ chain: chain as Chain, transport });
    walletClient = createWalletClient({
      account,
      chain: chain as Chain,
      transport,
    });
    address = account.address;
    chainId = (chain as Chain).id;
  } else if (providedWalletClient) {
    walletClient = providedWalletClient as WalletClient;
    publicClient = providedPublicClient
      ? (providedPublicClient as PublicClient)
      : createPublicClient({
          chain: chain as Chain,
          transport: http(rpcUrl, { timeout: timeout as number }),
        });
    if (!walletClient.account?.address) {
      throw new Error("WalletClient must have an account with address");
    }
    address = walletClient.account.address;
    chainId = chain ? (chain as Chain).id : await walletClient.getChainId();
  } else {
    throw new Error("Either privateKey or walletClient must be provided");
  }

  const networkClients: NetworkClients = { publicClient, walletClient, address, chainId };
  const transactionTracker = createTransactionTracker();

  if (onTransactionStateChange && typeof onTransactionStateChange === "function") {
    const pollStatus = (): void => {
      onTransactionStateChange(transactionTracker.status);
      if (!transactionTracker.isComplete) {
        setTimeout(pollStatus, 100);
      }
    };
    setTimeout(pollStatus, 10);
  }

  if (!skipPrerequisiteChecks) {
    const requirements = {
      targetChainId: chainId,
      minBalance: minBalance ? parseEther(minBalance) : parseEther("0.001"),
    };
    const validation = await validateNetworkPrerequisites(networkClients, requirements);
    if (!validation.networkValid) {
      throw new Error(
        `Network mismatch: Expected chain ${requirements.targetChainId}, but wallet is on chain ${validation.details.currentChainId}`,
      );
    }
    if (!validation.balanceValid) {
      const requiredEth = Number(requirements.minBalance) / 1e18;
      const currentEth = Number(validation.details.balance) / 1e18;
      throw new Error(
        `Insufficient balance: Required ${requiredEth} ETH, but account has ${currentEth.toFixed(6)} ETH`,
      );
    }
  }

  // Resolve the contract generation and, on epoch-aware contracts, the rows to write
  const writePlan = await resolveAppEpochWritePlan(publicClient, contractAddress, epoch);
  const writtenEpochs: EpochsWritten | undefined = epochsWritten(writePlan);

  const removeDeviceOperation = async (clients: NetworkClients): Promise<Hash> => {
    return writeDeviceAllowlist(
      {
        walletClient: clients.walletClient,
        address: contractAddress,
        account: clients.walletClient.account || clients.address,
        chain: (chain as Chain) || null,
      },
      "remove",
      writePlan,
      deviceIdHex,
    );
  };

  const transactionResult = retryOptions
    ? await executeTransactionWithRetry(
        removeDeviceOperation,
        networkClients,
        [],
        {
          timeout: timeout as number,
          confirmations: 1,
          onSubmitted: onTransactionSubmitted,
          onConfirmed: onTransactionConfirmed,
          signal,
        } as TransactionOptions & { signal?: AbortSignal },
        retryOptions,
      )
    : await transactionTracker.execute(removeDeviceOperation, networkClients, [], {
        timeout: timeout as number,
        confirmations: 1,
        onSubmitted: onTransactionSubmitted,
        onConfirmed: onTransactionConfirmed,
        signal,
      } as TransactionOptions & { signal?: AbortSignal });

  const result: RemoveDevice = {
    appAddress: contractAddress,
    deviceId: deviceIdHex as string,
    transactionHash: transactionResult.receipt.transactionHash,
    blockNumber: transactionResult.receipt.blockNumber,
    gasUsed: transactionResult.receipt.gasUsed,
    epochsWritten: writtenEpochs,
  };

  if (parameters?.schema === false) {
    return result as RemoveDeviceReturnType<T>;
  }
  const schema = (parameters?.schema || RemoveDeviceSchema) as z.ZodTypeAny;
  return schema.parse(result) as RemoveDeviceReturnType<T>;
}

// ── Safe variant ───────────────────────────────────────────────────

export type SafeRemoveDeviceResult<T = undefined> =
  | { success: true; data: RemoveDeviceReturnType<T> }
  | {
      success: false;
      error: { isRequestError: true; message: string; status: number; detail: string };
    };

export async function safeRemoveDevice<T extends z.ZodTypeAny | false | undefined = undefined>(
  request: RemoveDeviceRequest,
  parameters?: RemoveDeviceParameters<T>,
): Promise<SafeRemoveDeviceResult<T>> {
  try {
    const result = await removeDevice(request, parameters);
    return { success: true, data: result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown blockchain error";
    return {
      success: false,
      error: { isRequestError: true, message: errorMessage, status: 500, detail: errorMessage },
    };
  }
}
