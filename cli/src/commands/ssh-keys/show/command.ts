import { cvmIdArgument, interactiveOption } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";
import { z } from "zod";

export const sshKeysShowCommandMeta: CommandMeta = {
	name: "show",
	description: "Show the SSH keys a CVM is configured to authorize",
	stability: "stable",
	arguments: [cvmIdArgument],
	options: [interactiveOption],
	examples: [
		{
			name: "Show keys for a CVM",
			value: "phala ssh-keys show app_123",
		},
		{
			name: "Show keys from phala.toml",
			value: "phala ssh-keys show",
		},
	],
};

export const sshKeysShowCommandSchema = z.object({
	cvmId: z.string().optional(),
	interactive: z.boolean().default(false),
});

export type SshKeysShowCommandInput = z.infer<typeof sshKeysShowCommandSchema>;
