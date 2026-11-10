import { defineCommand } from "@/src/core/define-command";
import { fetchSerialLogs, streamSerialLogs } from "@/src/api/cvms";
import { createLogsHandler } from "../logs-handler";
import {
	cvmsSerialLogsCommandMeta,
	cvmsSerialLogsCommandSchema,
	type CvmsSerialLogsCommandInput,
} from "./command";

const runCvmsSerialLogsCommand = createLogsHandler<
	CvmsSerialLogsCommandInput,
	{ tail?: number | "all"; timestamps?: boolean }
>(
	{
		logType: "serial",
		fetchLogs: fetchSerialLogs,
		streamLogs: streamSerialLogs,
	},
	(input) => ({
		tail: input.tail,
		timestamps: input.timestamps,
	}),
);

export const cvmsSerialLogsCommand = defineCommand({
	path: ["cvms", "serial-logs"],
	meta: cvmsSerialLogsCommandMeta,
	schema: cvmsSerialLogsCommandSchema,
	handler: runCvmsSerialLogsCommand,
});

export default cvmsSerialLogsCommand;
