import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";
import { jsonOption } from "@/src/core/common-flags";

export const instancesLsCommandMeta: CommandMeta = {
	name: "ls",
	description: "List instances of an app",
	stability: "unstable",
	options: [
		{
			name: "app-id",
			description: "App ID (hex identifier). Defaults to app_id in phala.toml.",
			type: "string",
			target: "appId",
		},
		jsonOption,
	],
	examples: [
		{
			name: "List instances for app in phala.toml",
			value: "phala instances ls",
		},
		{
			name: "List instances for a specific app",
			value: "phala instances ls --app-id <app-id>",
		},
		{
			name: "Output as JSON",
			value: "phala instances ls --app-id <app-id> --json",
		},
	],
};

export const instancesLsCommandSchema = z.object({
	appId: z.string().optional(),
	json: z.boolean().default(false),
});

export type InstancesLsCommandInput = z.infer<typeof instancesLsCommandSchema>;
