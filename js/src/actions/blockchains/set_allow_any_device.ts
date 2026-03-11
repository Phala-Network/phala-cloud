import { z } from "zod";
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
  type NetworkClients,
  validateNetworkPrerequisites,
  type TransactionTracker,
  createTransactionTracker,
  type RetryOptions,
  executeTransactionWithRetry,
  type TransactionOptions,
} from "../../utils";
import { dstackAppAbi } from "./abi/dstack_app";

/**
 * Toggle the "allow any device" flag on a DstackApp contract.
 *
 * @group Actions
 * @since 0.6.0
 *
 * ## Usage
 *
 * ```typescript
 * import { setAllowAnyDevice } from '@phala/cloud'
 * import { base } from 'viem/chains'
 *
 * const result = await setAllowAnyDevice({
 *   chain: base,
 *   appAddress: "0x1234...abcd",
 *   allow: true,
 *   privateKey: "0x...",
 * })
 * ```
 */

// ── Request ────────────────────────────────────────────────────────

const SetAllowAnyDeviceRequestSchema = z
  .object({
    chain: z.unknown().optional(),
    rpcUrl: z.string().optional(),
    appAddress: z.string(),
    allow: z.boolean(),
    privateKey: z.string().optional(),
    walletClient: z.unknown().optional(),
    publicClient: z.unknown().optional(),
    skipPrerequisiteChecks: z.boolean().optional().default(false),
    minBalance: z.string().optional(),
    timeout: z.number().optional().default(120000),
    retryOptions: z.unknown().optional(),
    signal: z.unknown().optional(),
    onTransactionStateChange: z.function().optional(),
    onTransactionSubmitted: z.function().optional(),
    onTransactionConfirmed: z.function().optional(),
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

export type SetAllowAnyDeviceRequest = {
  chain?: Chain;
  rpcUrl?: string;
  appAddress: Address;
  allow: boolean;
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

export const SetAllowAnyDeviceSchema = z
  .object({
    appAddress: z.string(),
    allow: z.boolean(),
    transactionHash: z.string(),
    blockNumber: z.bigint().optional(),
    gasUsed: z.bigint().optional(),
  })
  .passthrough();

export type SetAllowAnyDevice = z.infer<typeof SetAllowAnyDeviceSchema>;

export type SetAllowAnyDeviceParameters<T = undefined> = T extends z.ZodTypeAny
  ? { schema: T }
  : T extends false
    ? { schema: false }
    : { schema?: z.ZodTypeAny | false };

export type SetAllowAnyDeviceReturnType<T = undefined> = T extends z.ZodTypeAny
  ? z.infer<T>
  : T extends false
    ? unknown
    : SetAllowAnyDevice;

// ── Implementation ─────────────────────────────────────────────────

export async function setAllowAnyDevice<T extends z.ZodTypeAny | false | undefined = undefined>(
  request: SetAllowAnyDeviceRequest,
  parameters?: SetAllowAnyDeviceParameters<T>,
): Promise<SetAllowAnyDeviceReturnType<T>> {
  const validatedRequest = SetAllowAnyDeviceRequestSchema.parse(request);

  const {
    chain,
    rpcUrl,
    appAddress,
    allow,
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

  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let address: Address;
  let chainId: number;

  if (privateKey) {
    const account = privateKeyToAccount(privateKey as Hex);
    publicClient = providedPublicClient
      ? (providedPublicClient as PublicClient)
      : createPublicClient({ chain: chain as Chain, transport: http(rpcUrl) });
    walletClient = createWalletClient({
      account,
      chain: chain as Chain,
      transport: http(rpcUrl),
    });
    address = account.address;
    chainId = (chain as Chain).id;
  } else if (providedWalletClient) {
    walletClient = providedWalletClient as WalletClient;
    publicClient = providedPublicClient
      ? (providedPublicClient as PublicClient)
      : createPublicClient({ chain: chain as Chain, transport: http(rpcUrl) });
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

  const setAllowAnyOperation = async (clients: NetworkClients): Promise<Hash> => {
    return clients.walletClient.writeContract({
      address: contractAddress,
      abi: dstackAppAbi,
      functionName: "setAllowAnyDevice",
      args: [allow as boolean],
      account: clients.walletClient.account || clients.address,
      chain: (chain as Chain) || null,
    });
  };

  const transactionResult = retryOptions
    ? await executeTransactionWithRetry(
        setAllowAnyOperation,
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
    : await transactionTracker.execute(setAllowAnyOperation, networkClients, [], {
        timeout: timeout as number,
        confirmations: 1,
        onSubmitted: onTransactionSubmitted,
        onConfirmed: onTransactionConfirmed,
        signal,
      } as TransactionOptions & { signal?: AbortSignal });

  const result: SetAllowAnyDevice = {
    appAddress: contractAddress,
    allow: allow as boolean,
    transactionHash: transactionResult.receipt.transactionHash,
    blockNumber: transactionResult.receipt.blockNumber,
    gasUsed: transactionResult.receipt.gasUsed,
  };

  if (parameters?.schema === false) {
    return result as SetAllowAnyDeviceReturnType<T>;
  }
  const schema = (parameters?.schema || SetAllowAnyDeviceSchema) as z.ZodTypeAny;
  return schema.parse(result) as SetAllowAnyDeviceReturnType<T>;
}

// ── Safe variant ───────────────────────────────────────────────────

export type SafeSetAllowAnyDeviceResult<T = undefined> =
  | { success: true; data: SetAllowAnyDeviceReturnType<T> }
  | {
      success: false;
      error: { isRequestError: true; message: string; status: number; detail: string };
    };

export async function safeSetAllowAnyDevice<T extends z.ZodTypeAny | false | undefined = undefined>(
  request: SetAllowAnyDeviceRequest,
  parameters?: SetAllowAnyDeviceParameters<T>,
): Promise<SafeSetAllowAnyDeviceResult<T>> {
  try {
    const result = await setAllowAnyDevice(request, parameters);
    return { success: true, data: result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown blockchain error";
    return {
      success: false,
      error: { isRequestError: true, message: errorMessage, status: 500, detail: errorMessage },
    };
  }
}
