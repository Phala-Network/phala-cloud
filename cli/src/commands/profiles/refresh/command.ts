import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";

export const profilesRefreshCommandMeta: CommandMeta = {
	name: "refresh",
	category: "profile",
	description: "Re-authenticate a profile with a fresh API token",
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
			name: "manual",
			description: "Enter API key manually (skip device flow)",
			type: "boolean",
		},
		{
			name: "no-open",
			description: "Skip browser launch",
			type: "boolean",
			target: "noOpen",
		},
	],
	examples: [
		{
			name: "Refresh a profile via device flow",
			value: "phala profiles refresh my-profile",
		},
		{
			name: "Refresh a profile by pasting a new API key",
			value: "phala profiles refresh my-profile --manual",
		},
	],
};

export const profilesRefreshCommandSchema = z.object({
	profileName: z.string().min(1),
	manual: z.boolean().optional(),
	noOpen: z.boolean().optional(),
});

export type ProfilesRefreshCommandInput = z.infer<
	typeof profilesRefreshCommandSchema
>;
