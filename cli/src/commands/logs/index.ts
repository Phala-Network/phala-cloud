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
	if (entry.channel === "stdout") {
		if (config.includeStdout) {
			context.stdout.write(entry.message);
		}
		return;
	}

	if (config.includeStderr) {
		context.stderr.write(entry.message);
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

	return runContainerMode(appId, mode.containerName, input, context);
}

async function runCvmMode(
	appId: string,
	channel: CvmLogChannel,
	input: LogsCommandInput,
	context: CommandContext,
): Promise<number> {
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
						timestamps: input.timestamps,
						since: input.since,
						until: input.until,
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
			timestamps: input.timestamps,
			since: input.since,
			until: input.until,
		});

		if (input.json) {
			context.success({ logs, cvm_id: appId, channel });
			return 0;
		}

		if (logs.trim()) {
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
): Promise<number> {
	const outputConfig = {
		includeStdout: true,
		includeStderr: input.stderr,
	};

	const options: ContainerLogsOptions = {
		container: containerName,
		since: input.since,
		until: input.until,
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
		const combined = filteredEntries.map((e) => e.message).join("");

		if (input.json) {
			context.success({ logs: combined, cvm_id: appId });
			return 0;
		}

		if (combined.trim()) {
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
