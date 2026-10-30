import {
	interactiveOption,
	privateKeyOption,
	rpcUrlOption,
	transactionHashOption,
} from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";
import { z } from "zod";

export const instancesAddCommandMeta: CommandMeta = {
	name: "add",
	description: "Create a new instance under an existing app",
	stability: "unstable",
	options: [
		{
			name: "app-id",
			description: "App ID (hex identifier). Defaults to app_id in phala.toml.",
			type: "string",
			target: "appId",
		},
		{
			name: "name",
			description: "Custom CVM name for the new instance.",
			type: "string",
			target: "name",
		},
		{
			name: "node",
			description: "Physical node name for the new instance.",
			type: "string",
			target: "node",
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
			value: "phala instances add --app-id <app-id> --node usw5",
		},
		{
			name: "Add instance with custom name",
			value: "phala instances add --app-id <app-id> --name redis-0 --node usw5",
		},
		{
			name: "Add instance with new Docker Compose",
			value:
				"phala instances add --app-id <app-id> --node usw5 --compose-file docker-compose.yml",
		},
		{
			name: "Prepare for multisig approval",
			value:
				"phala instances add --app-id <app-id> --node usw5 --compose-file docker-compose.yml --prepare-only",
		},
		{
			name: "Commit a prepared instance",
			value:
				"phala instances add --app-id <app-id> --commit --token <token> --compose-hash <hash> --transaction-hash <tx-hash>",
		},
	],
};

export const instancesAddCommandSchema = z.object({
	appId: z.string().optional(),
	name: z.string().optional(),
	node: z.string().min(1).optional(),
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

export type InstancesAddCommandInput = z.infer<
	typeof instancesAddCommandSchema
>;
