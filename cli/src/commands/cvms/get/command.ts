import { jsonOption } from "@/src/commands/status/command";
import { cvmIdArgument, interactiveOption } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";
import { z } from "zod";

export const cvmsGetCommandMeta: CommandMeta = {
	name: "get",
	description: "Get details of a CVM",
	stability: "unstable",
	arguments: [cvmIdArgument],
	options: [
		jsonOption,
		interactiveOption,
		{
			name: "include-compose",
			type: "boolean",
			description: "Include the compose configuration",
		},
	],
	examples: [
		{
			name: "Get CVM interactively",
			value: "phala cvms get",
		},
		{
			name: "By app_id",
			value: "phala cvms get app_abc123",
		},
		{
			name: "By UUID",
			value: "phala cvms get 550e8400-e29b-41d4-a716-446655440000",
		},
		{
			name: "By name",
			value: "phala cvms get my-app",
		},
	],
};

export const cvmsGetCommandSchema = z.object({
	cvmId: z.string().optional(),
	json: z.boolean().default(false),
	includeCompose: z.boolean().default(false),
	interactive: z.boolean().default(false),
});

export type CvmsGetCommandInput = z.infer<typeof cvmsGetCommandSchema>;
