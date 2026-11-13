import { describe, expect, it } from "vitest";
import { encodeFunctionData, getAbiItem, toFunctionSelector, type Hex } from "viem";
import { dstackAppAbi } from "./dstack_app";

/**
 * The ABI has to match the reference Solidity selector-for-selector: a wrong
 * argument order or an extra/missing `bytes32` encodes a call the contract
 * reverts on, and the probe ids only stay meaningful while the setters keep
 * their signatures.
 */

const DEVICE_ID = `0x${"11".repeat(32)}` as Hex;
const COMPOSE_HASH = `0x${"22".repeat(32)}` as Hex;
const EPOCH_MANAGEMENT_ID = "0x8c0524c4" as Hex;

function selectorOf(functionName: string, args: readonly unknown[]): string {
  return encodeFunctionData({
    abi: dstackAppAbi,
    // The table below is keyed by name, so the literal type has to be relaxed here.
    functionName: functionName as never,
    args: args as never,
  }).slice(0, 10);
}

describe("dstackAppAbi", () => {
  const epochWrites: Array<[string, readonly unknown[], string]> = [
    ["addDeviceAtEpoch", [2n, DEVICE_ID], "0xd5ec0f58"],
    ["addDeviceAtEpochs", [2n, 3n, DEVICE_ID], "0x627b7f25"],
    ["removeDeviceAtEpoch", [2n, DEVICE_ID], "0xc649ed44"],
    ["removeDeviceAtEpochs", [2n, 3n, DEVICE_ID], "0x283721c3"],
    ["addComposeHashAtEpoch", [2n, COMPOSE_HASH], "0x81c0da5a"],
    ["addComposeHashAtEpochs", [2n, 3n, COMPOSE_HASH], "0x5b0df266"],
    ["removeComposeHashAtEpoch", [2n, COMPOSE_HASH], "0xc7e35ec4"],
    ["removeComposeHashAtEpochs", [2n, 3n, COMPOSE_HASH], "0xfed3150c"],
    ["advanceAppEpoch", [2n], "0xfefaf187"],
  ];

  it.each(epochWrites)("encodes %s with the reference selector", (name, args, selector) => {
    expect(selectorOf(name, args)).toBe(selector);
  });

  const epochReads: Array<[string, readonly unknown[], string]> = [
    ["currentAppEpoch", [], "0x9db412c3"],
    ["allowedDeviceIdsAtEpoch", [2n, DEVICE_ID], "0x334acde5"],
    ["allowedComposeHashesAtEpoch", [2n, COMPOSE_HASH], "0x63f8350c"],
    ["supportsInterface", [EPOCH_MANAGEMENT_ID], "0x01ffc9a7"],
  ];

  it.each(epochReads)("encodes %s with the reference selector", (name, args, selector) => {
    expect(selectorOf(name, args)).toBe(selector);
  });

  const legacyCalls: Array<[string, readonly unknown[], string]> = [
    ["addDevice", [DEVICE_ID], "0x2a819728"],
    ["removeDevice", [DEVICE_ID], "0x1d266200"],
    ["addComposeHash", [COMPOSE_HASH], "0xdfc77223"],
    ["removeComposeHash", [COMPOSE_HASH], "0x67b3f22c"],
    ["allowAnyDevice", [], "0x3440a16a"],
    ["owner", [], "0x8da5cb5b"],
  ];

  it.each(legacyCalls)("keeps the legacy %s entry", (name, args, selector) => {
    expect(selectorOf(name, args)).toBe(selector);
  });

  it("pins the IAppEpochManagement selector used by the generation probe", () => {
    expect(toFunctionSelector("supportsInterface(bytes4)")).toBe("0x01ffc9a7");
    expect(EPOCH_MANAGEMENT_ID).toBe("0x8c0524c4");
  });

  const epochEvents = [
    "AppEpochAdvanced",
    "EpochPolicyChanged",
    "PolicyChanged",
    "AllowAnyTeeVariantSet",
    "AllowedTeeVariantsSet",
  ];

  it.each(epochEvents)("declares the %s event", (eventName) => {
    expect(getAbiItem({ abi: dstackAppAbi, name: eventName, type: "event" })).toBeDefined();
  });

  it("declares the legacy event pair used to parse write receipts", () => {
    for (const eventName of ["DeviceAdded", "DeviceRemoved", "ComposeHashAdded", "ComposeHashRemoved"]) {
      expect(getAbiItem({ abi: dstackAppAbi, name: eventName, type: "event" })).toBeDefined();
    }
  });

  it("declares every function name only once", () => {
    const functionNames = dstackAppAbi
      .filter((entry) => entry.type === "function")
      .map((entry) => entry.name);
    expect(new Set(functionNames).size).toBe(functionNames.length);
  });
});
