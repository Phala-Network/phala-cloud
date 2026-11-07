import { safeGetCvmInfo } from "@phala/cloud";
import type { CommandContext } from "@/src/core/types";
import { type CliApiClient, getClient } from "@/src/lib/client";
import { logger } from "./logger";

/**
 * Wait for CVM to complete any in-progress operations and reach the expected state
 * Progress messages are automatically suppressed in JSON mode.
 *
 * @param cvmId CVM identifier (UUID, app_id, name, or any format accepted by CvmIdSchema)
 * @param timeoutMs Maximum time to wait in milliseconds (default: 5 minutes)
 * @param expectedStatus Status that counts as ready (default: running)
 * @returns Promise that resolves when CVM is in expectedStatus and not in_progress, or rejects on timeout
 */
export async function waitForCvmReady(
	cvmId: string,
	timeoutMs = 300000, // 5 minutes default
	context?: Pick<CommandContext, "env" | "projectConfig" | "globalOptions">,
	expectedStatus = "running",
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

				if (currentStatus === expectedStatus && !inProgress) {
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

/**
 * Wait for an update operation to finish, and fail unless it completed.
 * The CVM state alone cannot tell a finished update from a failed one, and a
 * failed update may leave the CVM in a different state than before (a boot
 * failure leaves a running CVM stopped), so wait for the operation first.
 */
export async function waitForUpdateOperation(
	client: CliApiClient,
	cvmId: string,
	correlationId: string,
	timeoutMs: number,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	do {
		const { items } = await client.get<{
			items: Array<{ status: string; error_message?: string | null }>;
		}>(`/cvms/${cvmId}/operations`, {
			params: { correlation_id: correlationId },
		});
		const operation = items[0];
		if (operation?.status === "completed") return;
		if (operation && operation.status !== "in_progress") {
			throw new Error(
				`Update ${operation.status}: ${operation.error_message ?? "no error message"}`,
			);
		}
		await new Promise((resolve) => setTimeout(resolve, 2000));
	} while (Date.now() < deadline);
	throw new Error(
		`Timeout waiting for the update operation to finish (${Math.floor(timeoutMs / 1000)}s)`,
	);
}
