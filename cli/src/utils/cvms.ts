import { safeGetCvmInfo } from "@phala/cloud";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { logger } from "./logger";

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
	context?: Pick<CommandContext, "env" | "projectConfig" | "globalOptions">,
): Promise<void> {
	const client = await getClient(context);
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
