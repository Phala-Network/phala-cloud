import { z } from "zod";
import type {
	CommandArgument,
	CommandGroup,
	CommandMeta,
} from "@/src/core/types";

export const appsLaunchTokenGroup: CommandGroup = {
	path: ["apps", "launch-token"],
	meta: {
		name: "launch-token",
		category: "manage",
		description: "Set, rotate or clear an app's launch token",
		stability: "stable",
	},
};

const appIdArgument: CommandArgument = {
	name: "app_id",
	description: "App ID (hex)",
	required: true,
	target: "appId",
};

export const appsLaunchTokenSetCommandMeta: CommandMeta = {
	name: "set",
	description:
		"Set or rotate the app's launch token and print it and its hash once",
	stability: "stable",
	arguments: [appIdArgument],
	options: [
		{
			name: "token",
			description:
				"Token to set (at least 32 bytes). Omit to have Phala Cloud generate one.",
			type: "string",
			target: "token",
		},
	],
	examples: [
		{
			name: "Generate a new token",
			value:
				"phala apps launch-token set 0123456789abcdef0123456789abcdef01234567",
		},
		{
			name: "Then point a CVM at the new hash",
			value: "phala deploy --cvm-id app_123 --launch-token-hash <hash>",
		},
	],
};

export const appsLaunchTokenSetCommandSchema = z.object({
	appId: z.string(),
	token: z.string().optional(),
});

export type AppsLaunchTokenSetCommandInput = z.infer<
	typeof appsLaunchTokenSetCommandSchema
>;

export const appsLaunchTokenClearCommandMeta: CommandMeta = {
	name: "clear",
	description:
		"Remove the app's launch token. Remove launch_token_hash from every CVM of the app first.",
	stability: "stable",
	arguments: [appIdArgument],
	examples: [
		{
			name: "Remove the hash from a CVM, then clear the token",
			value:
				'phala deploy --cvm-id app_123 --launch-token-hash "" && phala apps launch-token clear 0123456789abcdef0123456789abcdef01234567',
		},
	],
};

export const appsLaunchTokenClearCommandSchema = z.object({
	appId: z.string(),
});

export type AppsLaunchTokenClearCommandInput = z.infer<
	typeof appsLaunchTokenClearCommandSchema
>;
