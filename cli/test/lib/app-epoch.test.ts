import { describe, expect, mock, test } from "bun:test";
import { base } from "viem/chains";

// Mock @phala/cloud explicitly: another test file's whole-module mock would
// otherwise leak into this file and pin resolveAppEpochPlan to its stub.
const resolveAppEpochPlanMock = mock(() => Promise.resolve({ kind: "legacy" }));
mock.module("@phala/cloud", () => ({
	resolveAppEpochPlan: resolveAppEpochPlanMock,
}));

import {
	type AppEpochPlan,
	detectAppEpochPlan,
	formatAppEpochPlan,
	formatEpochsWritten,
	legacyEpochUnsupportedMessage,
	readEpochsWritten,
} from "../../src/lib/app-epoch";

const APP_ADDRESS = `0x${"ab".repeat(20)}` as const;

// ── write results ───────────────────────────────────────────────────

describe("readEpochsWritten", () => {
	test("passes through a two-element range", () => {
		expect(readEpochsWritten([0, 1])).toEqual([0, 1]);
	});

	test("passes through a single-epoch write", () => {
		expect(readEpochsWritten([1, 1])).toEqual([1, 1]);
	});

	test("returns undefined for legacy writes", () => {
		expect(readEpochsWritten(undefined)).toBeUndefined();
		expect(readEpochsWritten(null)).toBeUndefined();
	});

	test("returns undefined for malformed payloads", () => {
		expect(readEpochsWritten([])).toBeUndefined();
		expect(readEpochsWritten([0])).toBeUndefined();
		expect(readEpochsWritten(["0", "1"])).toBeUndefined();
		expect(readEpochsWritten("0,1")).toBeUndefined();
	});
});

describe("formatEpochsWritten", () => {
	test("collapses equal bounds", () => {
		expect(formatEpochsWritten([0, 0])).toBe("epoch 0");
	});

	test("renders an inclusive range", () => {
		expect(formatEpochsWritten([0, 1])).toBe("epochs 0..1");
	});
});

// ── plan display ────────────────────────────────────────────────────

describe("formatAppEpochPlan", () => {
	test("shows the epoch line on epoch-aware contracts", () => {
		expect(formatAppEpochPlan({ kind: "epoch", currentAppEpoch: 0 })).toBe(
			"App epoch: 0 (epoch-aware contract)",
		);
	});

	test("stays silent on legacy contracts", () => {
		const legacy: AppEpochPlan = { kind: "legacy" };
		expect(formatAppEpochPlan(legacy)).toBeNull();
	});

	test("stays silent when the probe is undecided", () => {
		expect(formatAppEpochPlan(null)).toBeNull();
	});
});

describe("legacyEpochUnsupportedMessage", () => {
	test("names the contract and the flag", () => {
		const message = legacyEpochUnsupportedMessage(APP_ADDRESS);
		expect(message).toContain(APP_ADDRESS);
		expect(message).toContain("--epoch");
		expect(message).toContain("legacy");
	});
});

// ── probe failure handling ──────────────────────────────────────────

describe("detectAppEpochPlan", () => {
	test("stays undecided when the SDK probe throws", async () => {
		resolveAppEpochPlanMock.mockImplementationOnce(() =>
			Promise.reject(new Error("rpc unreachable")),
		);

		const plan = await detectAppEpochPlan({
			chain: base,
			appAddress: APP_ADDRESS,
			rpcUrl: "http://127.0.0.1:1",
			timeoutMs: 500,
		});

		expect(plan).toBeNull();
	});

	test("forwards the SDK verdict", async () => {
		resolveAppEpochPlanMock.mockImplementationOnce(() =>
			Promise.resolve({ kind: "epoch", currentAppEpoch: 3 }),
		);

		const plan = await detectAppEpochPlan({
			chain: base,
			appAddress: APP_ADDRESS,
			rpcUrl: "http://127.0.0.1:1",
			timeoutMs: 500,
		});

		expect(plan).toEqual({ kind: "epoch", currentAppEpoch: 3 });
	});
});
