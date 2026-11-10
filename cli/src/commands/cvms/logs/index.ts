import { defineCommand } from "@/src/core/define-command";
import {
	fetchContainerLogsEntries,
	streamContainerLogsEntries,
} from "@/src/api/cvms";
import { createLogsHandler } from "../logs-handler";
import {
	cvmsLogsCommandMeta,
	cvmsLogsCommandSchema,
	type CvmsLogsCommandInput,
} from "./command";

const runCvmsLogsCommand = createLogsHandler<
	CvmsLogsCommandInput,
	{
		tail?: number | "all";
		timestamps?: boolean;
		container?: string;
		matchContainerIdPrefix?: boolean;
	}
>(
	{
		logType: "container",
		fetchLogs: async (appId, options) => {
			const entries = await fetchContainerLogsEntries(appId, options);
			return entries
				.map((entry) => (entry.message === "" ? "\n" : entry.message))
				.join("");
		},
		streamLogs: async (appId, onData, options, signal) => {
			await streamContainerLogsEntries(
				appId,
				(entry) => {
					const message = entry.message === "" ? "\n" : entry.message;
					if (entry.channel === "stderr") {
						process.stderr.write(message);
					} else {
						onData(message);
					}
				},
				options,
				signal,
			);
		},
	},
	(input) => ({
		tail: input.tail,
		timestamps: input.timestamps,
		container: input.container,
		matchContainerIdPrefix: false,
	}),
);

export const cvmsLogsCommand = defineCommand({
	path: ["cvms", "logs"],
	meta: cvmsLogsCommandMeta,
	schema: cvmsLogsCommandSchema,
	handler: runCvmsLogsCommand,
});

export default cvmsLogsCommand;
