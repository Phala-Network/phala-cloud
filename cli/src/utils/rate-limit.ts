const DEFAULT_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30000;

interface ErrorLike {
	readonly status?: unknown;
	readonly response?: unknown;
	readonly cause?: unknown;
}

function asErrorLike(value: unknown): ErrorLike | undefined {
	return value !== null && typeof value === "object"
		? (value as ErrorLike)
		: undefined;
}

function responseFrom(error: unknown): Response | undefined {
	let current = asErrorLike(error);
	for (let depth = 0; current && depth < 5; depth += 1) {
		if (current.response instanceof Response) return current.response;
		current = asErrorLike(current.cause);
	}
	return undefined;
}

function statusFrom(error: unknown): number | undefined {
	let current = asErrorLike(error);
	for (let depth = 0; current && depth < 5; depth += 1) {
		if (typeof current.status === "number") return current.status;
		if (current.response instanceof Response) return current.response.status;
		current = asErrorLike(current.cause);
	}
	return undefined;
}

function parseRetryAfter(
	value: string | null,
	nowMs: number,
): number | undefined {
	if (value === null) return undefined;
	const seconds = Number(value);
	if (Number.isFinite(seconds) && seconds >= 0) {
		return seconds * 1000;
	}
	const retryAt = Date.parse(value);
	if (Number.isNaN(retryAt)) return undefined;
	return Math.max(0, retryAt - nowMs);
}

/**
 * Return the delay for a rate-limited request, or undefined when the error is
 * not HTTP 429. Retry-After wins; otherwise use bounded exponential backoff.
 */
export function getRateLimitRetryDelayMs(
	error: unknown,
	attempt: number,
	options?: {
		readonly fallbackMs?: number;
		readonly nowMs?: number;
	},
): number | undefined {
	if (statusFrom(error) !== 429) return undefined;
	const nowMs = options?.nowMs ?? Date.now();
	const retryAfter = parseRetryAfter(
		responseFrom(error)?.headers.get("retry-after") ?? null,
		nowMs,
	);
	if (retryAfter !== undefined) return retryAfter;
	const fallbackMs = options?.fallbackMs ?? DEFAULT_BACKOFF_MS;
	return Math.min(fallbackMs * 2 ** Math.max(0, attempt), MAX_BACKOFF_MS);
}

export async function sleepWithinDeadline(
	delayMs: number,
	deadlineMs: number,
): Promise<void> {
	const remainingMs = deadlineMs - Date.now();
	if (remainingMs <= 0) return;
	await new Promise((resolve) =>
		setTimeout(resolve, Math.min(delayMs, remainingMs)),
	);
}
