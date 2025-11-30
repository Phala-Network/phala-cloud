import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";
import { jsonOption } from "@/src/commands/status/command";

export const cvmsListCommandMeta: CommandMeta = {
	name: "list",
	aliases: ["ls"],
	description: "List your CVMs",
	options: [jsonOption],
	examples: [
		{
			name: "Display CVMs in table format",
			value: "phala cvms list",
		},
		{
			name: "Print CVMs as JSON",
			value: "phala cvms list --json",
		},
	],
};

export const cvmsListCommandSchema = z.object({
	json: z.boolean().default(false),
});

export type CvmsListCommandInput = z.infer<typeof cvmsListCommandSchema>;
