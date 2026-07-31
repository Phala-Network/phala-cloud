import { docsGroup } from "./command";
import { docsFeedbackCommand } from "./feedback";
import { docsGrepCommand } from "./grep";
import { docsReadCommand } from "./read";
import { docsSearchCommand } from "./search";
import { docsTreeCommand } from "./tree";

export const docsCommands = {
	group: docsGroup,
	commands: [
		docsSearchCommand,
		docsReadCommand,
		docsTreeCommand,
		docsGrepCommand,
		docsFeedbackCommand,
	],
};

export default docsCommands;
