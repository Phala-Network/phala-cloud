import { cvmIdArgument, interactiveOption } from "@/src/core/common-flags";
import type {
	CommandArgument,
	CommandMeta,
	CommandOption,
} from "@/src/core/types";
import { z } from "zod";

const userNicknameArgument: CommandArgument = {
	name: "user_nickname",
	description: "Workspace member username whose keys to grant",
	required: false,
	target: "userNickname",
};

const sshKeyIdOption: CommandOption = {
	name: "id",
	description: "SSH key hashid to grant in addition to the nickname",
	type: "string",
	target: "sshKeyId",
};

const applyNowOption: CommandOption = {
	name: "apply-now",
	description: "Restart the CVM so the change takes effect immediately",
	type: "boolean",
	target: "applyNow",
};

export const sshKeysGrantCommandMeta: CommandMeta = {
	name: "grant",
	description: "Authorize a workspace member's SSH keys on a CVM",
	stability: "stable",
	arguments: [cvmIdArgument, userNicknameArgument],
	options: [interactiveOption, sshKeyIdOption, applyNowOption],
	examples: [
		{
			name: "Grant every key a teammate holds",
			value: "phala ssh-keys grant app_123 alice",
		},
		{
			name: "Grant one key by id",
			value: "phala ssh-keys grant app_123 --id sshkey_abc",
		},
		{
			name: "Grant and restart now",
			value: "phala ssh-keys grant app_123 alice --apply-now",
		},
	],
};

export const sshKeysGrantCommandSchema = z.object({
	cvmId: z.string().optional(),
	userNickname: z.string().optional(),
	sshKeyId: z.string().optional(),
	applyNow: z.boolean().default(false),
	interactive: z.boolean().default(false),
});

export type SshKeysGrantCommandInput = z.infer<
	typeof sshKeysGrantCommandSchema
>;
