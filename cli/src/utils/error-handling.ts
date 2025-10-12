import type { SafeResult } from "@phala/cloud";
import { FetchError } from "ofetch";
import type { ZodError } from "zod";

// Type guard for request errors (RequestError from SDK)
function isRequestError(
	error: unknown,
): error is { isRequestError: true; status: number; statusText: string; message: string; data?: unknown } {
	return (
		error !== null &&
		typeof error === "object" &&
		"isRequestError" in error &&
		error.isRequestError === true &&
		"status" in error &&
		"message" in error &&
		"data" in error
	);
}

// Type guard for validation errors
function isValidationError(error: unknown): error is ZodError {
	return (
		error !== null &&
		typeof error === "object" &&
		"issues" in error &&
		Array.isArray((error as { issues: unknown }).issues)
	);
}

/**
 * Logs detailed error information from any error type.
 * Handles SafeResult errors, FetchError (from throwing API), and regular errors.
 * Automatically exposes HTTP status codes and response bodies when available.
 *
 * @param error - Error from SafeResult, thrown FetchError, or any other error
 * @param context - Optional context string to help identify where the error occurred
 * @param stderr - Optional stderr stream to write to (defaults to console.error)
 */
export function logDetailedError(
	error: SafeResult<never>["error"] | unknown,
	context?: string,
	stderr?: NodeJS.WriteStream,
): void {
	const output = stderr ? stderr.write.bind(stderr) : (msg: string) => console.error(msg);
	const prefix = context ? `[${context}]` : "";

	// Check if it's a SafeResult request error (from safe API)
	if (isRequestError(error)) {
		const ctx = prefix ? `${prefix} ` : "";
		output(`${ctx}HTTP ${error.status}: ${error.message}\n`);

		if (error.data !== undefined && error.data !== null) {
			output(`${JSON.stringify(error.data, null, 2)}\n`);
		}
		return;
	}

	// Check if it's a validation error (from safe API)
	if (isValidationError(error)) {
		output(`${prefix} Validation error: ${JSON.stringify(error.issues)}\n`);
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
		output(`${ctx}HTTP ${fetchError.status}: ${fetchError.message}\n`);
		if (fetchError.data !== undefined && fetchError.data !== null) {
			output(`${JSON.stringify(fetchError.data, null, 2)}\n`);
		}
		return;
	}

	// Regular error
	const ctx = prefix ? `${prefix} ` : "";
	if (error instanceof Error) {
		output(`${ctx}${error.message}\n`);
	} else {
		output(`${ctx}${String(error)}\n`);
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
	// Check if it's a RequestError (has isRequestError discriminator)
	if (isRequestError(error)) {
		if (includeDetails && error.data && typeof error.data === "object") {
			const detail = (error.data as Record<string, unknown>).detail;
			if (detail) {
				return `${error.message}\nDetail: ${detail}`;
			}
		}
		return error.message;
	}

	// Check if it's a ZodError
	if (isValidationError(error)) {
		return `Validation error: ${JSON.stringify(error.issues)}`;
	}

	// PhalaCloudError or other errors
	if ("message" in error && typeof error.message === "string") {
		return error.message;
	}

	return "Unknown error occurred";
}
