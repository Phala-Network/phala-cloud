import { type Chain, type Address, type PublicClient, createPublicClient, http } from "viem";
import { asHex } from "../../utils";
import { dstackAppAbi } from "./abi/dstack_app";

/**
 * Check on-chain prerequisites for a CVM update in a single RPC call.
 *
 * Uses `multicall` to batch-check:
 * 1. `allowAnyDevice()` — whether the contract allows any device
 * 2. `allowedDeviceIds(deviceId)` — whether the specific device is registered
 * 3. `allowedComposeHashes(composeHash)` — whether the compose hash is already registered
 *
 * @group Actions
 * @since 0.7.0
 *
 * ## Usage
 *
 * ```typescript
 * import { checkOnChainPrerequisites } from '@phala/cloud'
 * import { base } from 'viem/chains'
 *
 * const prereqs = await checkOnChainPrerequisites({
 *   chain: base,
 *   appAddress: "0x1234...abcd",
 *   deviceId: "0xaabbccdd...",
 *   composeHash: "0xeeff0011...",
 * })
 *
 * if (!prereqs.deviceAllowed) {
 *   // Need to call addDevice first
 * }
 * if (prereqs.composeHashAllowed) {
 *   // Can skip addComposeHash transaction
 * }
 * ```
 */

export type CheckOnChainPrerequisitesRequest = {
  chain?: Chain;
  rpcUrl?: string;
  appAddress: Address;
  deviceId: string;
  composeHash: string;
  publicClient?: PublicClient;
};

export type OnChainPrerequisites = {
  allowAnyDevice: boolean;
  deviceAllowed: boolean;
  composeHashAllowed: boolean;
};

export async function checkOnChainPrerequisites(
  request: CheckOnChainPrerequisitesRequest,
): Promise<OnChainPrerequisites> {
  const {
    chain,
    rpcUrl,
    appAddress,
    deviceId,
    composeHash,
    publicClient: providedPublicClient,
  } = request;

  const contractAddress = (appAddress.startsWith("0x") ? appAddress : `0x${appAddress}`) as Address;
  const deviceIdHex = asHex(deviceId);
  const composeHashHex = asHex(composeHash);

  const publicClient: PublicClient = providedPublicClient
    ? providedPublicClient
    : (() => {
        if (!chain) throw new Error("Chain is required when publicClient is not provided");
        return createPublicClient({ chain, transport: http(rpcUrl) });
      })();

  const calls = [
    {
      address: contractAddress,
      abi: dstackAppAbi,
      functionName: "allowAnyDevice" as const,
    },
    {
      address: contractAddress,
      abi: dstackAppAbi,
      functionName: "allowedDeviceIds" as const,
      args: [deviceIdHex] as const,
    },
    {
      address: contractAddress,
      abi: dstackAppAbi,
      functionName: "allowedComposeHashes" as const,
      args: [composeHashHex] as const,
    },
  ];

  const multicallResults = await publicClient.multicall({ contracts: calls });

  const allowAnyDevice =
    multicallResults[0]?.status === "success" && multicallResults[0]?.result === true;
  const deviceIdAllowed =
    multicallResults[1]?.status === "success" && multicallResults[1]?.result === true;
  const composeHashAllowed =
    multicallResults[2]?.status === "success" && multicallResults[2]?.result === true;

  return {
    allowAnyDevice,
    deviceAllowed: allowAnyDevice || deviceIdAllowed,
    composeHashAllowed,
  };
}

export async function safeCheckOnChainPrerequisites(
  request: CheckOnChainPrerequisitesRequest,
): Promise<
  | { success: true; data: OnChainPrerequisites }
  | {
      success: false;
      error: { isRequestError: true; message: string; status: number; detail: string };
    }
> {
  try {
    const result = await checkOnChainPrerequisites(request);
    return { success: true, data: result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown blockchain error";
    return {
      success: false,
      error: { isRequestError: true, message: errorMessage, status: 500, detail: errorMessage },
    };
  }
}
