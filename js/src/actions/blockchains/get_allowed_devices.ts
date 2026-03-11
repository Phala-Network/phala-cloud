import { z } from "zod";
import {
  type Chain,
  type Address,
  type Hash,
  type PublicClient,
  createPublicClient,
  http,
} from "viem";
import { dstackAppAbi } from "./abi/dstack_app";

/**
 * Query the on-chain device allowlist for a DstackApp contract.
 *
 * Reconstructs the current device list by scanning DeviceAdded / DeviceRemoved
 * events and computing the diff.
 *
 * @group Actions
 * @since 0.6.0
 *
 * ## Usage
 *
 * ```typescript
 * import { getAllowedDevices } from '@phala/cloud'
 * import { base } from 'viem/chains'
 *
 * const result = await getAllowedDevices({
 *   chain: base,
 *   appAddress: "0x1234...abcd",
 * })
 * console.log(result.devices)       // ["0xaa...", "0xbb..."]
 * console.log(result.allowAnyDevice) // false
 * ```
 */

// ── Request ────────────────────────────────────────────────────────

export type GetAllowedDevicesRequest = {
  chain?: Chain;
  rpcUrl?: string;
  appAddress: Address;
  publicClient?: PublicClient;
};

// ── Response ───────────────────────────────────────────────────────

export const GetAllowedDevicesSchema = z.object({
  appAddress: z.string(),
  allowAnyDevice: z.boolean(),
  devices: z.array(z.string()),
});

export type GetAllowedDevices = z.infer<typeof GetAllowedDevicesSchema>;

// ── Implementation ─────────────────────────────────────────────────

export async function getAllowedDevices(
  request: GetAllowedDevicesRequest,
): Promise<GetAllowedDevices> {
  const { chain, rpcUrl, appAddress, publicClient: providedPublicClient } = request;

  const contractAddress = (appAddress.startsWith("0x") ? appAddress : `0x${appAddress}`) as Address;

  const publicClient: PublicClient = providedPublicClient
    ? providedPublicClient
    : (() => {
        if (!chain) throw new Error("Chain is required when publicClient is not provided");
        return createPublicClient({ chain, transport: http(rpcUrl) });
      })();

  // Read allowAnyDevice flag
  const allowAnyDevice = await publicClient.readContract({
    address: contractAddress,
    abi: dstackAppAbi,
    functionName: "allowAnyDevice",
  });

  // Scan DeviceAdded / DeviceRemoved events
  const currentBlock = await publicClient.getBlockNumber();

  const [addedEvents, removedEvents] = await Promise.all([
    publicClient.getLogs({
      address: contractAddress,
      event: {
        type: "event" as const,
        name: "DeviceAdded" as const,
        inputs: [{ name: "deviceId", type: "bytes32", indexed: false, internalType: "bytes32" }],
      },
      fromBlock: BigInt(0),
      toBlock: currentBlock,
    }),
    publicClient.getLogs({
      address: contractAddress,
      event: {
        type: "event" as const,
        name: "DeviceRemoved" as const,
        inputs: [{ name: "deviceId", type: "bytes32", indexed: false, internalType: "bytes32" }],
      },
      fromBlock: BigInt(0),
      toBlock: currentBlock,
    }),
  ]);

  const addedDevices = new Set<Hash>();
  const removedDevices = new Set<Hash>();

  for (const event of addedEvents) {
    if (event.args?.deviceId) addedDevices.add(event.args.deviceId as Hash);
  }
  for (const event of removedEvents) {
    if (event.args?.deviceId) removedDevices.add(event.args.deviceId as Hash);
  }

  const devices = Array.from(addedDevices).filter((id) => !removedDevices.has(id));

  return {
    appAddress: contractAddress,
    allowAnyDevice: allowAnyDevice as boolean,
    devices,
  };
}

// ── Safe variant ───────────────────────────────────────────────────

export type SafeGetAllowedDevicesResult =
  | { success: true; data: GetAllowedDevices }
  | {
      success: false;
      error: { isRequestError: true; message: string; status: number; detail: string };
    };

export async function safeGetAllowedDevices(
  request: GetAllowedDevicesRequest,
): Promise<SafeGetAllowedDevicesResult> {
  try {
    const result = await getAllowedDevices(request);
    return { success: true, data: result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown blockchain error";
    return {
      success: false,
      error: { isRequestError: true, message: errorMessage, status: 500, detail: errorMessage },
    };
  }
}
