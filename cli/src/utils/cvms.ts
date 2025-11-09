import { checkCvmExists, selectCvm } from "@/src/api/cvms";
import { createClient, safeGetCvmInfo } from "@phala/cloud";
import { getApiKey } from "./credentials";
import { logger } from "./logger";

/**
 * Resolves a CVM App ID either by prompting the user to select one if none is provided,
 * or by validating the provided App ID exists.
 *
 * In JSON mode, success/error messages are suppressed to avoid polluting output.
 *
 * @param appId Optional App ID to resolve
 * @returns The resolved App ID or undefined if none was selected/found
 */
export async function resolveCvmAppId(
	appId?: string,
): Promise<string | undefined> {
	if (!appId) {
		// If no app ID is provided, prompt user to select one
		const selectedCvm = await selectCvm();
		if (!selectedCvm) {
			return undefined; // No CVMs found or user canceled
		}
		return selectedCvm;
	}
	// Verify the provided App ID exists
	return await checkCvmExists(appId);
}

/**
 * Wait for CVM to complete any in-progress operations and reach running state
 * Progress messages are automatically suppressed in JSON mode.
 *
 * @param uuid CVM UUID to monitor
 * @param timeoutMs Maximum time to wait in milliseconds (default: 5 minutes)
 * @returns Promise that resolves when CVM is running and not in_progress, or rejects on timeout
 */
export async function waitForCvmReady(
	uuid: string,
	timeoutMs = 300000, // 5 minutes default
): Promise<void> {
	const apiKey = getApiKey();
	const client = createClient({ apiKey });
	const startTime = Date.now();
	const checkIntervalMs = 2000; // Check every 2 seconds

	logger.info("Waiting for CVM to be ready...");

	while (Date.now() - startTime < timeoutMs) {
		try {
			const result = await safeGetCvmInfo(client, { uuid });

			if (!result.success) {
				logger.warn(`Failed to get CVM info: ${result.error.message}`);
			} else {
				const cvmInfo = result.data as {
					status?: string;
					in_progress?: boolean;
				};
				const currentStatus = cvmInfo.status;
				const inProgress = cvmInfo.in_progress;

				const elapsed = Math.floor((Date.now() - startTime) / 1000);
				logger.info(
					`  [${elapsed}s] status=${currentStatus}, in_progress=${inProgress}`,
				);

				// Success condition: running and not in_progress
				if (currentStatus === "running" && !inProgress) {
					const elapsed = Math.floor((Date.now() - startTime) / 1000);
					logger.success(`CVM is ready (took ${elapsed}s)`);
					return;
				}
			}
		} catch (error) {
			logger.warn(`Error checking CVM status: ${error}`);
		}

		// Wait before next check
		await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
	}

	throw new Error(
		`Timeout waiting for CVM to be ready (${Math.floor(timeoutMs / 1000)}s)`,
	);
}
