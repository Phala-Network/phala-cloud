import { describe, expect, test } from "bun:test";
import {
	normalizeDeviceId,
	isValidDeviceId,
	isAppAllowlistIdentifier,
	normalizeAllowlistAppId,
	txExplorerUrl,
	resolveAllowAnyFlag,
	resolveToggleAllowAny,
	buildAlreadyAllowedSet,
} from "../../src/commands/allow-devices/index";

// ── normalizeDeviceId ───────────────────────────────────────────────

describe("normalizeDeviceId", () => {
	const SAMPLE =
		"aaBBccDDee112233445566778899AABBCCDDEEFF0011223344556677889900AA";

	test("adds 0x prefix when missing", () => {
		expect(normalizeDeviceId(SAMPLE)).toBe(`0x${SAMPLE.toLowerCase()}`);
	});

	test("keeps 0x prefix when present", () => {
		expect(normalizeDeviceId(`0x${SAMPLE}`)).toBe(`0x${SAMPLE.toLowerCase()}`);
	});

	test("lowercases mixed-case input", () => {
		const mixed = `0x${"AA".repeat(32)}`;
		expect(normalizeDeviceId(mixed)).toBe(`0x${"aa".repeat(32)}`);
	});

	test("already-normalized value is unchanged", () => {
		const normalized = `0x${"ab".repeat(32)}`;
		expect(normalizeDeviceId(normalized)).toBe(normalized);
	});
});

// ── isValidDeviceId ─────────────────────────────────────────────────

describe("isValidDeviceId", () => {
	test("accepts 64 hex chars without prefix", () => {
		expect(isValidDeviceId("a".repeat(64))).toBe(true);
	});

	test("accepts 0x + 64 hex chars", () => {
		expect(isValidDeviceId(`0x${"b".repeat(64)}`)).toBe(true);
	});

	test("rejects short hex", () => {
		expect(isValidDeviceId("0xaabb")).toBe(false);
	});

	test("rejects non-hex characters", () => {
		expect(isValidDeviceId(`0x${"g".repeat(64)}`)).toBe(false);
	});

	test("rejects empty string", () => {
		expect(isValidDeviceId("")).toBe(false);
	});

	test("rejects node name", () => {
		expect(isValidDeviceId("prod5")).toBe(false);
	});
});

// ── app identifier helpers ─────────────────────────────────────────

describe("isAppAllowlistIdentifier", () => {
	test("accepts raw 40-char hex app IDs", () => {
		expect(isAppAllowlistIdentifier("a".repeat(40))).toBe(true);
	});

	test("accepts app_-prefixed identifiers", () => {
		expect(isAppAllowlistIdentifier(`app_${"b".repeat(40)}`)).toBe(true);
	});

	test("rejects UUIDs", () => {
		expect(
			isAppAllowlistIdentifier("550e8400-e29b-41d4-a716-446655440000"),
		).toBe(false);
	});
});

describe("normalizeAllowlistAppId", () => {
	test("strips the app_ prefix", () => {
		expect(normalizeAllowlistAppId(`app_${"c".repeat(40)}`)).toBe(
			"c".repeat(40),
		);
	});

	test("lowercases hex app IDs", () => {
		expect(normalizeAllowlistAppId(`app_${"AB".repeat(20)}`)).toBe(
			"ab".repeat(20),
		);
	});

	test("keeps non-hex prefixed identifiers unchanged after prefix removal", () => {
		expect(normalizeAllowlistAppId("app_custom-id")).toBe("custom-id");
	});
});

// ── txExplorerUrl ───────────────────────────────────────────────────

