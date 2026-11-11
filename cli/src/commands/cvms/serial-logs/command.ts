import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";
import { cvmIdArgument, interactiveOption } from "@/src/core/common-flags";
import { jsonOption } from "@/src/commands/status/command";

export const cvmsSerialLogsCommandMeta: CommandMeta = {
	name: "serial-logs",
	description: "Fetch VM serial console logs from a CVM",
	stability: "deprecated",
	arguments: [cvmIdArgument],
	options: [
		{
			name: "tail",
			shorthand: "n",
			description: "Number of lines from the end, or all",
			type: "string",
			target: "tail",
			argumentName: "lines",
		},
		{
			name: "follow",
			shorthand: "f",
			description: "Stream logs in real-time",
			type: "boolean",
			target: "follow",
		},
		{
			name: "timestamps",
			shorthand: "t",
			description: "Show timestamps",
			type: "boolean",
			target: "timestamps",
		},
		jsonOption,
		interactiveOption,
	],
	examples: [
		{
			name: "Show VM serial logs",
			value: "phala cvms serial-logs app_abc123",
		},
		{
			name: "Show last 100 lines of serial logs",
			value: "phala cvms serial-logs app_abc123 --tail 100",
		},
		{
			name: "Follow serial logs in real-time",
			value: "phala cvms serial-logs app_abc123 --follow",
		},
		{
			name: "Show last 100 lines of serial logs",
			value: "phala cvms serial-logs app_abc123 --tail 100",
		},
	],
};

export const cvmsSerialLogsCommandSchema = z.object({
	cvmId: z.string().optional(),
	tail: z
		.union([z.literal("all"), z.coerce.number().int().nonnegative()])
		.optional(),
	follow: z.boolean().default(false),
	timestamps: z.boolean().default(false),
	json: z.boolean().default(false),
	interactive: z.boolean().default(false),
});

export type CvmsSerialLogsCommandInput = z.infer<
	typeof cvmsSerialLogsCommandSchema
>;
