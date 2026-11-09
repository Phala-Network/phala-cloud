import { CvmIdSchema } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	fetchContainerLogsEntries,
	streamContainerLogsEntries,
	fetchCvmChannelLogs,
	streamCvmChannelLogs,
	getCvmStatus,
	type ContainerLogsOptions,
	type CvmLogChannel,
	type LogEntry,
} from "@/src/api/cvms";
import { logger, setJsonMode } from "@/src/utils/logger";
import { checkAndWarnIfLogsDisabled } from "@/src/commands/cvms/logs-handler";
import { resolveLogTimeWindow, type LogTimeWindow } from "./time-window";
import {
	logsCommandMeta,
	logsCommandSchema,
	type LogsCommandInput,
} from "./command";

function writeLogEntry(
	entry: LogEntry,
	config: { includeStdout: boolean; includeStderr: boolean },
	context: Pick<CommandContext, "stdout" | "stderr">,
): void {
	const message = entry.message === "" ? "\n" : entry.message;
	if (entry.channel === "stdout") {
		if (config.includeStdout) {
			context.stdout.write(message);
		}
		return;
	}

	if (config.includeStderr) {
		context.stderr.write(message);
	}
}

type LogMode =
	| { type: "container"; containerName?: string }
	| { type: "cvm"; channel: CvmLogChannel };

function resolveExplicitMode(input: LogsCommandInput): LogMode | null {
	const cvmFlags = [
		input.serial && "serial",
		input.cvmStdout && "stdout",
		input.cvmStderr && "stderr",
	].filter(Boolean) as CvmLogChannel[];

	if (cvmFlags.length > 1) {
		return null; // caller will error
	}

	if (cvmFlags.length === 1) {
		return { type: "cvm", channel: cvmFlags[0] };
	}

	if (input.containerName) {
		return { type: "container", containerName: input.containerName };
	}

	return null; // no explicit mode — needs auto-detection
}

async function runLogsCommand(
	input: LogsCommandInput,
	context: CommandContext,
): Promise<number> {
	setJsonMode(input.json);

	if (!context.cvmId) {
		context.fail(
			"No CVM ID provided. Use --interactive to select interactively.",
		);
		return 1;
	}

	const { cvmId: appId } = CvmIdSchema.parse(context.cvmId);

	// --- Validate mutual exclusivity ---

	const cvmFlagCount = [input.serial, input.cvmStdout, input.cvmStderr].filter(
		Boolean,
	).length;

	if (cvmFlagCount > 1) {
		context.fail(
			"--serial, --cvm-stdout, and --cvm-stderr are mutually exclusive",
		);
		return 1;
	}

	const hasCvmFlag = cvmFlagCount === 1;

	if (input.containerName && hasCvmFlag) {
		context.fail(
			"Cannot combine container name with --serial/--cvm-stdout/--cvm-stderr. " +
				"Use container name for container logs, or CVM flags for CVM-level logs.",
		);
		return 1;
	}

	if (input.stderr && hasCvmFlag) {
		context.fail(
			"--stderr is only valid in container mode, not with CVM flags",
		);
		return 1;
	}

	// --- Determine mode ---

	let mode = resolveExplicitMode(input);
	if (mode?.type === "cvm") {
		const unsupportedOptions = [
			input.timestamps && "--timestamps",
			input.since !== undefined && "--since",
			input.until !== undefined && "--until",
		].filter((option): option is string => Boolean(option));
		if (unsupportedOptions.length > 0) {
			context.fail(
				`${unsupportedOptions.join(", ")} not supported for serial/stdout/stderr logs`,
			);
			return 1;
		}
	}

	let timeWindow: LogTimeWindow;
	try {
		timeWindow = resolveLogTimeWindow(input.since, input.until, Date.now());
	} catch (error) {
		context.fail(error instanceof Error ? error.message : String(error));
		return 1;
	}

	if (
		!mode &&
		(input.timestamps || input.since !== undefined || input.until !== undefined)
	) {
		mode = { type: "container" };
	}

	if (!mode) {
		// Auto-detect based on CVM status
		try {
			const status = await getCvmStatus(appId);
			if (status === "running") {
				mode = { type: "container" };
			} else {
				logger.warn(`CVM is ${status}. Falling back to serial console logs.`);
				logger.warn(
					"Use --serial, --cvm-stdout, or --cvm-stderr for specific CVM channels.",
				);
				mode = { type: "cvm", channel: "serial" };
			}
		} catch {
			// If we can't get status, try container mode as default
			mode = { type: "container" };
		}
	}

	// --- Execute ---

	if (mode.type === "cvm") {
		return runCvmMode(appId, mode.channel, input, context);
	}

	return runContainerMode(
		appId,
		mode.containerName,
		input,
		context,
		timeWindow,
	);
}

