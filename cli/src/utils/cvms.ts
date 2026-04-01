import {
	safeGetAppCvms,
	safeGetCvmInfo,
	type Client,
	type CvmIdInput,
} from "@phala/cloud";
import { getClient } from "@/src/lib/client";
import { logger } from "./logger";

function extractAppId(identifier: CvmIdInput): string | undefined {
	if (identifier.app_id) {
		return identifier.app_id.replace(/^app_/, "");
	}
	if (identifier.id && /^[0-9a-f]{40}$/i.test(identifier.id)) {
		return identifier.id;
	}
	if (identifier.id?.startsWith("app_")) {
		return identifier.id.slice(4);
	}
	return undefined;
}

export async function resolveCvmForInput(
	client: Client,
	identifier: CvmIdInput,
) {
	const appId = extractAppId(identifier);
	if (appId) {
		const appCvmsResult = await safeGetAppCvms(client, { appId });
		if (!appCvmsResult.success) {
			throw new Error(appCvmsResult.error.message);
		}
		if (appCvmsResult.data.length === 0) {
			throw new Error("No CVM found in this workspace");
		}
		if (appCvmsResult.data.length > 1) {
			logger.warn(
				"Multiple CVMs found for this app. Using the oldest CVM as the source.",
			);
			return appCvmsResult.data.at(-1) as (typeof appCvmsResult.data)[number];
		}
		return appCvmsResult.data[0];
	}

	const cvmResult = await safeGetCvmInfo(client, identifier);
	if (!cvmResult.success) {
		throw new Error(cvmResult.error.message);
	}
	return cvmResult.data;
}

/**
 * Wait for CVM to complete any in-progress operations and reach running state
 * Progress messages are automatically suppressed in JSON mode.
 *
 * @param cvmId CVM identifier (UUID, app_id, name, or any format accepted by CvmIdSchema)
 * @param timeoutMs Maximum time to wait in milliseconds (default: 5 minutes)
 * @returns Promise that resolves when CVM is running and not in_progress, or rejects on timeout
 */
export async function waitForCvmReady(
	cvmId: string,
	timeoutMs = 300000, // 5 minutes default
): Promise<void> {
	const client = await getClient();
	const startTime = Date.now();
	const checkIntervalMs = 2000; // Check every 2 seconds

	logger.info("Waiting for CVM to be ready...");

	while (Date.now() - startTime < timeoutMs) {
		try {
			const result = await safeGetCvmInfo(client, { id: cvmId });

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
