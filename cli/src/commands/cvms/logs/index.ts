import { defineCommand } from "@/src/core/define-command";
import { fetchContainerLogs, streamContainerLogs } from "@/src/api/cvms";
import { createLogsHandler } from "../logs-handler";
import {
	cvmsLogsCommandMeta,
	cvmsLogsCommandSchema,
	type CvmsLogsCommandInput,
} from "./command";

const runCvmsLogsCommand = createLogsHandler<
	CvmsLogsCommandInput,
	{ tail?: number | "all"; timestamps?: boolean; container?: string }
>(
	{
		logType: "container",
		fetchLogs: fetchContainerLogs,
		streamLogs: streamContainerLogs,
	},
	(input) => ({
		tail: input.tail,
		timestamps: input.timestamps,
		container: input.container,
	}),
);

export const cvmsLogsCommand = defineCommand({
	path: ["cvms", "logs"],
	meta: cvmsLogsCommandMeta,
	schema: cvmsLogsCommandSchema,
	handler: runCvmsLogsCommand,
});

export default cvmsLogsCommand;
