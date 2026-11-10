import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";
import { cvmIdOption, interactiveOption } from "@/src/core/common-flags";
import { jsonOption } from "@/src/commands/status/command";

export const logsCommandMeta: CommandMeta = {
	name: "logs",
	category: "cvm-ops",
	description: "Fetch logs from a CVM",
	stability: "unstable",
	arguments: [
		{
			name: "container-name",
			description: "Container name to fetch logs from",
			required: false,
			target: "containerName",
		},
	],
	options: [
		{
			name: "serial",
			description: "CVM serial console (boot, kernel, docker-compose)",
			type: "boolean",
			target: "serial",
		},
		{
			name: "cvm-stdout",
			description: "CVM stdout channel",
			type: "boolean",
			target: "cvmStdout",
		},
		{
			name: "cvm-stderr",
			description: "CVM stderr channel",
			type: "boolean",
			target: "cvmStderr",
		},
		{
			name: "stderr",
			description: "Include container stderr (container mode only)",
			type: "boolean",
			target: "stderr",
		},
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
			description: "Stream in real-time",
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
			name: "since",
			description: "Start time (RFC3339, Unix seconds, or relative, e.g. 42m)",
			type: "string",
			target: "since",
			argumentName: "since",
		},
		{
			name: "until",
			description: "End time (RFC3339, Unix seconds, or relative)",
			type: "string",
			target: "until",
			argumentName: "until",
		},
		cvmIdOption,
		jsonOption,
		interactiveOption,
	],
	examples: [
		{
			name: "Container stdout",
			value: "phala logs my-service",
		},
		{
			name: "Container stderr",
			value: "phala logs my-service --stderr",
		},
		{
			name: "Follow container logs",
			value: "phala logs my-service -f",
		},
		{
			name: "CVM serial console",
			value: "phala logs --serial",
		},
		{
			name: "CVM stdout channel",
			value: "phala logs --cvm-stdout",
		},
		{
			name: "CVM stderr channel",
			value: "phala logs --cvm-stderr",
		},
		{
			name: "Last 100 lines",
			value: "phala logs my-service -n 100",
		},
		{
			name: "All available lines",
			value: "phala logs my-service -n all",
		},
		{
			name: "Specify CVM",
			value: "phala logs my-service --cvm-id app_abc123",
		},
	],
};

export const logsCommandSchema = z.object({
	containerName: z.string().optional(),
	cvmId: z.string().optional(),
	serial: z.boolean().default(false),
	cvmStdout: z.boolean().default(false),
	cvmStderr: z.boolean().default(false),
	stderr: z.boolean().default(false),
	since: z.string().optional(),
	until: z.string().optional(),
	tail: z.union([z.literal("all"), z.coerce.number().int().nonnegative()]).optional(),
	follow: z.boolean().default(false),
	timestamps: z.boolean().default(false),
	json: z.boolean().default(false),
	interactive: z.boolean().default(false),
});

export type LogsCommandInput = z.infer<typeof logsCommandSchema>;
