import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";
import { jsonOption } from "@/src/core/common-flags";

export const kmsListCommandMeta: CommandMeta = {
	name: "list",
	aliases: ["ls"],
	description: "List KMS contracts",
	stability: "unstable",
	options: [jsonOption],
	examples: [
		{
			name: "List KMS contracts",
			value: "phala kms list",
		},
		{
			name: "Output as JSON",
			value: "phala kms list --json",
		},
	],
};

export const kmsListCommandSchema = z.object({
	json: z.boolean().default(false),
});

export type KmsListCommandInput = z.infer<typeof kmsListCommandSchema>;
