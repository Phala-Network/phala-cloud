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
	try {
		await runDeploy(input, {
			stdout: context.stdout,
			stderr: context.stderr,
			projectConfig: context.projectConfig,
		});
		return 0;
	} catch (error) {
		return 1;
	}
}

export const deployCommand = defineCommand({
	path: ["deploy"],
	meta: deployCommandMeta,
	schema: deployCommandSchema,
	handler,
});
