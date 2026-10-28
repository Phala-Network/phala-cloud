import type { z } from "zod";
import type {
	CommandDefinition,
	CommandHandler,
	CommandMeta,
	CommandPath,
} from "./types";

export interface DefineCommandParams<Schema extends z.ZodType> {
	readonly path: CommandPath;
	readonly meta: CommandMeta;
	readonly schema: Schema;
	readonly handler: CommandHandler<Schema>;
}

export function defineCommand<Schema extends z.ZodType>(
	params: DefineCommandParams<Schema>,
): CommandDefinition<Schema> {
	return {
		path: params.path,
		meta: params.meta,
		schema: params.schema,
		run: params.handler,
	};
}
