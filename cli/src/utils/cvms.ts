import { safeGetCvmInfo } from "@phala/cloud";
import type { CommandContext } from "@/src/core/types";
import { type CliApiClient, getClient } from "@/src/lib/client";
import { logger } from "./logger";

/** A wait that can no longer succeed; unlike a failed poll, it is not retried. */
class CvmWaitError extends Error {}

/**
 * Wait for CVM to complete any in-progress operations and reach the expected state
 * Progress messages are automatically suppressed in JSON mode.
 *
 * @param cvmId CVM identifier (UUID, app_id, name, or any format accepted by CvmIdSchema)
 * @param timeoutMs Maximum time to wait in milliseconds (default: 5 minutes)
 * @param expectedStatus Status that counts as ready (default: running)
 * @returns Promise that resolves when CVM is in expectedStatus and not in_progress, or rejects on timeout.
 * With failOnError, a CVM that settles in error rejects at once; only use it
 * when the CVM cannot start from error (a restart of an error CVM would fail
 * on its first poll, before the restart takes effect).
 */
export async function waitForCvmReady(
	cvmId: string,
	timeoutMs = 300000, // 5 minutes default
	context?: Pick<CommandContext, "env" | "projectConfig" | "globalOptions">,
	expectedStatus = "running",
	failOnError = false,
): Promise<void> {
	const client = await getClient(context);
	const startTime = Date.now();
	const checkIntervalMs = 2000; // Check every 2 seconds

	logger.info("Waiting for CVM to be ready...");

	// Poll at least once, even when the caller has no budget left.
	do {
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
				if (failOnError && currentStatus === "error" && !inProgress) {
					throw new CvmWaitError("CVM is in error state");
				}
			}
		} catch (error) {
			if (error instanceof CvmWaitError) throw error;
			logger.warn(`Error checking CVM status: ${error}`);
		}

		// Wait before next check
		await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
	} while (Date.now() - startTime < timeoutMs);

	throw new Error(
		`Timeout waiting for CVM to be ready (${Math.max(0, Math.floor(timeoutMs / 1000))}s)`,
	);
}

/**
 * Wait for a CVM operation (update, create) to finish, and fail unless it
 * completed. The CVM state alone cannot tell a finished operation from a
 * failed one, and a failure may leave the CVM in a different state than
 * before (a boot failure leaves a running CVM stopped), so wait for the
 * operation first.
 */
export async function waitForCvmOperation(
	client: CliApiClient,
	cvmId: string,
	correlationId: string,
	timeoutMs: number,
	label: "Update" | "Create" = "Update",
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
				`${label} ${operation.status}: ${operation.error_message ?? "no error message"}`,
			);
		}
		await new Promise((resolve) => setTimeout(resolve, 2000));
	} while (Date.now() < deadline);
	throw new Error(
		`Timeout waiting for the ${label.toLowerCase()} operation to finish (${Math.floor(timeoutMs / 1000)}s)`,
	);
}

/**
 * Wait until a CVM that was just created is running. The create operation is
 * followed first, so a failed boot surfaces its error message; the correlation
 * id comes from the CVM's progress, which commit does not return. A CVM
 * without a running operation is checked by its status alone.
 */
export async function waitForCvmCreated(
	client: CliApiClient,
	cvmId: string,
	context: Pick<CommandContext, "env" | "projectConfig" | "globalOptions">,
	timeoutMs: number,
): Promise<void> {
	const startedAt = Date.now();
	const info = await safeGetCvmInfo(client, { id: cvmId });
	const correlationId = info.success
		? info.data.progress?.correlation_id
		: undefined;
	if (correlationId) {
		await waitForCvmOperation(
			client,
			cvmId,
			correlationId,
			timeoutMs,
			"Create",
		);
	}
	await waitForCvmReady(
		cvmId,
		timeoutMs - (Date.now() - startedAt),
		context,
		"running",
		true,
	);
}
