import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	deployCommandMeta,
	deployCommandSchema,
	type DeployCommandInput,
} from "./command";
import { runDeploy } from "./handler";

async function handler(
	input: DeployCommandInput,
	context: CommandContext,
): Promise<number> {
	return runDeploy(input, context);
}

export const deployCommand = defineCommand({
	path: ["deploy"],
	meta: deployCommandMeta,
	schema: deployCommandSchema,
	handler,
});
