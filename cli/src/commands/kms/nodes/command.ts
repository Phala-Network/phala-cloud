import { z } from "zod";
import { jsonOption } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";

const slugArgument = {
	name: "slug",
	description: "KMS contract slug (e.g. phala, base, ethereum)",
	required: true,
	target: "slug",
};

export const kmsNodesCommandMeta: CommandMeta = {
	name: "nodes",
	description: "List the KMS nodes (with RPC url) under a contract",
	stability: "unstable",
	arguments: [slugArgument],
	options: [jsonOption],
	examples: [
		{
			name: "List nodes of the phala KMS contract",
			value: "phala kms nodes phala",
		},
		{
			name: "Output as JSON",
			value: "phala kms nodes phala --json",
		},
	],
};

export const kmsNodesCommandSchema = z.object({
	slug: z.string(),
	json: z.boolean().default(false),
});

export type KmsNodesCommandInput = z.infer<typeof kmsNodesCommandSchema>;
