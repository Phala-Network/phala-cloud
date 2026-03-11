import { type Chain, type Address, type PublicClient, createPublicClient, http } from "viem";
import { asHex } from "../../utils";
import { dstackAppAbi } from "./abi/dstack_app";

/**
 * Check whether a specific device is allowed by a DstackApp contract.
 *
 * Reads the `allowAnyDevice()` flag first; if false, checks
 * `allowedDeviceIds(deviceId)`.
 *
 * @group Actions
 * @since 0.6.0
 *
 * ## Usage
 *
 * ```typescript
 * import { checkDeviceAllowed } from '@phala/cloud'
 * import { base } from 'viem/chains'
 *
 * const allowed = await checkDeviceAllowed({
 *   chain: base,
 *   appAddress: "0x1234...abcd",
 *   deviceId: "0xaabbccdd...",
 * })
 * console.log(allowed) // true or false
 * ```
 */

export type CheckDeviceAllowedRequest = {
  chain?: Chain;
  rpcUrl?: string;
  appAddress: Address;
  deviceId: string;
  publicClient?: PublicClient;
};

export async function checkDeviceAllowed(request: CheckDeviceAllowedRequest): Promise<boolean> {
  const { chain, rpcUrl, appAddress, deviceId, publicClient: providedPublicClient } = request;

  const contractAddress = (appAddress.startsWith("0x") ? appAddress : `0x${appAddress}`) as Address;
  const deviceIdHex = asHex(deviceId);

  const publicClient: PublicClient = providedPublicClient
    ? providedPublicClient
    : (() => {
        if (!chain) throw new Error("Chain is required when publicClient is not provided");
        return createPublicClient({ chain, transport: http(rpcUrl) });
      })();

  // Check allowAnyDevice first
  const allowAny = await publicClient.readContract({
    address: contractAddress,
    abi: dstackAppAbi,
    functionName: "allowAnyDevice",
  });

  if (allowAny) return true;

  // Check specific device
  const allowed = await publicClient.readContract({
    address: contractAddress,
    abi: dstackAppAbi,
    functionName: "allowedDeviceIds",
    args: [deviceIdHex],
  });

  return allowed as boolean;
}

export async function safeCheckDeviceAllowed(
  request: CheckDeviceAllowedRequest,
): Promise<
  | { success: true; data: boolean }
  | {
      success: false;
      error: { isRequestError: true; message: string; status: number; detail: string };
    }
> {
  try {
    const result = await checkDeviceAllowed(request);
    return { success: true, data: result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown blockchain error";
    return {
      success: false,
      error: { isRequestError: true, message: errorMessage, status: 500, detail: errorMessage },
    };
  }
}
