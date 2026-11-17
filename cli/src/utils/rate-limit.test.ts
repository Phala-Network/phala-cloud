import { describe, expect, test } from "bun:test";
import { getRateLimitRetryDelayMs } from "./rate-limit";

function rateLimitError(retryAfter?: string): {
	status: number;
	response: Response;
} {
	return {
		status: 429,
		response: new Response(null, {
			status: 429,
			headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
		}),
	};
}

describe("getRateLimitRetryDelayMs", () => {
	test("uses Retry-After seconds", () => {
		expect(getRateLimitRetryDelayMs(rateLimitError("1.5"), 3)).toBe(1500);
	});

	test("uses an HTTP-date Retry-After value", () => {
		const nowMs = Date.parse("2026-11-17T00:00:00Z");
		expect(
			getRateLimitRetryDelayMs(
				rateLimitError("Mon, 17 Nov 2026 00:00:05 GMT"),
				0,
				{ nowMs },
			),
		).toBe(5000);
	});

	test("falls back to bounded exponential backoff", () => {
		expect(getRateLimitRetryDelayMs(rateLimitError(), 0)).toBe(2000);
		expect(getRateLimitRetryDelayMs(rateLimitError(), 4)).toBe(30000);
	});

	test("returns undefined for other errors", () => {
		expect(getRateLimitRetryDelayMs({ status: 503 }, 0)).toBeUndefined();
	});
});
