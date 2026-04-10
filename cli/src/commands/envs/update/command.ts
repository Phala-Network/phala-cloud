import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";
import {
	cvmIdArgument,
	interactiveOption,
	privateKeyOption,
	rpcUrlOption,
} from "@/src/core/common-flags";

export const envsUpdateCommandMeta: CommandMeta = {
	name: "update",
	description:
		"Encrypt and push sealed environment variables to a CVM (only readable inside TEE)",
	stability: "stable",
	arguments: [cvmIdArgument],
	options: [
		interactiveOption,
		{
			name: "env",
			shorthand: "e",
			description:
				"Environment variable (KEY=VALUE) or env file path (repeatable)",
			type: "string[]",
			target: "env",
			group: "basic",
		},
		{
			name: "encrypted-env",
			description:
				"Pre-encrypted environment variables as hex string (from 'phala envs encrypt')",
			type: "string",
			target: "encryptedEnv",
			group: "basic",
		},
		privateKeyOption,
		rpcUrlOption,
	],
	examples: [
		{
			name: "Update with inline variables",
			value: "phala envs update app_abc123 -e SECRET=newvalue -e API_KEY=xxx",
		},
		{
			name: "Update from env file",
			value: "phala envs update app_abc123 -e .env.production",
		},
		{
			name: "Update with CVM from phala.toml",
			value: "phala envs update -e .env",
		},
		{
			name: "Update with pre-encrypted hex (from 'phala envs encrypt')",
			value:
				"phala envs update app_abc123 --encrypted-env $(phala envs encrypt app_abc123 -e .env)",
		},
		{
			name: "Update with on-chain KMS",
			value: "phala envs update app_abc123 -e .env --private-key <key>",
		},
	],
};

export const envsUpdateCommandSchema = z.object({
	cvmId: z.string().optional(),
	env: z.array(z.string()).optional(),
	encryptedEnv: z.string().optional(),
	privateKey: z.string().optional(),
	rpcUrl: z.string().optional(),
	interactive: z.boolean().default(false),
});

export type EnvsUpdateCommandInput = z.infer<typeof envsUpdateCommandSchema>;
