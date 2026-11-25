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

export const cvmsInitScriptsCommandMeta: CommandMeta = {
	name: "init-scripts",
	description:
		"Show or change the init scripts provided by Phala Cloud that a CVM runs",
	stability: "unstable",
	arguments: [
		cvmIdArgument,
		{
			name: "name",
			description:
				"Init script provided by Phala Cloud. Leave out to list what is available.",
			required: false,
			target: "name",
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
			description:
				"Continue when the CVM also runs init scripts set by Phala Cloud support",
			type: "boolean",
			target: "yes",
		},
		{
			name: "confirm-data-wipe",
			description:
				"Confirm turning on an init script that erases or stops using existing data on disk",
			type: "boolean",
			target: "confirmDataWipe",
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
			name: "Turn runtime_tmpfs on",
			value:
				"phala cvms init-scripts app_123 runtime_tmpfs on --confirm-data-wipe",
		},
		{
			name: "Turn env_merge off",
			value: "phala cvms init-scripts app_123 env_merge off",
		},
	],
};

export const cvmsInitScriptsCommandSchema = z.object({
	cvmId: z.string().optional(),
	name: z.string().optional(),
	state: z.string().optional(),
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
