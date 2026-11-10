import { describe, expect, test } from "vitest";
import { resolveLogTimeWindow } from "./log-time";

describe("resolveLogTimeWindow", () => {
  const now = Date.parse("2026-11-09T12:00:00Z");

  test("passes unix seconds through", () => {
    expect(resolveLogTimeWindow(100, 200, now)).toEqual({ since: 100, until: 200 });
  });

  test("resolves relative durations against now", () => {
    expect(resolveLogTimeWindow("10m", "1h", now)).toEqual({
      since: Math.floor(now / 1000) - 600,
      until: Math.ceil(now / 1000) - 3600,
    });
  });

  test("parses RFC3339 with offset", () => {
    expect(resolveLogTimeWindow("2026-11-09T12:00:00Z", undefined, now)).toEqual({
      since: 1794225600,
    });
  });

  test("ceils RFC3339 until with a nanosecond fraction without float milliseconds", () => {
    expect(resolveLogTimeWindow(undefined, "2026-11-10T00:00:00.000000001Z", now)).toEqual({
      until: 1794268801,
    });
  });

  test("rejects unknown values", () => {
    expect(() => resolveLogTimeWindow("yesterday", undefined, now)).toThrow(/Invalid log time/);
  });
});
