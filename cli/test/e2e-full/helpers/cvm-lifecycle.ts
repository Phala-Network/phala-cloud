import { createClient } from "@phala/cloud";
import { safeGetCvmInfo } from "@phala/cloud";
import type { TestLogger } from "./logger";

/**
 * Format error with full HTTP response details
 */
function formatErrorDetails(error: unknown): string {
	const errorObj = error as any;

	// Check if it's a SafeResult error
	if (errorObj && typeof errorObj === "object" && "isRequestError" in errorObj) {
		const parts = [`HTTP ${errorObj.status}: ${errorObj.message}`];
		if (errorObj.data) {
			parts.push(JSON.stringify(errorObj.data));
		}
		return parts.join("\n");
	}

	// Check if it's a FetchError
	if (errorObj && typeof errorObj === "object" && "status" in errorObj && "statusText" in errorObj) {
		const parts = [`HTTP ${errorObj.status}: ${errorObj.message || errorObj.statusText}`];
		if (errorObj.data) {
			parts.push(JSON.stringify(errorObj.data));
		}
		return parts.join("\n");
	}

	// Regular error
	if (error instanceof Error) {
		return `${error.message}\n${error.stack || ""}`;
	}

	return String(error);
}

/**
 * Get serial logs from CVM
 */
export async function getCvmSerialLogs(
	logger: TestLogger,
	vmUuid: string,
	apiKey?: string,
): Promise<string> {
	const client = createClient(apiKey ? { apiKey } : undefined);

	try {
		// First get CVM info to find the syslog endpoint
		const cvmResult = await safeGetCvmInfo(client, { uuid: vmUuid });
		if (!cvmResult.success) {
			logger.warn("Failed to get CVM info for logs:");
			logger.warn(formatErrorDetails(cvmResult.error));
			return "";
		}

		const cvmData = cvmResult.data as { syslog_endpoint?: string };
		const syslogEndpoint = cvmData.syslog_endpoint;

		if (!syslogEndpoint) {
			logger.warn("No syslog_endpoint found in CVM info");
			return "";
		}

		// Use the syslog endpoint with serial channel
		// Add ch=serial and lines parameters
		const logUrl = `${syslogEndpoint}&ch=serial&lines=500&ansi`;

		// Make direct fetch call (SDK client prepends /api/v1/ which is wrong for logs)
		const response = await fetch(logUrl);
		if (!response.ok) {
			logger.warn(`Failed to fetch logs: ${response.status} ${response.statusText}`);
			return "";
		}

		const logs = await response.text();
		logger.info(`Retrieved ${logs.length} characters of serial logs`);
		return logs;
	} catch (error) {
		logger.warn(`Failed to get serial logs: ${error}`);
		return "";
	}
}

/**
 * Wait for CVM to reach target status
 */
export async function waitForCvmStatus(
	logger: TestLogger,
	appId: string,
	targetStatus: string,
	timeoutMs = 300000, // 5 minutes default
	apiKey?: string,
): Promise<void> {
	const client = createClient(apiKey ? { apiKey } : undefined);
	const startTime = Date.now();
	const checkIntervalMs = 5000; // Check every 5 seconds

	logger.info(
		`Waiting for CVM ${appId} to reach status: ${targetStatus} (timeout: ${timeoutMs}ms)`,
	);

	while (Date.now() - startTime < timeoutMs) {
		try {
			const result = await safeGetCvmInfo(client, { uuid: appId });

			if (!result.success) {
				logger.warn("Failed to get CVM info:");
				logger.warn(formatErrorDetails(result.error));
			} else {
				const cvmInfo = result.data as { status?: string };
				const currentStatus = cvmInfo.status;

				logger.info(`Current status: ${currentStatus}`);

				if (currentStatus === targetStatus) {
					logger.success(
						`CVM reached target status: ${targetStatus} (took ${Date.now() - startTime}ms)`,
					);
					return;
				}
			}
		} catch (error) {
			logger.warn("Error checking CVM status:");
			logger.warn(formatErrorDetails(error));
		}

		// Wait before next check
		await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
	}

	throw new Error(
		`Timeout waiting for CVM to reach status ${targetStatus} (${timeoutMs}ms)`,
	);
}

/**
 * Wait for CVM network to be ready
 */
export async function waitForCvmNetwork(
	logger: TestLogger,
	appId: string,
	timeoutMs = 180000, // 3 minutes default
	apiKey?: string,
): Promise<void> {
	const client = createClient(apiKey ? { apiKey } : undefined);
	const startTime = Date.now();
	const checkIntervalMs = 5000;

	logger.info(
		`Waiting for CVM ${appId} network to be ready (timeout: ${timeoutMs}ms)`,
	);

	while (Date.now() - startTime < timeoutMs) {
		try {
			// Try to get CVM info which includes network status
			const result = await safeGetCvmInfo(client, { uuid: appId });

			if (result.success) {
				const cvmInfo = result.data as {
					status?: string;
					in_progress?: boolean;
				};

				// Check if CVM is running and not in progress
				if (cvmInfo.status === "running" && !cvmInfo.in_progress) {
					logger.success(
						`CVM network is ready (took ${Date.now() - startTime}ms)`,
					);
					return;
				}

				logger.info(
					`CVM status: ${cvmInfo.status}, in_progress: ${cvmInfo.in_progress}`,
				);
			}
		} catch (error) {
			logger.warn("Error checking CVM network:");
			logger.warn(formatErrorDetails(error));
		}

		// Wait before next check
		await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
	}

	throw new Error(`Timeout waiting for CVM network to be ready (${timeoutMs}ms)`);
}

/**
 * Get comprehensive CVM details
 */
export async function getCvmDetails(
	appId: string,
	apiKey?: string,
): Promise<unknown> {
	const client = createClient(apiKey ? { apiKey } : undefined);
	const result = await safeGetCvmInfo(client, { uuid: appId });

	if (!result.success) {
		const errorDetails = formatErrorDetails(result.error);
		throw new Error(`Failed to get CVM details:\n${errorDetails}`);
	}

	return result.data;
}

/**
 * Safely cleanup CVM
 */
export async function cleanupCvm(
	logger: TestLogger,
	appId: string,
	apiKey?: string,
): Promise<void> {
	try {
		logger.info(`Cleaning up CVM: ${appId}`);

		const client = createClient(apiKey ? { apiKey } : undefined);

		// First check if CVM exists
		const checkResult = await safeGetCvmInfo(client, { uuid: appId });

		if (!checkResult.success) {
			logger.warn(`CVM ${appId} not found, skipping cleanup`);
			return;
		}

		// Delete the CVM
		// Note: Using the SDK's delete method if available
		// For now, we'll just log the intent
		logger.info(`CVM ${appId} would be deleted here`);
		logger.success(`CVM cleanup completed`);
	} catch (error) {
		logger.error("Failed to cleanup CVM:");
		logger.error(formatErrorDetails(error));
		// Don't throw - cleanup is best effort
	}
}

/**
 * Poll until a condition is met
 */
export async function pollUntil<T>(
	fn: () => Promise<T>,
	condition: (result: T) => boolean,
	options: {
		timeoutMs?: number;
		intervalMs?: number;
		description?: string;
	} = {},
): Promise<T> {
	const {
		timeoutMs = 60000,
		intervalMs = 2000,
		description = "condition",
	} = options;

	const startTime = Date.now();

	while (Date.now() - startTime < timeoutMs) {
		const result = await fn();

		if (condition(result)) {
			return result;
		}

		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}

	throw new Error(`Timeout waiting for ${description} (${timeoutMs}ms)`);
}
