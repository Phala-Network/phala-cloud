import { selfGroup } from "./command";
import { selfUpdateCommand } from "./update";

export const selfCommands = {
	group: selfGroup,
	commands: [selfUpdateCommand],
};

export default selfCommands;
