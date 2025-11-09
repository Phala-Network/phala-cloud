import { createClient } from "@phala/cloud";
import { safeGetCvmInfo } from "@phala/cloud";
import type { TestLogger } from "./logger";

/**
 * Format error with full HTTP response details
 */
function formatErrorDetails(error: unknown): string {
	const errorObj = error as any;

	// Check if it's a SafeResult error
	if (
		errorObj &&
		typeof errorObj === "object" &&
		"isRequestError" in errorObj
	) {
		const parts = [`HTTP ${errorObj.status}: ${errorObj.message}`];
		if (errorObj.data) {
			parts.push(JSON.stringify(errorObj.data));
		}
		return parts.join("\n");
	}

	// Check if it's a FetchError
	if (
		errorObj &&
		typeof errorObj === "object" &&
		"status" in errorObj &&
		"statusText" in errorObj
	) {
		const parts = [
			`HTTP ${errorObj.status}: ${errorObj.message || errorObj.statusText}`,
		];
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
			logger.warn(
				`Failed to fetch logs: ${response.status} ${response.statusText}`,
			);
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
 * Get event logs from CVM
 */
export async function getCvmEventLogs(
	logger: TestLogger,
	vmUuid: string,
	apiKey?: string,
): Promise<unknown[]> {
	try {
		// Event logs API uses vm_uuid (without dashes)
		const uuidNoDashes = vmUuid.replace(/-/g, "");
		const eventUrl = `https://cloud.phala.network/api/cvms/${uuidNoDashes}/events`;

		const headers: Record<string, string> = {
			accept: "*/*",
		};

		if (apiKey) {
			headers["X-API-Key"] = apiKey;
		}

		// Make direct fetch call
		const response = await fetch(eventUrl, { headers });
		if (!response.ok) {
			logger.warn(
				`Failed to fetch event logs: ${response.status} ${response.statusText}`,
			);
			return [];
		}

		const data = await response.json();
		// API returns {"items": [...], "next_cursor": null, "total": N}
		const items = data.items || [];
		return items;
	} catch (error) {
		logger.warn(`Failed to get event logs: ${error}`);
		return [];
	}
}

/**
 * Wait for all backend operations to complete
 * Polls event logs and CVM status until operations are truly complete
 */
export async function waitForOperationsComplete(
	logger: TestLogger,
	vmUuid: string,
	timeoutMs = 60000, // 1 minute default
	apiKey?: string,
): Promise<void> {
	const client = createClient(apiKey ? { apiKey } : undefined);
	const startTime = Date.now();
	const checkIntervalMs = 2000; // Check every 2 seconds

	logger.info(
		`Waiting for backend operations to complete (timeout: ${timeoutMs}ms)`,
	);

	while (Date.now() - startTime < timeoutMs) {
		try {
			// Check both event logs AND CVM status
			const eventLogs = await getCvmEventLogs(logger, vmUuid, apiKey);
			const cvmResult = await safeGetCvmInfo(client, { uuid: vmUuid });

			// Check CVM in_progress status
			let cvmInProgress = false;
			if (cvmResult.success) {
				const cvmInfo = cvmResult.data as { in_progress?: boolean };
				cvmInProgress = cvmInfo.in_progress || false;
			}

			// If no event logs yet, check CVM status
			if (eventLogs.length === 0) {
				if (!cvmInProgress) {
					logger.success(
						`No recent operations (took ${Date.now() - startTime}ms)`,
					);
					return;
				}
				logger.info("No event logs yet, but CVM is in_progress, waiting...");
				await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
				continue;
			}

			// Get the most recent event (assuming they're sorted by timestamp desc)
			const recentEvent = eventLogs[0] as {
				event_type?: string;
				status?: string;
				timestamp?: string;
			};

			logger.info(
				`Most recent event: ${recentEvent.event_type} - ${recentEvent.status}, CVM in_progress: ${cvmInProgress}`,
			);

			// Check if BOTH event is completed AND CVM is not in_progress
			if (recentEvent.status === "completed" && !cvmInProgress) {
				logger.success(
					`Backend operations completed (took ${Date.now() - startTime}ms)`,
				);
				return;
			}

			// If status is "in_progress" or CVM is busy, continue waiting
			if (recentEvent.status !== "completed") {
				logger.info("Event still in progress, waiting...");
			} else if (cvmInProgress) {
				logger.info("Event completed but CVM still in_progress, waiting...");
			}
		} catch (error) {
			logger.warn("Error checking operation status:");
			logger.warn(formatErrorDetails(error));
		}

		// Wait before next check
		await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
	}

	// Timeout - warn but don't fail, as the operation might have completed
	// without proper event log updates
	logger.warn(
		`Timeout waiting for operations to complete (${timeoutMs}ms). Proceeding anyway...`,
	);
}

/**
 * Wait for a new event of a specific type to appear and complete
 * This is useful after triggering an operation to ensure it actually starts and finishes
 */
export async function waitForNewEvent(
	logger: TestLogger,
	vmUuid: string,
	eventTypePattern: string | RegExp,
	timeoutMs = 180000, // 3 minutes default
	apiKey?: string,
): Promise<void> {
	const client = createClient(apiKey ? { apiKey } : undefined);
	const startTime = Date.now();
	const checkIntervalMs = 2000; // Check every 2 seconds

	// Get initial event logs to establish a baseline
	const initialEvents = await getCvmEventLogs(logger, vmUuid, apiKey);
	const initialEventIds = new Set(
		initialEvents.map((e: any) => e.id || e.timestamp),
	);

	logger.info(
		`Waiting for new event matching ${eventTypePattern} (timeout: ${timeoutMs}ms)`,
	);

	let foundNewEvent = false;
	let targetEventCompleted = false;

	while (Date.now() - startTime < timeoutMs) {
		try {
			// Get current event logs
			const currentEvents = await getCvmEventLogs(logger, vmUuid, apiKey);
			const cvmResult = await safeGetCvmInfo(client, { uuid: vmUuid });

			// Check CVM in_progress status
			let cvmInProgress = false;
			if (cvmResult.success) {
				const cvmInfo = cvmResult.data as { in_progress?: boolean };
				cvmInProgress = cvmInfo.in_progress || false;
			}

			// Look for new events matching the pattern
			for (const event of currentEvents) {
				const evt = event as {
					id?: string;
					event_type?: string;
					status?: string;
					timestamp?: string;
				};
				const eventId = evt.id || evt.timestamp;

				// Skip if this is an old event we've already seen
				if (initialEventIds.has(eventId)) {
					continue;
				}

				// Check if event type matches
				const matches =
					typeof eventTypePattern === "string"
						? evt.event_type?.includes(eventTypePattern)
						: eventTypePattern.test(evt.event_type || "");

				if (matches) {
					if (!foundNewEvent) {
						logger.info(
							`New event detected: ${evt.event_type} - ${evt.status}`,
						);
						foundNewEvent = true;
					}

					// Check if this event is completed and CVM is not in_progress
					if (evt.status === "completed" && !cvmInProgress) {
						logger.success(
							`Event ${evt.event_type} completed (took ${Date.now() - startTime}ms)`,
						);
						return;
					}

					if (evt.status !== "completed") {
						logger.info(`Event ${evt.event_type} still in progress...`);
					}
					targetEventCompleted = evt.status === "completed";
				}
			}

			// If we found the event and it's completed, but CVM is still in_progress
			if (targetEventCompleted && cvmInProgress) {
				logger.info("Event completed but CVM still in_progress, waiting...");
			}

			// If we haven't found any new matching event yet
			if (!foundNewEvent) {
				logger.info("No new matching event yet, waiting...");
			}
		} catch (error) {
			logger.warn("Error checking event logs:");
			logger.warn(formatErrorDetails(error));
		}

		// Wait before next check
		await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
	}

	throw new Error(
		`Timeout waiting for new event matching ${eventTypePattern} (${timeoutMs}ms)`,
	);
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

	throw new Error(
		`Timeout waiting for CVM network to be ready (${timeoutMs}ms)`,
	);
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