async function runCvmMode(
	appId: string,
	channel: CvmLogChannel,
	input: LogsCommandInput,
	context: CommandContext,
): Promise<number> {
	const unsupportedOptions = [
		input.timestamps && "--timestamps",
		input.since !== undefined && "--since",
		input.until !== undefined && "--until",
	].filter((option): option is string => Boolean(option));
	if (unsupportedOptions.length > 0) {
		context.fail(
			`${unsupportedOptions.join(", ")} not supported for serial/stdout/stderr logs`,
		);
		return 1;
	}

	try {
		if (input.follow) {
			if (input.json) {
				context.fail("Cannot use --json with --follow");
				return 1;
			}

			const abortController = new AbortController();
			const cleanup = () => abortController.abort();

			process.on("SIGINT", cleanup);
			process.on("SIGTERM", cleanup);

			try {
				await streamCvmChannelLogs(
					appId,
					channel,
					(data) => context.stdout.write(data),
					{
						tail: input.tail,
					},
					abortController.signal,
				);
			} catch (error) {
				if ((error as Error).name !== "AbortError") {
					throw error;
				}
			} finally {
				process.removeListener("SIGINT", cleanup);
				process.removeListener("SIGTERM", cleanup);
			}

			return 0;
		}

		const logs = await fetchCvmChannelLogs(appId, channel, {
			tail: input.tail,
		});

		if (input.json) {
			context.success({ logs, cvm_id: appId, channel });
			return 0;
		}

		if (logs.length > 0) {
			context.stdout.write(logs);
		} else {
			logger.info(`No ${channel} logs available`);
		}

		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: `Fetch CVM ${channel} logs`,
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}
}

async function runContainerMode(
	appId: string,
	containerName: string | undefined,
	input: LogsCommandInput,
	context: CommandContext,
	timeWindow: LogTimeWindow,
): Promise<number> {
	const outputConfig = {
		includeStdout: true,
		includeStderr: input.stderr,
	};

	const options: ContainerLogsOptions = {
		container: containerName,
		since: timeWindow.since,
		until: timeWindow.until,
		tail: input.tail,
		timestamps: input.timestamps,
		matchContainerIdPrefix: false,
	};

	try {
		if (input.follow) {
			if (input.json) {
				context.fail("Cannot use --json with --follow");
				return 1;
			}

			const abortController = new AbortController();
			const cleanup = () => abortController.abort();

			process.on("SIGINT", cleanup);
			process.on("SIGTERM", cleanup);

			try {
				await streamContainerLogsEntries(
					appId,
					(entry) => writeLogEntry(entry, outputConfig, context),
					options,
					abortController.signal,
				);
			} catch (error) {
				if ((error as Error).name !== "AbortError") {
					throw error;
				}
			} finally {
				process.removeListener("SIGINT", cleanup);
				process.removeListener("SIGTERM", cleanup);
			}

			return 0;
		}

		const entries = await fetchContainerLogsEntries(appId, options);
		const filteredEntries = entries.filter((e) =>
			e.channel === "stderr"
				? outputConfig.includeStderr
				: outputConfig.includeStdout,
		);
		const combined = filteredEntries
			.map((entry) => (entry.message === "" ? "\n" : entry.message))
			.join("");

		if (input.json) {
			context.success({ logs: combined, cvm_id: appId });
			return 0;
		}

		if (combined.length > 0) {
			for (const entry of filteredEntries) {
				writeLogEntry(entry, outputConfig, context);
			}
			return 0;
		}

		const logsDisabled = await checkAndWarnIfLogsDisabled(appId);
		if (!logsDisabled) {
			logger.info("No logs available");
		}
		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Fetch container logs",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		await checkAndWarnIfLogsDisabled(appId);
		return 1;
	}
}

export const logsCommand = defineCommand({
	path: ["logs"],
	meta: logsCommandMeta,
	schema: logsCommandSchema,
	handler: runLogsCommand,
});

export default logsCommand;
