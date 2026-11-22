import { privateKeyOption, rpcUrlOption } from "@/src/core/common-flags";
import type { CommandGroup, CommandMeta } from "@/src/core/types";
import { z } from "zod";

export const composeHashesGroup: CommandGroup = {
	path: ["apps", "compose-hashes"],
	meta: {
		name: "compose-hashes",
		description:
			"List and revoke registered compose hashes that no CVM is using",
		stability: "stable",
	},
};

const appArgument = {
	name: "app_id",
	target: "appId",
	description: "App ID, with or without the app_ prefix",
	required: true,
};

export const composeHashListMeta: CommandMeta = {
	name: "list",
	description: "List registered compose hashes that no CVM is using",
	stability: "stable",
	arguments: [appArgument],
};

const appId = z
	.string()
	.regex(/^(?:app_|0x)?[0-9a-f]{40}$/i, "Expected a 20-byte app ID.")
	.transform((id) => id.replace(/^(?:app_|0x)/i, "").toLowerCase());
export const composeHashListSchema = z.object({ appId });

export const composeHashRevokeMeta: CommandMeta = {
	name: "revoke",
	description:
		"Revoke an unused compose hash with the app owner's wallet. This cannot take back keys already released.",
	stability: "stable",
	arguments: [
		appArgument,
		{
			name: "compose_hash",
			target: "composeHash",
			description: "Compose hash listed as unused",
			required: true,
		},
	],
	options: [
		{
			name: "yes",
			shorthand: "y",
			description:
				"Confirm the irreversible transaction without a prompt (required outside a terminal)",
			type: "boolean",
		},
		privateKeyOption,
		rpcUrlOption,
	],
};

export const composeHashRevokeSchema = composeHashListSchema.extend({
	composeHash: z
		.string()
		.regex(/^(?:0x)?[0-9a-f]{64}$/i, "Expected a 32-byte compose hash."),
	yes: z.boolean().default(false),
	privateKey: z.string().optional(),
	rpcUrl: z.string().optional(),
});
