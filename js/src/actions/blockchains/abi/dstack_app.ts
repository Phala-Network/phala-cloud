/**
 * DstackApp contract ABI — subset used by SDK blockchain actions.
 *
 * The full ABI lives in teehouse-ui; we only include the functions and events
 * that the SDK needs for device management and read-only queries.
 */

export const dstackAppAbi = [
  // ── Write functions ──────────────────────────────────────────────
  {
    inputs: [{ internalType: "bytes32", name: "deviceId", type: "bytes32" }],
    name: "addDevice",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "deviceId", type: "bytes32" }],
    name: "removeDevice",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bool", name: "_allowAnyDevice", type: "bool" }],
    name: "setAllowAnyDevice",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ── Read functions ───────────────────────────────────────────────
  {
    inputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    name: "allowedDeviceIds",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "allowAnyDevice",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },

  // ── Events ───────────────────────────────────────────────────────
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: "bytes32", name: "deviceId", type: "bytes32" }],
    name: "DeviceAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: "bytes32", name: "deviceId", type: "bytes32" }],
    name: "DeviceRemoved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: "bool", name: "allowAny", type: "bool" }],
    name: "AllowAnyDeviceSet",
    type: "event",
  },
] as const;
