import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";

export const profilesUseCommandMeta: CommandMeta = {
	name: "use",
	category: "profile",
	description: "Switch to an auth profile",
	stability: "stable",
	arguments: [
		{
			name: "profile-name",
			description: "Profile name",
			required: true,
			target: "profileName",
		},
	],
	options: [
		{
			name: "interactive",
			shorthand: "i",
			description: "Select profile interactively",
			type: "boolean",
			target: "interactive",
		},
	],
};

export const profilesUseCommandSchema = z.object({
	profileName: z.string().min(1).optional(),
	interactive: z.boolean().default(false),
});

export type ProfilesUseCommandInput = z.infer<typeof profilesUseCommandSchema>;
