import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";

export const profilesDeleteCommandMeta: CommandMeta = {
	name: "delete",
	category: "profile",
	description: "Delete a profile",
	stability: "stable",
	arguments: [
		{
			name: "profile-name",
			description: "Profile name",
			required: true,
			target: "profileName",
		},
	],
	options: [],
	aliases: ["rm"],
};

export const profilesDeleteCommandSchema = z.object({
	profileName: z.string().min(1),
});

export type ProfilesDeleteCommandInput = z.infer<
	typeof profilesDeleteCommandSchema
>;
