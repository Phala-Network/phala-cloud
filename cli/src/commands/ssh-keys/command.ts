import type { CommandGroup } from "@/src/core/types";

export const sshKeysGroup: CommandGroup = {
	path: ["ssh-keys"],
	meta: {
		name: "ssh-keys",
		category: "manage",
		description: "Manage account SSH keys and per-CVM authorization",
		stability: "stable",
	},
};
