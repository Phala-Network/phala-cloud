import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";
import { cvmIdArgument, interactiveOption } from "@/src/core/common-flags";

export const cvmsResizeCommandMeta: CommandMeta = {
	name: "resize",
	description: "Resize resources for a CVM",
	stability: "unstable",
	arguments: [cvmIdArgument],
	options: [
		interactiveOption,
		{
			name: "vcpu",
			shorthand: "v",
			description: "Virtual CPUs",
			type: "string",
			target: "vcpu",
		},
		{
			name: "memory",
			shorthand: "m",
			description: "Memory in MB",
			type: "string",
			target: "memory",
		},
		{
			name: "disk-size",
			shorthand: "d",
			description: "Disk size in GB",
			type: "string",
			target: "diskSize",
		},
		{
			name: "allow-restart",
			shorthand: "r",
			description:
				"Deprecated and ignored: the CVM restarts when the resize needs it",
			type: "string",
			target: "allowRestart",
			deprecated: true,
		},
		{
			name: "yes",
			shorthand: "y",
			description: "Skip confirmation",
			type: "boolean",
			target: "yes",
		},
		{
			name: "json",
			description: "Output in JSON format",
			type: "boolean",
			target: "json",
		},
	],
	examples: [
		{
			name: "Resize CVM interactively",
			value: "phala cvms resize",
		},
		{
			name: "Resize without confirmation",
			value:
				"phala cvms resize app_123 --vcpu 4 --memory 4096 --disk-size 120 --yes",
		},
	],
};

export const cvmsResizeCommandSchema = z.object({
	cvmId: z.string().optional(),
	interactive: z.boolean().default(false),
	vcpu: z.string().optional(),
	memory: z.string().optional(),
	diskSize: z.string().optional(),
	allowRestart: z.string().optional(),
	yes: z.boolean().default(false),
	json: z.boolean().default(false),
});

export type CvmsResizeCommandInput = z.infer<typeof cvmsResizeCommandSchema>;
