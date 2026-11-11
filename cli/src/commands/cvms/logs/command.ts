import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";
import { cvmIdArgument, interactiveOption } from "@/src/core/common-flags";
import { jsonOption } from "@/src/commands/status/command";

export const cvmsLogsCommandMeta: CommandMeta = {
	name: "logs",
	description: "Fetch container logs from a CVM",
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
		{
			name: "container",
			shorthand: "c",
			description: "Container name or ID (defaults to first)",
			type: "string",
			target: "container",
		},
		jsonOption,
		interactiveOption,
	],
	examples: [
		{
			name: "Show container logs from a CVM",
			value: "phala cvms logs app_abc123",
		},
		{
			name: "Show last 100 lines of logs",
			value: "phala cvms logs app_abc123 --tail 100",
		},
		{
			name: "Follow logs in real-time",
			value: "phala cvms logs app_abc123 --follow",
		},
		{
			name: "Show logs from a specific container",
			value: "phala cvms logs app_abc123 --container my-service",
		},
		{
			name: "Show logs with timestamps",
			value: "phala cvms logs app_abc123 --timestamps",
		},
	],
};

export const cvmsLogsCommandSchema = z.object({
	cvmId: z.string().optional(),
	tail: z
		.union([z.literal("all"), z.coerce.number().int().nonnegative()])
		.optional(),
	follow: z.boolean().default(false),
	timestamps: z.boolean().default(false),
	container: z.string().optional(),
	json: z.boolean().default(false),
	interactive: z.boolean().default(false),
});

export type CvmsLogsCommandInput = z.infer<typeof cvmsLogsCommandSchema>;
