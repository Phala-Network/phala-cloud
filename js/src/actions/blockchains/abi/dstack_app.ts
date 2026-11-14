/**
 * DstackApp contract ABI — subset used by SDK blockchain actions.
 *
 * The full ABI lives in teehouse-ui; we only include the functions and events
 * that the SDK needs for device management and read-only queries.
 *
 * Two contract generations are supported:
 *
 * - Legacy (dstack < 0.6.4): epoch-less setters `addDevice` / `removeDevice` /
 *   `addComposeHash` / `removeComposeHash`, and getters that only ever read the
 *   epoch-0 rows.
 * - Epoch-aware (dstack >= 0.6.4): the epoch-less setters are removed and
 *   replaced by `*AtEpoch` / `*AtEpochs` forms; allowlist rows are stored per
 *   epoch and are not inherited across epochs. The legacy getters are kept, but
 *   they only ever report epoch-0 rows, so read paths must use
 *   `allowedDeviceIdsAtEpoch` / `allowedComposeHashesAtEpoch` instead.
 *
 * The two generations are told apart with the ERC-165 interface IDs declared in
 * `epoch_compat.ts`.
 */

export const dstackAppAbi = [
  // ── Legacy write functions (removed on epoch-aware contracts) ────
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
    inputs: [{ internalType: "bytes32", name: "composeHash", type: "bytes32" }],
    name: "addComposeHash",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "composeHash", type: "bytes32" }],
    name: "removeComposeHash",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ── Epoch-aware write functions ──────────────────────────────────
  {
    inputs: [
      { internalType: "uint256", name: "epoch", type: "uint256" },
      { internalType: "bytes32", name: "deviceId", type: "bytes32" },
    ],
    name: "addDeviceAtEpoch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "fromEpoch", type: "uint256" },
      { internalType: "uint256", name: "toEpoch", type: "uint256" },
      { internalType: "bytes32", name: "deviceId", type: "bytes32" },
    ],
    name: "addDeviceAtEpochs",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "epoch", type: "uint256" },
      { internalType: "bytes32", name: "deviceId", type: "bytes32" },
    ],
    name: "removeDeviceAtEpoch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "fromEpoch", type: "uint256" },
      { internalType: "uint256", name: "toEpoch", type: "uint256" },
      { internalType: "bytes32", name: "deviceId", type: "bytes32" },
    ],
    name: "removeDeviceAtEpochs",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "epoch", type: "uint256" },
      { internalType: "bytes32", name: "composeHash", type: "bytes32" },
    ],
    name: "addComposeHashAtEpoch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "fromEpoch", type: "uint256" },
      { internalType: "uint256", name: "toEpoch", type: "uint256" },
      { internalType: "bytes32", name: "composeHash", type: "bytes32" },
    ],
    name: "addComposeHashAtEpochs",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "epoch", type: "uint256" },
      { internalType: "bytes32", name: "composeHash", type: "bytes32" },
    ],
    name: "removeComposeHashAtEpoch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "fromEpoch", type: "uint256" },
      { internalType: "uint256", name: "toEpoch", type: "uint256" },
      { internalType: "bytes32", name: "composeHash", type: "bytes32" },
    ],
    name: "removeComposeHashAtEpochs",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "expectedCurrentEpoch", type: "uint256" }],
    name: "advanceAppEpoch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ── Generation-independent write functions ───────────────────────
  {
    inputs: [{ internalType: "bool", name: "_allowAnyDevice", type: "bool" }],
    name: "setAllowAnyDevice",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bool", name: "allowed", type: "bool" }],
    name: "setAllowAnyTeeVariant",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string[]", name: "teeVariants", type: "string[]" }],
    name: "setAllowedTeeVariants",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bool", name: "_requireUpToDate", type: "bool" }],
    name: "setRequireTcbUpToDate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ── Legacy read functions (epoch-0 views on epoch-aware contracts) ──
  {
    inputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    name: "allowedDeviceIds",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    name: "allowedComposeHashes",
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
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },

  // ── Epoch-aware read functions ───────────────────────────────────
  {
    inputs: [],
    name: "currentAppEpoch",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "epoch", type: "uint256" },
      { internalType: "bytes32", name: "deviceId", type: "bytes32" },
    ],
    name: "allowedDeviceIdsAtEpoch",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "epoch", type: "uint256" },
      { internalType: "bytes32", name: "composeHash", type: "bytes32" },
    ],
    name: "allowedComposeHashesAtEpoch",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "allowAnyTeeVariant",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "allowedTeeVariants",
    outputs: [{ internalType: "string[]", name: "", type: "string[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "requireTcbUpToDate",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },

  // ── ERC-165 (generation probe) ───────────────────────────────────
  {
    inputs: [{ internalType: "bytes4", name: "interfaceId", type: "bytes4" }],
    name: "supportsInterface",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },

  // ── Errors ───────────────────────────────────────────────────────
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },

  // ── Legacy events (emitted for epoch-0 rows only) ────────────────
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
    inputs: [{ indexed: false, internalType: "bytes32", name: "composeHash", type: "bytes32" }],
    name: "ComposeHashAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: "bytes32", name: "composeHash", type: "bytes32" }],
    name: "ComposeHashRemoved",
    type: "event",
  },

  // ── Epoch-aware events ───────────────────────────────────────────
  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: "uint256", name: "epoch", type: "uint256" }],
    name: "AppEpochAdvanced",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "policy", type: "bytes32" },
      { indexed: true, internalType: "bytes32", name: "value", type: "bytes32" },
      { indexed: true, internalType: "uint256", name: "epoch", type: "uint256" },
      { indexed: false, internalType: "bool", name: "enabled", type: "bool" },
    ],
    name: "EpochPolicyChanged",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "actor", type: "address" },
      { indexed: true, internalType: "bytes32", name: "policy", type: "bytes32" },
      { indexed: true, internalType: "bytes32", name: "value", type: "bytes32" },
      { indexed: false, internalType: "bool", name: "enabled", type: "bool" },
    ],
    name: "PolicyChanged",
    type: "event",
  },

  // ── Generation-independent events ────────────────────────────────
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: "bool", name: "allowAny", type: "bool" }],
    name: "AllowAnyDeviceSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: "bool", name: "allowAny", type: "bool" }],
    name: "AllowAnyTeeVariantSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: "string[]", name: "teeVariants", type: "string[]" }],
    name: "AllowedTeeVariantsSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: "bool", name: "requireUpToDate", type: "bool" }],
    name: "RequireTcbUpToDateSet",
    type: "event",
  },
] as const;
