import { kmsGroup } from "./command";
import { kmsCommand, kmsListCommand } from "./list/index";
import { kmsNodesCommand } from "./nodes/index";
import { kmsEthereumCommand, kmsBaseCommand } from "./chain/index";

export const kmsCommands = {
	group: kmsGroup,
	commands: [
		kmsCommand,
		kmsListCommand,
		kmsNodesCommand,
		kmsEthereumCommand,
		kmsBaseCommand,
	],
};

export default kmsCommands;
