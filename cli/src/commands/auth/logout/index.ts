import { defineCommand } from "@/src/core/define-command";
import { logger } from "@/src/utils/logger";
import { logoutCommandMeta, logoutCommandSchema } from "./command";

export const logoutCommand = defineCommand({
	path: ["auth", "logout"],
	meta: logoutCommandMeta,
	schema: logoutCommandSchema,
	handler: async () => {
		logger.error(
			'The "phala auth logout" command has been removed. Use "phala logout" instead.',
		);
		return 1;
	},
});

export default logoutCommand;
