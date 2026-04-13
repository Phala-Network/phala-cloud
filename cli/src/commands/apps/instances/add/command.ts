import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";
import {
	interactiveOption,
	privateKeyOption,
	rpcUrlOption,
	transactionHashOption,
} from "@/src/core/common-flags";

export const appsInstancesAddCommandMeta: CommandMeta = {
	name: "add",
	description: "Create a new instance under an existing app",
	stability: "unstable",
	arguments: [
		{
			name: "app-id",
			description: "App ID (hex identifier)",
			required: false,
			target: "appId",
		},
	],
	options: [
		{
			name: "node-id",
			aliases: ["teepod-id"],
			description: "Target node ID for the new instance.",
			type: "string",
			target: "nodeId",
		},
		{
			name: "compose-file",
			shorthand: "c",
			description: "Path to Docker Compose file.",
			type: "string",
			target: "composeFile",
		},
		{
			name: "pre-launch-script",
			description: "Path to pre-launch script file.",
			type: "string",
			target: "preLaunchScript",
		},
		{
			name: "env-file",
			shorthand: "e",
			description: "Path to environment file.",
			type: "string",
			target: "envFile",
		},
		privateKeyOption,
		rpcUrlOption,
		{
			name: "prepare-only",
			description:
				"Prepare the instance and generate a commit token. Skips all on-chain operations.",
			type: "boolean",
			target: "prepareOnly",
			group: "advanced",
		},
		{
			name: "commit",
			description:
				"Commit a previously prepared instance using a commit token. Requires --token, --compose-hash, and --transaction-hash.",
			type: "boolean",
			target: "commit",
			group: "advanced",
		},
		{
			name: "token",
			description: "Commit token from a prepare-only request.",
			type: "string",
			target: "token",
			group: "advanced",
		},
		{
			name: "compose-hash",
			description: "Compose hash to use (existing revision).",
			type: "string",
			target: "composeHash",
		},
		transactionHashOption,
		interactiveOption,
	],
	examples: [
		{
			name: "Add instance with existing compose",
			value: "phala apps instances add <app-id> --node-id 5",
		},
		{
			name: "Add instance with new Docker Compose",
			value:
				"phala apps instances add <app-id> --node-id 5 --compose-file docker-compose.yml",
		},
		{
			name: "Prepare for multisig approval",
			value:
				"phala apps instances add <app-id> --node-id 5 --compose-file docker-compose.yml --prepare-only",
		},
		{
			name: "Commit a prepared instance",
			value:
				"phala apps instances add <app-id> --commit --token <token> --compose-hash <hash> --transaction-hash <tx-hash>",
		},
	],
};

export const appsInstancesAddCommandSchema = z.object({
	appId: z.string().optional(),
	nodeId: z.string().optional(),
	composeFile: z.string().optional(),
	preLaunchScript: z.string().optional(),
	envFile: z.string().optional(),
	privateKey: z.string().optional(),
	rpcUrl: z.string().optional(),
	prepareOnly: z.boolean().default(false),
	commit: z.boolean().default(false),
	token: z.string().optional(),
	composeHash: z.string().optional(),
	transactionHash: z.string().optional(),
	interactive: z.boolean().default(false),
});

export type AppsInstancesAddCommandInput = z.infer<
	typeof appsInstancesAddCommandSchema
>;
