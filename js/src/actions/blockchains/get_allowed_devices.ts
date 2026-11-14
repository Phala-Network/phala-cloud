import { z } from "zod";
import { type Chain, type Address, type PublicClient, createPublicClient, http } from "viem";
import { asHex } from "../../utils";
import { dstackAppAbi } from "./abi/dstack_app";
import { type AppEpochPlan, resolveAppEpochPlan } from "./epoch_compat";

/**
 * Query the on-chain device allowlist for a DstackApp contract.
 *
 * Checks a list of candidate device IDs against the contract's device rows and
 * returns the ones that are allowed. The row reads are epoch-aware: contracts
 * without app epochs use the `allowedDeviceIds` getter, epoch-aware contracts
 * use `allowedDeviceIdsAtEpoch(currentAppEpoch, …)` because the plain getter
 * only ever reports epoch-0 rows.
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
 *   deviceIds: ["0xaa...", "0xbb..."],
 * })
 * console.log(result.devices)       // ["0xaa..."]
 * console.log(result.allowAnyDevice) // false
 * ```
 */

// ── Request ────────────────────────────────────────────────────────

export type GetAllowedDevicesRequest = {
  chain?: Chain;
  rpcUrl?: string;
  appAddress: Address;
  /** Candidate device IDs to check against the on-chain allowlist. */
  deviceIds: string[];
  /**
   * Read the allowlist at this app epoch instead of the current one. Only
   * meaningful on epoch-aware contracts; ignored on legacy contracts.
   */
  epoch?: number;
  publicClient?: PublicClient;
};

// ── Response ───────────────────────────────────────────────────────

export const GetAllowedDevicesSchema = z.object({
  appAddress: z.string(),
  owner: z.string(),
  allowAnyDevice: z.boolean(),
  devices: z.array(z.string()),
});

export type GetAllowedDevices = z.infer<typeof GetAllowedDevicesSchema>;

// ── Implementation ─────────────────────────────────────────────────

/** Batch-read one candidate device row per ID, at the generation-appropriate getter. */
async function readDeviceRows(
  publicClient: PublicClient,
  contractAddress: Address,
  epochPlan: AppEpochPlan,
  deviceIds: string[],
): Promise<boolean[]> {
  if (epochPlan.kind === "epoch") {
    const currentEpoch = BigInt(epochPlan.currentAppEpoch);
    const results = await publicClient.multicall({
      contracts: deviceIds.map((deviceId) => ({
        address: contractAddress,
        abi: dstackAppAbi,
        functionName: "allowedDeviceIdsAtEpoch" as const,
        args: [currentEpoch, asHex(deviceId)] as const,
      })),
    });
    return results.map((result) => result.status === "success" && result.result === true);
  }

  const results = await publicClient.multicall({
    contracts: deviceIds.map((deviceId) => ({
      address: contractAddress,
      abi: dstackAppAbi,
      functionName: "allowedDeviceIds" as const,
      args: [asHex(deviceId)] as const,
    })),
  });
  return results.map((result) => result.status === "success" && result.result === true);
}

export async function getAllowedDevices(
  request: GetAllowedDevicesRequest,
): Promise<GetAllowedDevices> {
  const {
    chain,
    rpcUrl,
    appAddress,
    deviceIds,
    epoch,
    publicClient: providedPublicClient,
  } = request;

  const contractAddress = (appAddress.startsWith("0x") ? appAddress : `0x${appAddress}`) as Address;

  const publicClient: PublicClient = providedPublicClient
    ? providedPublicClient
    : (() => {
        if (!chain) throw new Error("Chain is required when publicClient is not provided");
        return createPublicClient({ chain, transport: http(rpcUrl) });
      })();

  // Read allowAnyDevice flag and owner in parallel
  const [allowAnyDevice, owner] = await Promise.all([
    publicClient.readContract({
      address: contractAddress,
      abi: dstackAppAbi,
      functionName: "allowAnyDevice",
    }) as Promise<boolean>,
    publicClient.readContract({
      address: contractAddress,
      abi: dstackAppAbi,
      functionName: "owner",
    }) as Promise<Address>,
  ]);

  // If allowAnyDevice is true, all candidate devices are allowed
  if (allowAnyDevice) {
    return {
      appAddress: contractAddress,
      owner,
      allowAnyDevice: true,
      devices: deviceIds.map((id) => asHex(id)),
    };
  }

  // Batch-check all candidate devices via multicall (single RPC request)
  let devices: `0x${string}`[];

  if (deviceIds.length === 0) {
    devices = [];
  } else {
    const epochPlan = await resolveAppEpochPlan(publicClient, contractAddress);
    // An explicit epoch override reads that row instead of the current one.
    const readPlan: AppEpochPlan =
      epochPlan.kind === "epoch" && epoch !== undefined
        ? { kind: "epoch", currentAppEpoch: epoch }
        : epochPlan;
    const allowedFlags = await readDeviceRows(publicClient, contractAddress, readPlan, deviceIds);

    devices = deviceIds
      .map((deviceId, i) => ({
        deviceId: asHex(deviceId),
        allowed: allowedFlags[i] === true,
      }))
      .filter((r) => r.allowed)
      .map((r) => r.deviceId);
  }

  return {
    appAddress: contractAddress,
    owner,
    allowAnyDevice: false,
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
