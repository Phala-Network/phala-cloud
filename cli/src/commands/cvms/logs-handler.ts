import { CvmIdSchema, safeGetCvmInfo } from "@phala/cloud";
import type { CommandContext } from "@/src/core/types";
import { logger } from "@/src/utils/logger";
import { getClient } from "@/src/lib/client";

/**
 * Check if logs are disabled for a CVM and warn the user if so.
 * @returns true if logs are disabled, false otherwise
 */
export async function checkAndWarnIfLogsDisabled(
	appId: string,
	context?: Pick<CommandContext, "env" | "projectConfig" | "globalOptions">,
): Promise<boolean> {
	try {
		const client = await getClient(context);
		const result = await safeGetCvmInfo(client, { id: appId });
		if (result.success && result.data.public_logs === false) {
			logger.warn("Logs are disabled for this CVM (public_logs=false).");
			logger.warn("To enable logs, run:");
			logger.warn(`  phala deploy --cvm-id ${appId} --public-logs`);
			return true;
		}
	} catch (e) {
		logger.debug?.(`Failed to check CVM info: ${e}`);
	}
	return false;
}

export interface LogsHandlerConfig<TOptions> {
	logType: "container" | "serial";
	fetchLogs: (appId: string, options: TOptions) => Promise<string>;
	streamLogs: (
		appId: string,
		onData: (data: string) => void,
		options: TOptions,
		signal?: AbortSignal,
	) => Promise<void>;
}

export interface BaseLogsInput {
	json?: boolean;
	follow?: boolean;
	tail?: number;
	timestamps?: boolean;
}

/**
 * Create a logs command handler with shared logic
 */
export function createLogsHandler<TInput extends BaseLogsInput, TOptions>(
	config: LogsHandlerConfig<TOptions>,
	buildOptions: (input: TInput) => TOptions,
) {
	return async function handler(
		input: TInput,
		context: CommandContext,
	): Promise<number> {
		if (!context.cvmId) {
			context.fail(
				"No CVM ID provided. Use --interactive to select interactively.",
			);
			return 1;
		}

		// Normalize CVM ID using SDK schema (adds app_ prefix to 40-char hex, etc.)
		const { cvmId: appId } = CvmIdSchema.parse(context.cvmId);

		const options = buildOptions(input);
		const logTypeName = config.logType === "serial" ? "serial" : "container";

		try {
			if (input.follow) {
				if (input.json) {
					context.fail("Cannot use --json with --follow");
					return 1;
				}

				logger.info(`Streaming ${logTypeName} logs (press Ctrl+C to stop)...`);
				logger.break();

				const abortController = new AbortController();
				let interrupted = false;

				const cleanup = () => {
					interrupted = true;
					abortController.abort();
				};

				process.on("SIGINT", cleanup);
				process.on("SIGTERM", cleanup);

				try {
					await config.streamLogs(
						appId,
						(data) => process.stdout.write(data),
						options,
						abortController.signal,
					);
				} catch (error) {
					if ((error as Error).name === "AbortError") {
						// Expected when user interrupts
					} else {
						throw error;
					}
				} finally {
					process.removeListener("SIGINT", cleanup);
					process.removeListener("SIGTERM", cleanup);
				}

				if (interrupted) {
					logger.break();
					logger.info("Stopped streaming logs");
				}

				return 0;
			}

			// Non-streaming mode - no spinner to support piping (e.g., phala cvms logs xx | grep foo)
			const logs = await config.fetchLogs(appId, options);

			if (input.json) {
				context.success({ logs, cvm_id: appId });
				return 0;
			}

			if (logs.trim()) {
				console.log(logs);
			} else {
				const logsDisabled = await checkAndWarnIfLogsDisabled(appId, context);
				if (!logsDisabled) {
					logger.info("No logs available");
				}
			}

			return 0;
		} catch (error) {
			context.failWithError(error, {
				operation: `Fetch ${logTypeName} logs`,
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			await checkAndWarnIfLogsDisabled(appId, context);
			return 1;
		}
	};
}
