import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";
import {
	cvmIdArgument,
	interactiveOption,
	jsonOption,
} from "@/src/core/common-flags";
import { INIT_SCRIPT_SLUGS } from "@/src/commands/deploy/command";

export const cvmsInitScriptsCommandMeta: CommandMeta = {
	name: "init-scripts",
	description: "Show or change the platform init scripts a CVM runs",
	stability: "unstable",
	arguments: [
		cvmIdArgument,
		{
			name: "slug",
			description: `Platform init script (${INIT_SCRIPT_SLUGS.join(", ")})`,
			required: false,
			target: "slug",
		},
		{
			name: "state",
			description: "on or off",
			required: false,
			target: "state",
		},
	],
	options: [
		jsonOption,
		interactiveOption,
		{
			name: "yes",
			shorthand: "y",
			description: "Replace custom init scripts without asking",
			type: "boolean",
			target: "yes",
		},
		{
			name: "confirm-data-wipe",
			description:
				"Confirm turning on docker_cleanup, which erases container stores on every boot",
			type: "boolean",
			target: "confirmDataWipe",
		},
		{
			name: "file",
			description:
				"Raw init script file to send (repeatable, max 5). Admins only.",
			type: "string[]",
			target: "file",
			hidden: true,
		},
	],
	examples: [
		{
			name: "List init scripts",
			value: "phala cvms init-scripts app_123",
		},
		{
			name: "Turn docker_cleanup on",
			value:
				"phala cvms init-scripts app_123 docker_cleanup on --confirm-data-wipe",
		},
		{
			name: "Turn env_merge off",
			value: "phala cvms init-scripts app_123 env_merge off",
		},
	],
};

export const cvmsInitScriptsCommandSchema = z.object({
	cvmId: z.string().optional(),
	slug: z.string().optional(),
	state: z.string().optional(),
	file: z.array(z.string()).optional(),
	yes: z.boolean().default(false),
	confirmDataWipe: z.boolean().default(false),
	json: z.boolean().default(false),
	interactive: z.boolean().default(false),
});

export type CvmsInitScriptsCommandInput = z.infer<
	typeof cvmsInitScriptsCommandSchema
>;
