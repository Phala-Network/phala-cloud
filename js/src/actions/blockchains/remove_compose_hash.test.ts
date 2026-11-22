import { expect, it, vi } from "vitest";
import type { Address, Hash, Hex, PublicClient, TransactionReceipt, WalletClient } from "viem";
import { base, mainnet } from "viem/chains";
import { z } from "zod";
import {
  type RemoveComposeHashRequest,
  removeComposeHash,
  safeRemoveComposeHash,
} from "./remove_compose_hash";

const APP_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
const LEGACY_APP_ADDRESS = "0x1234567890abcdef1234567890abcdef12345679";
const OWNER = "0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb";
const COMPOSE_HASH = "ab".repeat(32);
const COMPOSE_HASH_HEX = `0x${COMPOSE_HASH}`;
const TX_HASH: Hash = `0x${"34".repeat(32)}`;

type FixtureOptions = {
  currentEpoch?: bigint | null;
  owner?: Address;
  ownerCode?: Hex;
  walletChainId?: number;
  receiptStatus?: TransactionReceipt["status"];
};

function clients({
  currentEpoch = 3n,
  owner = OWNER,
  ownerCode,
  walletChainId = base.id,
  receiptStatus = "success",
}: FixtureOptions = {}) {
  const receipt = {
    transactionHash: TX_HASH,
    status: receiptStatus,
    blockNumber: 1234567n,
    gasUsed: 22000n,
  } as TransactionReceipt;
  const writeContract = vi.fn().mockResolvedValue(TX_HASH);
  const walletClient = {
    account: { address: OWNER },
    chain: base,
    getChainId: vi.fn().mockResolvedValue(walletChainId),
    writeContract,
  } as unknown as WalletClient;
  const publicClient = {
    chain: base,
    getChainId: vi.fn().mockResolvedValue(base.id),
    readContract: vi.fn(
      async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
        switch (functionName) {
          case "owner":
            return owner;
          case "supportsInterface":
            return args?.[0] === (currentEpoch === null ? "0x8fd37527" : "0x8c0524c4");
          case "currentAppEpoch":
            if (currentEpoch !== null) return currentEpoch;
            throw new Error("Legacy contracts do not have app epochs");
          default:
            throw new Error(`Unexpected contract call: ${functionName}`);
        }
      },
    ),
    getCode: vi.fn().mockResolvedValue(ownerCode),
    getTransactionReceipt: vi.fn().mockResolvedValue(receipt),
  } as unknown as PublicClient;
  const request: RemoveComposeHashRequest = {
    appAddress: currentEpoch === null ? LEGACY_APP_ADDRESS : APP_ADDRESS,
    composeHash: COMPOSE_HASH,
    walletClient,
    publicClient,
  };
  return { request, writeContract, receipt };
}

it("revokes the compose hash at every writable epoch, including history and the next epoch", async () => {
  const { request, writeContract } = clients();

  await expect(removeComposeHash(request)).resolves.toMatchObject({
    appAddress: APP_ADDRESS,
    composeHash: COMPOSE_HASH_HEX,
    transactionHash: TX_HASH,
    blockNumber: 1234567n,
    gasUsed: 22000n,
    epochsWritten: [0, 4],
  });
  expect(writeContract).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      address: APP_ADDRESS,
      account: expect.objectContaining({ address: OWNER }),
      chain: base,
      functionName: "removeComposeHashAtEpochs",
      args: [0n, 4n, COMPOSE_HASH_HEX],
    }),
  );
});

it.each([
  [0, 0n],
  [4, 4n],
])("revokes only epoch %i when it is requested explicitly", async (epoch, expectedEpoch) => {
  const { request, writeContract } = clients();

  const result = await removeComposeHash({ ...request, epoch });

  expect(result.epochsWritten).toEqual([epoch, epoch]);
  expect(writeContract).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      functionName: "removeComposeHashAtEpoch",
      args: [expectedEpoch, COMPOSE_HASH_HEX],
    }),
  );
});

it.each([
  [-1, ">=0"],
  [1.5, "expected int"],
  [5, "writable range is 0..4"],
])("rejects an unwritable epoch (%s) before signing", async (epoch, message) => {
  const { request, writeContract } = clients();

  await expect(removeComposeHash({ ...request, epoch })).rejects.toThrow(message);

  expect(writeContract).not.toHaveBeenCalled();
});

it("uses the single-entry remove method on older contracts", async () => {
  const { request, writeContract } = clients({ currentEpoch: null });

  const result = await removeComposeHash({ ...request, composeHash: COMPOSE_HASH_HEX });

  expect(result).not.toHaveProperty("epochsWritten");
  expect(writeContract).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      functionName: "removeComposeHash",
      args: [COMPOSE_HASH_HEX],
    }),
  );
});

it("does not silently ignore an explicit epoch on an older contract", async () => {
  const { request, writeContract } = clients({ currentEpoch: null });

  await expect(removeComposeHash({ ...request, epoch: 0 })).rejects.toThrow(
    "does not support app epochs",
  );

  expect(writeContract).not.toHaveBeenCalled();
});

it("refuses to sign when the connected wallet does not own the app contract", async () => {
  const { request, writeContract } = clients({
    owner: "0x2222222222222222222222222222222222222222",
  });

  await expect(removeComposeHash(request)).rejects.toThrow("is not the owner");

  expect(writeContract).not.toHaveBeenCalled();
});

it("refuses to send a revocation through a contract wallet", async () => {
  const { request, writeContract } = clients({ ownerCode: "0x60806040" });

  await expect(removeComposeHash(request)).rejects.toThrow("Contract wallets are not supported");

  expect(writeContract).not.toHaveBeenCalled();
});

it("does not use owner information from a different chain than the signing wallet", async () => {
  const { request, writeContract } = clients({ walletChainId: mainnet.id });

  await expect(removeComposeHash(request)).rejects.toThrow("must use the same chain");

  expect(writeContract).not.toHaveBeenCalled();
});

it("does not sign a transaction for a malformed compose hash", async () => {
  const { request, writeContract } = clients();

  await expect(removeComposeHash({ ...request, composeHash: "abc" })).rejects.toThrow(
    "Expected a 32-byte compose hash",
  );

  expect(writeContract).not.toHaveBeenCalled();
});

it("returns a successful receipt through the safe wrapper, honoring a custom response schema", async () => {
  const { request, receipt } = clients();
  const onTransactionSubmitted = vi.fn();
  const onTransactionConfirmed = vi.fn();
  const schema = z
    .object({ transactionHash: z.string() })
    .transform((result) => result.transactionHash);

  await expect(
    safeRemoveComposeHash(
      { ...request, onTransactionSubmitted, onTransactionConfirmed },
      { schema },
    ),
  ).resolves.toEqual({ success: true, data: TX_HASH });
  expect(onTransactionSubmitted).toHaveBeenCalledExactlyOnceWith(TX_HASH);
  expect(onTransactionConfirmed).toHaveBeenCalledExactlyOnceWith(receipt);
});

it("reports a reverted transaction as an error without resubmitting it", async () => {
  const { request, writeContract } = clients({ receiptStatus: "reverted" });

  await expect(safeRemoveComposeHash(request)).resolves.toMatchObject({
    success: false,
    error: { isRequestError: true, message: "Transaction failed on-chain" },
  });
  expect(writeContract).toHaveBeenCalledTimes(1);
});
