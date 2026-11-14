import { type Chain, type Address, type PublicClient, createPublicClient, http } from "viem";
import { asHex } from "../../utils";
import { dstackAppAbi } from "./abi/dstack_app";
import { resolveAppEpochPlan } from "./epoch_compat";

/**
 * Check on-chain prerequisites for a CVM update in a single RPC call.
 *
 * Uses `multicall` to batch-check:
 * 1. `allowAnyDevice()` — whether the contract allows any device
 * 2. the device row for the specific device
 * 3. the compose-hash row for the specific compose hash
 *
 * The row reads are epoch-aware: contracts without app epochs use the
 * `allowedDeviceIds` / `allowedComposeHashes` getters, epoch-aware contracts use
 * the `…AtEpoch(currentAppEpoch, …)` getters because the plain getters only ever
 * report epoch-0 rows.
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

  const epochPlan = await resolveAppEpochPlan(publicClient, contractAddress);

  const [allowAnyDeviceResult, deviceResult, composeHashResult] =
    epochPlan.kind === "epoch"
      ? await publicClient.multicall({
          contracts: [
            {
              address: contractAddress,
              abi: dstackAppAbi,
              functionName: "allowAnyDevice",
            },
            {
              address: contractAddress,
              abi: dstackAppAbi,
              functionName: "allowedDeviceIdsAtEpoch",
              args: [BigInt(epochPlan.currentAppEpoch), deviceIdHex],
            },
            {
              address: contractAddress,
              abi: dstackAppAbi,
              functionName: "allowedComposeHashesAtEpoch",
              args: [BigInt(epochPlan.currentAppEpoch), composeHashHex],
            },
          ],
        })
      : await publicClient.multicall({
          contracts: [
            {
              address: contractAddress,
              abi: dstackAppAbi,
              functionName: "allowAnyDevice",
            },
            {
              address: contractAddress,
              abi: dstackAppAbi,
              functionName: "allowedDeviceIds",
              args: [deviceIdHex],
            },
            {
              address: contractAddress,
              abi: dstackAppAbi,
              functionName: "allowedComposeHashes",
              args: [composeHashHex],
            },
          ],
        });

  const allowAnyDevice = allowAnyDeviceResult.status === "success" && allowAnyDeviceResult.result;
  const deviceIdAllowed = deviceResult.status === "success" && deviceResult.result;
  const composeHashAllowed = composeHashResult.status === "success" && composeHashResult.result;

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
