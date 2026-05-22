export interface ResultError {
	readonly message: string;
	/** Original underlying error (e.g. RequestError from SDK), preserved so
	 *  callers can introspect HTTP status, response data, etc. */
	readonly cause?: unknown;
}

export type Result<T> =
	| { success: true; data: T }
	| { success: false; error: ResultError };

export function isOk<T>(
	result: Result<T>,
): result is { success: true; data: T } {
	return result.success;
}

export function isErr<T>(
	result: Result<T>,
): result is { success: false; error: ResultError } {
	return !result.success;
}
