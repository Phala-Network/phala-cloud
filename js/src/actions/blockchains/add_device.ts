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

/**
 * Add a device to a DstackApp contract's allowlist.
 *
 * @group Actions
 * @since 0.6.0
 *
 * ## Usage
 *
 * ```typescript
 * import { addDevice } from '@phala/cloud'
 * import { base } from 'viem/chains'
 *
 * // Mode 1: Using private key
 * const result = await addDevice({
 *   chain: base,
 *   appAddress: "0x1234...abcd",
 *   deviceId: "0xaabbccdd...",
 *   privateKey: "0x...",
 * })
 *
 * // Mode 2: Using custom wallet client
 * const result2 = await addDevice({
 *   appAddress: "0x1234...abcd",
 *   deviceId: "0xaabbccdd...",
 *   walletClient: myWallet,
 *   publicClient: myPublicClient,
 * })
 * ```
 */

// ── Request ────────────────────────────────────────────────────────

const AddDeviceRequestSchema = z
  .object({
    chain: z.unknown().optional(),
    rpcUrl: z.string().optional(),
    appAddress: z.string(),
    deviceId: z.string(),
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

export type AddDeviceRequest = {
  chain?: Chain;
  rpcUrl?: string;
  appAddress: Address;
  deviceId: string;
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

export const AddDeviceSchema = z
  .object({
    appAddress: z.string(),
    deviceId: z.string(),
    transactionHash: z.string(),
    blockNumber: z.bigint().optional(),
    gasUsed: z.bigint().optional(),
  })
  .passthrough();

export type AddDevice = z.infer<typeof AddDeviceSchema>;

export type AddDeviceParameters<T = undefined> = T extends z.ZodTypeAny
  ? { schema: T }
  : T extends false
    ? { schema: false }
    : { schema?: z.ZodTypeAny | false };

export type AddDeviceReturnType<T = undefined> = T extends z.ZodTypeAny
  ? z.infer<T>
  : T extends false
    ? unknown
    : AddDevice;

// ── Implementation ─────────────────────────────────────────────────

export async function addDevice<T extends z.ZodTypeAny | false | undefined = undefined>(
  request: AddDeviceRequest,
  parameters?: AddDeviceParameters<T>,
): Promise<AddDeviceReturnType<T>> {
  const validatedRequest = AddDeviceRequestSchema.parse(request);

  const {
    chain,
    rpcUrl,
    appAddress,
    deviceId,
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

  // Create or use provided clients
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

  const addDeviceOperation = async (clients: NetworkClients): Promise<Hash> => {
    return clients.walletClient.writeContract({
      address: contractAddress,
      abi: dstackAppAbi,
      functionName: "addDevice",
      args: [deviceIdHex],
      account: clients.walletClient.account || clients.address,
      chain: (chain as Chain) || null,
    });
  };

  const transactionResult = retryOptions
    ? await executeTransactionWithRetry(
        addDeviceOperation,
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
    : await transactionTracker.execute(addDeviceOperation, networkClients, [], {
        timeout: timeout as number,
        confirmations: 1,
        onSubmitted: onTransactionSubmitted,
        onConfirmed: onTransactionConfirmed,
        signal,
      } as TransactionOptions & { signal?: AbortSignal });

  const result: AddDevice = {
    appAddress: contractAddress,
    deviceId: deviceIdHex as string,
    transactionHash: transactionResult.receipt.transactionHash,
    blockNumber: transactionResult.receipt.blockNumber,
    gasUsed: transactionResult.receipt.gasUsed,
  };

  if (parameters?.schema === false) {
    return result as AddDeviceReturnType<T>;
  }
  const schema = (parameters?.schema || AddDeviceSchema) as z.ZodTypeAny;
  return schema.parse(result) as AddDeviceReturnType<T>;
}

// ── Safe variant ───────────────────────────────────────────────────

export type SafeAddDeviceResult<T = undefined> =
  | { success: true; data: AddDeviceReturnType<T> }
  | {
      success: false;
      error: { isRequestError: true; message: string; status: number; detail: string };
    };

export async function safeAddDevice<T extends z.ZodTypeAny | false | undefined = undefined>(
  request: AddDeviceRequest,
  parameters?: AddDeviceParameters<T>,
): Promise<SafeAddDeviceResult<T>> {
  try {
    const result = await addDevice(request, parameters);
    return { success: true, data: result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown blockchain error";
    return {
      success: false,
      error: { isRequestError: true, message: errorMessage, status: 500, detail: errorMessage },
    };
  }
}
