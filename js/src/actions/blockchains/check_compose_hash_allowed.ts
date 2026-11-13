import { type Chain, type Address, type PublicClient, createPublicClient, http } from "viem";
import { asHex } from "../../utils";
import { dstackAppAbi } from "./abi/dstack_app";
import { resolveAppEpochPlan } from "./epoch_compat";

/**
 * Check whether a specific compose hash is allowed by a DstackApp contract.
 *
 * The row read is epoch-aware: contracts without app epochs use the
 * `allowedComposeHashes(hash)` getter, epoch-aware contracts use
 * `allowedComposeHashesAtEpoch(currentAppEpoch, hash)` because the plain getter
 * only ever reports epoch-0 rows.
 *
 * @group Actions
 * @since 0.7.0
 *
 * ## Usage
 *
 * ```typescript
 * import { checkComposeHashAllowed } from '@phala/cloud'
 * import { base } from 'viem/chains'
 *
 * const allowed = await checkComposeHashAllowed({
 *   chain: base,
 *   appAddress: "0x1234...abcd",
 *   composeHash: "0xaabbccdd...",
 * })
 * console.log(allowed) // true or false
 * ```
 */

export type CheckComposeHashAllowedRequest = {
  chain?: Chain;
  rpcUrl?: string;
  appAddress: Address;
  composeHash: string;
  publicClient?: PublicClient;
};

export async function checkComposeHashAllowed(
  request: CheckComposeHashAllowedRequest,
): Promise<boolean> {
  const { chain, rpcUrl, appAddress, composeHash, publicClient: providedPublicClient } = request;

  const contractAddress = (appAddress.startsWith("0x") ? appAddress : `0x${appAddress}`) as Address;
  const composeHashHex = asHex(composeHash);

  const publicClient: PublicClient = providedPublicClient
    ? providedPublicClient
    : (() => {
        if (!chain) throw new Error("Chain is required when publicClient is not provided");
        return createPublicClient({ chain, transport: http(rpcUrl) });
      })();

  const epochPlan = await resolveAppEpochPlan(publicClient, contractAddress);

  if (epochPlan.kind === "epoch") {
    const allowedAtEpoch = await publicClient.readContract({
      address: contractAddress,
      abi: dstackAppAbi,
      functionName: "allowedComposeHashesAtEpoch",
      args: [BigInt(epochPlan.currentAppEpoch), composeHashHex],
    });
    return allowedAtEpoch as boolean;
  }

  const allowed = await publicClient.readContract({
    address: contractAddress,
    abi: dstackAppAbi,
    functionName: "allowedComposeHashes",
    args: [composeHashHex],
  });

  return allowed as boolean;
}

export async function safeCheckComposeHashAllowed(request: CheckComposeHashAllowedRequest): Promise<
  | { success: true; data: boolean }
  | {
      success: false;
      error: { isRequestError: true; message: string; status: number; detail: string };
    }
> {
  try {
    const result = await checkComposeHashAllowed(request);
    return { success: true, data: result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown blockchain error";
    return {
      success: false,
      error: { isRequestError: true, message: errorMessage, status: 500, detail: errorMessage },
    };
  }
}
