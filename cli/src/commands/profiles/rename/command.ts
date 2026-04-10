import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";

export const profilesRenameCommandMeta: CommandMeta = {
	name: "rename",
	category: "profile",
	description: "Rename an auth profile",
	stability: "stable",
	arguments: [
		{
			name: "old-name",
			description: "Current profile name",
			required: true,
			target: "oldName",
		},
		{
			name: "new-name",
			description: "New profile name",
			required: true,
			target: "newName",
		},
	],
	options: [],
	aliases: ["mv"],
};

export const profilesRenameCommandSchema = z.object({
	oldName: z.string().min(1),
	newName: z.string().min(1),
});

export type ProfilesRenameCommandInput = z.infer<
	typeof profilesRenameCommandSchema
>;
