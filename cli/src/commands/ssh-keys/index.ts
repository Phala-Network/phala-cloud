import { sshKeysAddCommand } from "./add";
import { sshKeysGroup } from "./command";
import { sshKeysGrantCommand } from "./grant";
import { sshKeysImportGithubCommand } from "./import-github";
import { sshKeysListCommand } from "./list";
import { sshKeysRemoveCommand } from "./remove";
import { sshKeysRevokeCommand } from "./revoke";
import { sshKeysShowCommand } from "./show";

export const sshKeysCommands = {
	group: sshKeysGroup,
	commands: [
		sshKeysListCommand,
		sshKeysAddCommand,
		sshKeysRemoveCommand,
		sshKeysImportGithubCommand,
		sshKeysShowCommand,
		sshKeysGrantCommand,
		sshKeysRevokeCommand,
	],
};

export default sshKeysCommands;
