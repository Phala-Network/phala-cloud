import { defineCommand } from "@/src/core/define-command";
import { logger } from "@/src/utils/logger";
import { loginCommandMeta, loginCommandSchema } from "./command";

export const loginCommand = defineCommand({
	path: ["auth", "login"],
	meta: loginCommandMeta,
	schema: loginCommandSchema,
	handler: async () => {
		logger.error(
			'The "phala auth login" command has been removed. Use "phala login" instead.',
		);
		return 1;
	},
});

export default loginCommand;