describe("txExplorerUrl", () => {
	const chainWithExplorer = {
		blockExplorers: { default: { url: "https://basescan.org" } },
	} as Parameters<typeof txExplorerUrl>[0];

	const chainWithoutExplorer = {} as Parameters<typeof txExplorerUrl>[0];

	test("returns full URL for chain with block explorer", () => {
		expect(txExplorerUrl(chainWithExplorer, "0xabc")).toBe(
			"https://basescan.org/tx/0xabc",
		);
	});

	test("returns null when txHash is undefined", () => {
		expect(txExplorerUrl(chainWithExplorer, undefined)).toBeNull();
	});

	test("returns null when chain has no block explorer", () => {
		expect(txExplorerUrl(chainWithoutExplorer, "0xabc")).toBeNull();
	});
});

// ── resolveAllowAnyFlag ─────────────────────────────────────────────

describe("resolveAllowAnyFlag", () => {
	test("returns true when --enable is set", () => {
		expect(resolveAllowAnyFlag({ enable: true })).toBe(true);
	});

	test("returns false when --disable is set", () => {
		expect(resolveAllowAnyFlag({ disable: true })).toBe(false);
	});

	test("returns null when neither flag is set (prevents silent default)", () => {
		expect(resolveAllowAnyFlag({})).toBeNull();
	});

	test("returns null when both flags are set (conflict)", () => {
		expect(resolveAllowAnyFlag({ enable: true, disable: true })).toBeNull();
	});

	test("returns null when both flags are false/undefined", () => {
		expect(resolveAllowAnyFlag({ enable: false, disable: false })).toBeNull();
	});
});

// ── resolveToggleAllowAny ───────────────────────────────────────────

describe("resolveToggleAllowAny", () => {
	test("force enable overrides current state", () => {
		expect(
			resolveToggleAllowAny({
				enable: true,
				currentValue: false,
			}),
		).toBe(true);
	});

	test("force disable overrides current state", () => {
		expect(
			resolveToggleAllowAny({
				disable: true,
				currentValue: true,
			}),
		).toBe(false);
	});

	test("toggles false to true", () => {
		expect(resolveToggleAllowAny({ currentValue: false })).toBe(true);
	});

	test("toggles true to false", () => {
		expect(resolveToggleAllowAny({ currentValue: true })).toBe(false);
	});

	test("treats null currentValue as false (toggles to true)", () => {
		expect(resolveToggleAllowAny({ currentValue: null })).toBe(true);
	});

	test("treats undefined currentValue as false (toggles to true)", () => {
		expect(resolveToggleAllowAny({ currentValue: undefined })).toBe(true);
	});

	test("returns null when both enable and disable are set (conflict)", () => {
		expect(
			resolveToggleAllowAny({
				enable: true,
				disable: true,
				currentValue: false,
			}),
		).toBeNull();
	});
});

// ── buildAlreadyAllowedSet ──────────────────────────────────────────

describe("buildAlreadyAllowedSet", () => {
	test("normalizes device IDs with 0x prefix", () => {
		const set = buildAlreadyAllowedSet([{ device_id: `0x${"AA".repeat(32)}` }]);
		expect(set.has(`0x${"aa".repeat(32)}`)).toBe(true);
	});

	test("normalizes device IDs without 0x prefix", () => {
		const set = buildAlreadyAllowedSet([{ device_id: "BB".repeat(32) }]);
		expect(set.has(`0x${"bb".repeat(32)}`)).toBe(true);
	});

	test("matches regardless of original casing", () => {
		const id = "aaBBccDD".repeat(8);
		const set = buildAlreadyAllowedSet([{ device_id: id }]);
		// The normalized form should be lowercase with 0x prefix
		expect(set.has(normalizeDeviceId(id))).toBe(true);
		// Direct lowercase comparison
		expect(set.has(`0x${id.toLowerCase()}`)).toBe(true);
	});

	test("handles empty array", () => {
		const set = buildAlreadyAllowedSet([]);
		expect(set.size).toBe(0);
	});

	test("deduplicates same device ID in different formats", () => {
		const raw = "cc".repeat(32);
		const set = buildAlreadyAllowedSet([
			{ device_id: raw },
			{ device_id: `0x${raw}` },
			{ device_id: raw.toUpperCase() },
		]);
		expect(set.size).toBe(1);
	});
});
