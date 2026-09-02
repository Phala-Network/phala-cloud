import { cvmIdArgument, interactiveOption } from "@/src/core/common-flags";
import type {
	CommandArgument,
	CommandMeta,
	CommandOption,
} from "@/src/core/types";
import { z } from "zod";

const userNicknameArgument: CommandArgument = {
	name: "user_nickname",
	description: "Workspace member username whose keys to withdraw",
	required: false,
	target: "userNickname",
};

const sshKeyIdOption: CommandOption = {
	name: "id",
	description: "SSH key hashid to withdraw in addition to the nickname",
	type: "string",
	target: "sshKeyId",
};

const applyNowOption: CommandOption = {
	name: "apply-now",
	description: "Restart the CVM so the change takes effect immediately",
	type: "boolean",
	target: "applyNow",
};

export const sshKeysRevokeCommandMeta: CommandMeta = {
	name: "revoke",
	description: "Withdraw SSH keys from a CVM without deleting the account keys",
	stability: "stable",
	arguments: [cvmIdArgument, userNicknameArgument],
	options: [interactiveOption, sshKeyIdOption, applyNowOption],
	examples: [
		{
			name: "Revoke every key a teammate holds on this CVM",
			value: "phala ssh-keys revoke app_123 alice",
		},
		{
			name: "Revoke one key by id",
			value: "phala ssh-keys revoke app_123 --id sshkey_abc",
		},
		{
			name: "Revoke and restart now",
			value: "phala ssh-keys revoke app_123 alice --apply-now",
		},
	],
};

export const sshKeysRevokeCommandSchema = z.object({
	cvmId: z.string().optional(),
	userNickname: z.string().optional(),
	sshKeyId: z.string().optional(),
	applyNow: z.boolean().default(false),
	interactive: z.boolean().default(false),
});

export type SshKeysRevokeCommandInput = z.infer<
	typeof sshKeysRevokeCommandSchema
>;
