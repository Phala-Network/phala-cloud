import type { SafeResult } from "@phala/cloud";
import { FetchError } from "ofetch";

/**
 * Logs detailed error information from any error type.
 * Handles SafeResult errors, FetchError (from throwing API), and regular errors.
 * Automatically exposes HTTP status codes and response bodies when available.
 *
 * @param error - Error from SafeResult, thrown FetchError, or any other error
 * @param context - Optional context string to help identify where the error occurred
 */
export function logDetailedError(
	error: SafeResult<never>["error"] | unknown,
	context?: string,
): void {
	const prefix = context ? `[${context}]` : "";

	// Check if it's a SafeResult error (from safe API)
	if (error && typeof error === "object" && "isRequestError" in error) {
		const safeError = error as SafeResult<never>["error"];
		const ctx = prefix ? `${prefix} ` : "";
		console.error(`${ctx}HTTP ${safeError.status}: ${safeError.message}`);

		if (safeError.data !== undefined && safeError.data !== null) {
			console.error(JSON.stringify(safeError.data, null, 2));
		}
		return;
	}

	// Check if it's a validation error (from safe API)
	if (error && typeof error === "object" && "issues" in error) {
		console.error(`${prefix} Validation error:`, (error as any).issues);
		return;
	}

	// Check if it's a FetchError (from throwing API)
	const errorObj = error as { constructor?: { name?: string } };
	const isFetchError =
		error instanceof FetchError ||
		errorObj.constructor?.name === "FetchError" ||
		(error &&
			typeof error === "object" &&
			"status" in error &&
			"statusText" in error &&
			"data" in error);

	if (isFetchError) {
		const fetchError = error as FetchError;
		const ctx = prefix ? `${prefix} ` : "";
		console.error(`${ctx}HTTP ${fetchError.status}: ${fetchError.message}`);
		if (fetchError.data !== undefined && fetchError.data !== null) {
			console.error(JSON.stringify(fetchError.data, null, 2));
		}
		return;
	}

	// Regular error
	const ctx = prefix ? `${prefix} ` : "";
	if (error instanceof Error) {
		console.error(`${ctx}${error.message}`);
	} else {
		console.error(`${ctx}${String(error)}`);
	}
}

/**
 * Creates an error message from a SafeResult error, optionally including
 * additional details for debugging.
 *
 * @param error - The error object from a SafeResult
 * @param includeDetails - Whether to include HTTP details in the message
 * @returns A formatted error message string
 */
export function formatErrorMessage(
	error: SafeResult<never>["error"],
	includeDetails = false,
): string {
	if ("isRequestError" in error) {
		if (includeDetails && error.data && typeof error.data === "object") {
			const detail = (error.data as any).detail;
			if (detail) {
				return `${error.message}\nDetail: ${detail}`;
			}
		}
		return error.message;
	}

	if ("issues" in error) {
		return `Validation error: ${JSON.stringify(error.issues)}`;
	}

	return "Unknown error occurred";
}
