import { safeGetCvmInfo } from "@phala/cloud";
import type { CommandContext } from "@/src/core/types";
import { type CliApiClient, getClient } from "@/src/lib/client";
import { logger } from "./logger";
import { getRateLimitRetryDelayMs, sleepWithinDeadline } from "./rate-limit";

const CHECK_INTERVAL_MS = 2000;

/** A wait that can no longer succeed; unlike a failed poll, it is not retried. */
class CvmWaitError extends Error {}

/**
 * Wait for CVM to complete any in-progress operations and reach the expected state
 * Progress messages are automatically suppressed in JSON mode.
 *
 * @param cvmId CVM identifier (UUID, app_id, name, or any format accepted by CvmIdSchema)
 * @param timeoutMs Maximum time to wait in milliseconds
 * @param expectedStatus Status that counts as ready (default: running)
 * @returns Promise that resolves when CVM is in expectedStatus and not in_progress, or rejects on timeout.
 * With failOnError, a CVM that settles in error rejects at once; only use it
 * when the CVM cannot start from error (a restart of an error CVM would fail
 * on its first poll, before the restart takes effect).
 */
export async function waitForCvmReady(
	cvmId: string,
	timeoutMs: number,
	context: Pick<CommandContext, "env" | "projectConfig" | "globalOptions">,
	expectedStatus = "running",
	failOnError = false,
): Promise<void> {
	const client = await getClient(context);
	const startTime = Date.now();
	const deadline = startTime + Math.max(0, timeoutMs);
	let rateLimitAttempt = 0;

	logger.info("Waiting for CVM to be ready...");

	// Poll at least once, even when the caller has no budget left.
	do {
		let nextDelayMs = CHECK_INTERVAL_MS;
		try {
			const result = await safeGetCvmInfo(client, { id: cvmId });

			if (!result.success) {
				const retryDelayMs = getRateLimitRetryDelayMs(
					result.error,
					rateLimitAttempt,
				);
				if (retryDelayMs !== undefined) {
					rateLimitAttempt += 1;
					nextDelayMs = retryDelayMs;
					logger.warn("Rate limited while checking CVM status; retrying...");
				} else {
					rateLimitAttempt = 0;
					logger.warn(`Failed to get CVM info: ${result.error.message}`);
				}
			} else {
				rateLimitAttempt = 0;
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
			const retryDelayMs = getRateLimitRetryDelayMs(error, rateLimitAttempt);
			if (retryDelayMs !== undefined) {
				rateLimitAttempt += 1;
				nextDelayMs = retryDelayMs;
				logger.warn("Rate limited while checking CVM status; retrying...");
			} else {
				rateLimitAttempt = 0;
				logger.warn(`Error checking CVM status: ${error}`);
			}
		}

		await sleepWithinDeadline(nextDelayMs, deadline);
	} while (Date.now() < deadline);

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
	const deadline = Date.now() + Math.max(0, timeoutMs);
	let rateLimitAttempt = 0;
	do {
		let nextDelayMs = CHECK_INTERVAL_MS;
		try {
			const remainingMs = Math.max(1, deadline - Date.now());
			const { items } = await client.get<{
				items: Array<{ status: string; error_message?: string | null }>;
			}>(`/cvms/${cvmId}/operations`, {
				params: { correlation_id: correlationId },
				timeout: remainingMs,
			});
			rateLimitAttempt = 0;
			const operation = items[0];
			if (operation?.status === "completed") return;
			if (operation && operation.status !== "in_progress") {
				throw new CvmWaitError(
					`${label} ${operation.status}: ${operation.error_message ?? "no error message"}`,
				);
			}
		} catch (error) {
			if (error instanceof CvmWaitError) throw error;
			if (Date.now() >= deadline) break;
			const retryDelayMs = getRateLimitRetryDelayMs(error, rateLimitAttempt);
			if (retryDelayMs === undefined) throw error;
			rateLimitAttempt += 1;
			nextDelayMs = retryDelayMs;
			logger.warn(
				`Rate limited while checking the ${label.toLowerCase()} operation; retrying...`,
			);
		}
		await sleepWithinDeadline(nextDelayMs, deadline);
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
	const deadline = startedAt + Math.max(0, timeoutMs);
	let rateLimitAttempt = 0;
	let info: Awaited<ReturnType<typeof safeGetCvmInfo>>;
	while (true) {
		info = await safeGetCvmInfo(client, { id: cvmId });
		if (info.success) break;
		const retryDelayMs = getRateLimitRetryDelayMs(info.error, rateLimitAttempt);
		if (retryDelayMs === undefined) break;
		rateLimitAttempt += 1;
		logger.warn("Rate limited while finding the create operation; retrying...");
		await sleepWithinDeadline(retryDelayMs, deadline);
		if (Date.now() >= deadline) {
			throw new Error(
				`Timeout waiting for the create operation to appear (${Math.floor(timeoutMs / 1000)}s)`,
			);
		}
	}
	const progress =
		info.success && "progress" in info.data ? info.data.progress : undefined;
	const correlationId =
		progress &&
		typeof progress === "object" &&
		"correlation_id" in progress &&
		typeof progress.correlation_id === "string"
			? progress.correlation_id
			: undefined;
	if (correlationId) {
		await waitForCvmOperation(
			client,
			cvmId,
			correlationId,
			deadline - Date.now(),
			"Create",
		);
	}
	await waitForCvmReady(cvmId, deadline - Date.now(), context, "running", true);
}
