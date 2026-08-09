import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";

export const profilesDeleteCommandMeta: CommandMeta = {
	name: "delete",
	category: "profile",
	description: "Delete one or more auth profiles",
	stability: "stable",
	arguments: [
		{
			name: "profile-names...",
			description: "Profile name(s) to delete",
			required: true,
			variadic: true,
			target: "profileNames",
		},
	],
	options: [],
	aliases: ["rm"],
	examples: [
		{
			name: "Delete a single profile",
			value: "phala profiles delete my-profile",
		},
		{
			name: "Delete multiple profiles",
			value: "phala profiles delete profile-a profile-b",
		},
	],
};

export const profilesDeleteCommandSchema = z.object({
	profileNames: z.array(z.string().min(1)).min(1),
});

export type ProfilesDeleteCommandInput = z.infer<
	typeof profilesDeleteCommandSchema
>;
