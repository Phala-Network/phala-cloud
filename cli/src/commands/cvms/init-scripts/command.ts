import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";
import {
	cvmIdArgument,
	interactiveOption,
	jsonOption,
	privateKeyOption,
	rpcUrlOption,
	transactionHashOption,
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
		{
			name: "prepare-only",
			description:
				"Prepare the update and print the compose hash. Skips on-chain operations.",
			type: "boolean",
			target: "prepareOnly",
			group: "advanced",
		},
		{
			name: "compose-hash",
			description: "Compose hash from a prepare-only update",
			type: "string",
			target: "composeHash",
			group: "advanced",
		},
		transactionHashOption,
		privateKeyOption,
		rpcUrlOption,
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
	prepareOnly: z.boolean().default(false),
	composeHash: z.string().optional(),
	transactionHash: z.string().optional(),
	privateKey: z.string().optional(),
	rpcUrl: z.string().optional(),
	json: z.boolean().default(false),
	interactive: z.boolean().default(false),
});

export type CvmsInitScriptsCommandInput = z.infer<
	typeof cvmsInitScriptsCommandSchema
>;
