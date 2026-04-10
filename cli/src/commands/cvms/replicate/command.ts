import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";
import {
	cvmIdArgument,
	interactiveOption,
	privateKeyOption,
	rpcUrlOption,
	transactionHashOption,
} from "@/src/core/common-flags";

export const cvmsReplicateCommandMeta: CommandMeta = {
	name: "replicate",
	description: "Create a replica of an existing CVM",
	stability: "unstable",
	arguments: [cvmIdArgument],
	options: [
		{
			name: "node-id",
			aliases: ["teepod-id"],
			description: "Target node ID for the replica.",
			type: "string",
			target: "nodeId",
		},
		{
			name: "compose-hash",
			description:
				"Compose hash to replicate. Required when the source app has multiple live instances.",
			type: "string",
			target: "composeHash",
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
				"Prepare the replica and generate a commit token. Skips all on-chain operations.",
			type: "boolean",
			target: "prepareOnly",
			group: "advanced",
		},
		{
			name: "commit",
			description:
				"Commit a previously prepared replica using a commit token. Requires --token, --compose-hash, and --transaction-hash.",
			type: "boolean",
			target: "commit",
			group: "advanced",
		},
		{
			name: "token",
			description: "Commit token from a prepare-only replica request.",
			type: "string",
			target: "token",
			group: "advanced",
		},
		transactionHashOption,
		interactiveOption,
	],
	examples: [
		{
			name: "Replicate a CVM",
			value: "phala cvms replicate 1234 --node-id 5",
		},
		{
			name: "Prepare a replica for multisig approval",
			value:
				"phala cvms replicate 1234 --node-id 5 --compose-hash <hash> --prepare-only",
		},
		{
			name: "Commit a prepared replica",
			value:
				"phala cvms replicate 1234 --commit --token <token> --compose-hash <hash> --transaction-hash <tx-hash>",
		},
	],
};

export const cvmsReplicateCommandSchema = z.object({
	cvmId: z.string().optional(),
	nodeId: z.string().optional(),
	composeHash: z.string().optional(),
	envFile: z.string().optional(),
	privateKey: z.string().optional(),
	rpcUrl: z.string().optional(),
	prepareOnly: z.boolean().default(false),
	commit: z.boolean().default(false),
	token: z.string().optional(),
	transactionHash: z.string().optional(),
	interactive: z.boolean().default(false),
});

export type CvmsReplicateCommandInput = z.infer<
	typeof cvmsReplicateCommandSchema
>;
