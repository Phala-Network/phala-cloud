import type { CommandMeta } from "@/src/core/types";
import { commonAuthOptions } from "@/src/core/common-flags";
import {
	debugOption,
	jsonOption,
	statusCommandSchema,
} from "@/src/commands/status/command";

export const authStatusCommandMeta: CommandMeta = {
	name: "status",
	description: "Removed. Use 'phala status' instead.",
	stability: "deprecated",
	options: [...commonAuthOptions, jsonOption, debugOption],
};

export const authStatusCommandSchema = statusCommandSchema;
