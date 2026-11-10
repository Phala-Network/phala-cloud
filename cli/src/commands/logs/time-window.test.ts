import { describe, expect, test } from "bun:test";
import { resolveLogTimeWindow } from "./time-window";

describe("resolveLogTimeWindow", () => {
	test("anchors relative values to the same command start time", () => {
		const now = Date.parse("2026-11-09T12:00:00.750Z");
		expect(resolveLogTimeWindow("10m", "2m", now)).toEqual({
			since: 1794225000,
			until: 1794225481,
		});
	});

	test("converts offset RFC3339 timestamps using since-floor and until-ceil", () => {
		expect(
			resolveLogTimeWindow(
				"2026-11-09T12:00:00.900+02:00",
				"2026-11-09T12:00:00.100+02:00",
				0,
			),
		).toEqual({ since: 1794218400, until: 1794218401 });
	});

	test("accepts absolute Unix seconds", () => {
		expect(resolveLogTimeWindow("1799992800", "1799992801", 0)).toEqual({
			since: 1799992800,
			until: 1799992801,
		});
	});

	test("rejects invalid values", () => {
		expect(() => resolveLogTimeWindow("yesterday", undefined, 0)).toThrow(
			"Invalid log time 'yesterday'",
		);
		expect(() =>
			resolveLogTimeWindow(undefined, "2026-02-30T10:00:00Z", 0),
		).toThrow("Invalid log time '2026-02-30T10:00:00Z'");
		expect(() => resolveLogTimeWindow("9".repeat(500), undefined, 0)).toThrow(
			"Invalid log time",
		);
		expect(() =>
			resolveLogTimeWindow("999999999999999999999999d", undefined, 0),
		).toThrow("Invalid log time");
	});
});
