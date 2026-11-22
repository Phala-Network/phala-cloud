import {
  http,
  type Address,
  type Chain,
  type Hash,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  isAddress,
  isAddressEqual,
  zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { callbackSchema } from "../../types/common";
import { type NetworkClients, asHex, createTransactionTracker } from "../../utils";
import { dstackAppAbi } from "./abi/dstack_app";
import {
  EpochsWrittenSchema,
  epochsWritten,
  resolveAppEpochWritePlan,
  writeComposeHashAllowlist,
} from "./epoch_compat";

const RemoveComposeHashRequestSchema = z.object({
  appAddress: z.custom<Address>(
    (value) => typeof value === "string" && isAddress(value, { strict: false }),
    "Invalid app contract address",
  ),
  composeHash: z.string().regex(/^(?:0x)?[0-9a-fA-F]{64}$/, "Expected a 32-byte compose hash"),
  epoch: z.number().int().nonnegative().optional(),
  timeout: z.number().int().positive().default(120000),
  onTransactionSubmitted: callbackSchema.optional(),
  onTransactionConfirmed: callbackSchema.optional(),
});

export type RemoveComposeHashRequest = {
  /** Chain configuration. Required when the SDK creates either client. */
  chain?: Chain;
  rpcUrl?: string;
  /** Address of the app's authorization contract. */
  appAddress: Address;
  /** 32-byte hex string, with or without the 0x prefix. */
  composeHash: string;
  /**
   * Revoke only this epoch, between 0 and the current app epoch plus one.
   * Omit to revoke that entire range. Older contracts do not accept an epoch.
   */
  epoch?: number;
  /** The app owner's private key. Set either this or `walletClient`, not both. */
  privateKey?: Hex;
  /** A wallet client with the app owner's account. Wallets with deployed code are not supported. */
  walletClient?: WalletClient;
  publicClient?: PublicClient;
  /** Time to wait for a receipt, in milliseconds. Defaults to 120,000. */
  timeout?: number;
  /** Stops waiting but does not cancel a transaction that has already been sent. */
  signal?: AbortSignal;
  onTransactionSubmitted?: (hash: Hash) => void;
  onTransactionConfirmed?: (receipt: TransactionReceipt) => void;
};

export const RemoveComposeHashSchema = z.object({
  appAddress: z.string(),
  composeHash: z.string(),
  transactionHash: z.string(),
  blockNumber: z.bigint(),
  gasUsed: z.bigint(),
  /** Inclusive range of epochs revoked. Omitted for contracts without app epochs. */
  epochsWritten: EpochsWrittenSchema.optional(),
});

export type RemoveComposeHash = z.infer<typeof RemoveComposeHashSchema>;

export type RemoveComposeHashParameters<T = undefined> = T extends z.ZodTypeAny
  ? { schema: T }
  : T extends false
    ? { schema: false }
    : { schema?: z.ZodTypeAny | false };

export type RemoveComposeHashReturnType<T = undefined> = T extends z.ZodTypeAny
  ? z.infer<T>
  : T extends false
    ? unknown
    : RemoveComposeHash;

/**
 * Revoke an allowed compose hash with a transaction signed by the app owner's wallet.
 * This is a new on-chain change, not an undo. It cannot take back keys already released.
 *
 * Revoke only a hash that no CVM or pending update uses. A CVM that uses the hash
 * can be denied keys when it starts again. Phala Cloud's list of unused registered
 * hashes is a snapshot. This action does not check usage or change any CVM or draft.
 *
 * By default, the transaction revokes the hash from epoch zero through the next
 * app epoch as of the pre-signing check. Revoking just one epoch can leave the hash
 * allowed in others. On older contracts, the transaction removes the single entry.
 *
 * This action waits for a successful transaction receipt, not for finality.
 * The KMS may continue to allow the hash until it reads the block with the revocation.
 * Keep the hash from `onTransactionSubmitted` so you can track the transaction if waiting times out.
 *
 * @group Actions
 */
export async function removeComposeHash<T extends z.ZodTypeAny | false | undefined = undefined>(
  request: RemoveComposeHashRequest,
  parameters?: RemoveComposeHashParameters<T>,
): Promise<RemoveComposeHashReturnType<T>> {
  const {
    appAddress,
    composeHash,
    epoch,
    timeout,
    onTransactionSubmitted,
    onTransactionConfirmed,
  } = RemoveComposeHashRequestSchema.parse(request);
  const {
    chain,
    rpcUrl,
    privateKey,
    walletClient: providedWalletClient,
    publicClient: providedPublicClient,
    signal,
  } = request;

  if ((privateKey === undefined) === (providedWalletClient === undefined)) {
    throw new Error("Provide either 'privateKey' or 'walletClient', but not both.");
  }
  if (!chain && (!providedPublicClient || !providedWalletClient)) {
    throw new Error("Provide 'chain' when the SDK creates a public or wallet client.");
  }

  const account =
    privateKey === undefined ? providedWalletClient?.account : privateKeyToAccount(privateKey);
  if (!account || isAddressEqual(account.address, zeroAddress)) {
    throw new Error("The wallet client must have an account.");
  }

  const transport = http(rpcUrl, { timeout });
  const publicClient = providedPublicClient ?? createPublicClient({ chain, transport });
  const walletClient = providedWalletClient ?? createWalletClient({ account, chain, transport });
  const transactionChain = chain ?? walletClient.chain ?? publicClient.chain;
  const [walletChainId, publicChainId] = await Promise.all([
    walletClient.getChainId(),
    publicClient.getChainId(),
  ]);
  const chainId = transactionChain?.id ?? publicChainId;
  if (walletChainId !== chainId || publicChainId !== chainId) {
    throw new Error(
      `The wallet and public client must use the same chain. Expected chain ${chainId}, ` +
        `but the wallet is on ${walletChainId} and the public client is on ${publicChainId}.`,
    );
  }

  const owner = await publicClient.readContract({
    address: appAddress,
    abi: dstackAppAbi,
    functionName: "owner",
    blockTag: "latest",
  });
  if (!isAddressEqual(owner, account.address)) {
    throw new Error(`Wallet ${account.address} is not the owner of app contract ${appAddress}.`);
  }
  const ownerCode = await publicClient.getCode({ address: owner, blockTag: "latest" });
  if (ownerCode && ownerCode !== "0x") {
    throw new Error(
      "Contract wallets are not supported. This action requires an owner account without deployed code.",
    );
  }

  const writePlan = await resolveAppEpochWritePlan(publicClient, appAddress, epoch, "remove");
  const composeHashHex = asHex(composeHash);
  const networkClients: NetworkClients = {
    publicClient,
    walletClient,
    address: account.address,
    chainId,
  };
  const { receipt } = await createTransactionTracker().execute(
    (clients) =>
      writeComposeHashAllowlist(
        {
          walletClient: clients.walletClient,
          address: appAddress,
          account,
          chain: transactionChain ?? null,
        },
        "remove",
        writePlan,
        composeHashHex,
      ),
    networkClients,
    [],
    {
      timeout,
      confirmations: 1,
      signal,
      onSubmitted: onTransactionSubmitted,
      onConfirmed: onTransactionConfirmed,
    },
  );

  const writtenEpochs = epochsWritten(writePlan);
  const result: RemoveComposeHash = {
    appAddress,
    composeHash: composeHashHex,
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    ...(writtenEpochs ? { epochsWritten: writtenEpochs } : {}),
  };

  if (parameters?.schema === false) {
    return result as RemoveComposeHashReturnType<T>;
  }
  const schema = parameters?.schema ?? RemoveComposeHashSchema;
  return schema.parse(result) as RemoveComposeHashReturnType<T>;
}

export type SafeRemoveComposeHashResult<T = undefined> =
  | { success: true; data: RemoveComposeHashReturnType<T> }
  | {
      success: false;
      error: { isRequestError: true; message: string; status: number; detail: string };
    };

/** Revoke a compose hash and return errors instead of throwing them. */
export async function safeRemoveComposeHash<T extends z.ZodTypeAny | false | undefined = undefined>(
  request: RemoveComposeHashRequest,
  parameters?: RemoveComposeHashParameters<T>,
): Promise<SafeRemoveComposeHashResult<T>> {
  try {
    return { success: true, data: await removeComposeHash(request, parameters) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown blockchain error";
    return {
      success: false,
      error: { isRequestError: true, message, status: 500, detail: message },
    };
  }
}
