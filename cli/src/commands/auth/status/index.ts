import { defineCommand } from "@/src/core/define-command";
import { logger } from "@/src/utils/logger";
import { authStatusCommandMeta, authStatusCommandSchema } from "./command";

export const authStatusCommand = defineCommand({
	path: ["auth", "status"],
	meta: authStatusCommandMeta,
	schema: authStatusCommandSchema,
	handler: async () => {
		logger.error(
			'The "phala auth status" command has been removed. Use "phala status" instead.',
		);
		return 1;
	},
});

export default authStatusCommand;
